import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { streamChatCompletion } from './transport';

let server: http.Server | undefined;

function startServer(handler: http.RequestListener): Promise<string> {
  return new Promise((resolve) => {
    server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server!.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

afterEach(async () => {
  if (server) {
    await new Promise((resolve) => server!.close(resolve));
    server = undefined;
  }
});

const baseParams = {
  apiKey: 'sk-test',
  model: 'deepseek-chat',
  messages: [{ role: 'user' as const, content: 'hi' }],
};

describe('streamChatCompletion', () => {
  it('解析 SSE 流并拼出完整内容 + usage', async () => {
    const baseUrl = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '你好' } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '，世界' } }] })}\n\n`);
      res.write(
        `data: ${JSON.stringify({
          choices: [{ delta: {} }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
      res.end();
    });

    const deltas: string[] = [];
    const result = await streamChatCompletion(
      { ...baseParams, baseUrl },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(deltas).toEqual(['你好', '，世界']);
    expect(result.content).toBe('你好，世界');
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 5, totalTokens: 15 });
  });

  it('SSE 分片跨多次 write 也能正确拼接（模拟 TCP 分包）', async () => {
    const baseUrl = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const full = `data: ${JSON.stringify({ choices: [{ delta: { content: '分片内容' } }] })}\n\ndata: [DONE]\n\n`;
      // 逐字符切分模拟粘包/分包
      let i = 0;
      const timer = setInterval(() => {
        if (i >= full.length) {
          clearInterval(timer);
          res.end();
          return;
        }
        res.write(full[i]);
        i += 1;
      }, 1);
    });

    const result = await streamChatCompletion({ ...baseParams, baseUrl }, {});
    expect(result.content).toBe('分片内容');
  });

  it('401 归类为 unauthorized', async () => {
    const baseUrl = await startServer((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid API key' } }));
    });
    await expect(streamChatCompletion({ ...baseParams, baseUrl }, {})).rejects.toMatchObject({
      kind: 'unauthorized',
      status: 401,
    });
  });

  it('429 归类为 rate_limited', async () => {
    const baseUrl = await startServer((_req, res) => {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Too many requests' } }));
    });
    await expect(streamChatCompletion({ ...baseParams, baseUrl }, {})).rejects.toMatchObject({
      kind: 'rate_limited',
      status: 429,
    });
  });

  it('500 归类为 unknown 并带上状态码', async () => {
    const baseUrl = await startServer((_req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'boom' } }));
    });
    await expect(streamChatCompletion({ ...baseParams, baseUrl }, {})).rejects.toMatchObject({
      kind: 'unknown',
      status: 500,
    });
  });

  it('请求卡住超过 timeoutMs 归类为 timeout', async () => {
    const baseUrl = await startServer(() => {
      // 故意不响应，模拟卡住
    });
    await expect(
      streamChatCompletion({ ...baseParams, baseUrl, timeoutMs: 50 }, {}),
    ).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('外部 signal.abort() 归类为 aborted', async () => {
    const baseUrl = await startServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'x' } }] })}\n\n`);
      // 不结束响应，保持连接打开等待中断
    });
    const controller = new AbortController();
    const promise = streamChatCompletion({ ...baseParams, baseUrl }, {}, controller.signal);
    setTimeout(() => controller.abort(), 30);
    await expect(promise).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('连接失败归类为 network', async () => {
    await expect(
      streamChatCompletion({ ...baseParams, baseUrl: 'http://127.0.0.1:1' }, {}),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});
