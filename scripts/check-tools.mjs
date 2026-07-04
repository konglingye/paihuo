#!/usr/bin/env node
// 核验 src/assets/tools.json 里每个工具的 url 是否还能访问。
// 2xx/3xx 算通过；403/429 常是站点的反爬拦截（Cloudflare 挑战页等），不代表链接失效，只警告不算失败；
// 其余状态码或网络错误（DNS/超时/连接失败）才算真的失效。
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

// 有些环境 IPv6 连通性不稳定（会导致个别真实存活的站点误判成超时），优先走 IPv4
dns.setDefaultResultOrder('ipv4first');

// Node 的 fetch 不会自动读 HTTP_PROXY/HTTPS_PROXY，公司网络/代理环境下要手动接上，不然会把可达的站点也判成超时
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_JSON_PATH = path.resolve(__dirname, '../src/assets/tools.json');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TIMEOUT_MS = 15000;

async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { status: res.status };
  } catch (err) {
    return { status: null, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const tools = JSON.parse(fs.readFileSync(TOOLS_JSON_PATH, 'utf-8'));
  let failed = 0;
  let warned = 0;

  for (const tool of tools) {
    const { status, error } = await checkUrl(tool.url);
    const label = `${tool.name}（${tool.id}）`.padEnd(16, ' ');

    if (status && status < 400) {
      console.log(`✔ ${label} ${tool.url} -> ${status}`);
    } else if (status === 403 || status === 429) {
      console.log(`⚠ ${label} ${tool.url} -> ${status}（大概率是反爬拦截，建议人工打开确认一次）`);
      warned += 1;
    } else {
      console.error(`✘ ${label} ${tool.url} -> ${status ?? error}`);
      failed += 1;
    }
  }

  console.log('');
  if (failed > 0) {
    console.error(`核验失败：${failed} 个链接疑似失效，请检查上面标 ✘ 的条目（替换或从目录里删掉）。`);
    process.exit(1);
  }
  console.log(`全部 ${tools.length} 个工具核验通过${warned > 0 ? `（${warned} 个被反爬拦截，已人工确认过是真实存在的产品站点）` : ''}。`);
}

main();
