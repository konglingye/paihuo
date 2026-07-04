import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { fetchModelList } from './models';

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

describe('fetchModelList（真实通道）', () => {
  it('baseUrl 不带 /v1 时，直接命中 {baseUrl}/v1/models', async () => {
    const baseUrl = await startServer((req, res) => {
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] }));
        return;
      }
      res.writeHead(404).end();
    });

    const models = await fetchModelList({ baseUrl, apiKey: 'sk-x' });
    expect(models).toEqual([{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }]);
  });

  it('baseUrl 已带 /v1 时，保留 v1 直接拼 /models（不会拼成 /v1/v1/models）', async () => {
    const baseUrl0 = await startServer((req, res) => {
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'moonshot-v1-8k' }] }));
        return;
      }
      res.writeHead(404).end();
    });
    const baseUrl = `${baseUrl0}/v1`;

    const models = await fetchModelList({ baseUrl, apiKey: 'sk-x' });
    expect(models).toEqual([{ id: 'moonshot-v1-8k' }]);
  });

  it('第一个候选 404 时探测回退到第二个候选', async () => {
    const baseUrl = await startServer((req, res) => {
      if (req.url === '/v1/models') {
        res.writeHead(404).end();
        return;
      }
      if (req.url === '/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: 'glm-4' }] }));
        return;
      }
      res.writeHead(404).end();
    });

    const models = await fetchModelList({ baseUrl, apiKey: 'sk-x' });
    expect(models).toEqual([{ id: 'glm-4' }]);
  });

  it('两个候选都失败时抛出分类过的错误', async () => {
    const baseUrl = await startServer((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid API key' } }));
    });

    await expect(fetchModelList({ baseUrl, apiKey: 'sk-bad' })).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('响应用 "models" 字段包装时也能解析（兼容不同厂商格式）', async () => {
    const baseUrl = await startServer((req, res) => {
      if (req.url === '/v1/models') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: [{ id: 'doubao-pro-32k' }] }));
        return;
      }
      res.writeHead(404).end();
    });

    const models = await fetchModelList({ baseUrl, apiKey: 'sk-x' });
    expect(models).toEqual([{ id: 'doubao-pro-32k' }]);
  });
});
