import { defineConfig } from '@playwright/test';

/**
 * T22 e2e：只测「加载真实解包扩展、跑 mock 全链路」这一件事，跑之前必须先
 * `VITE_PAIHUO_MOCK=1 wxt build`（见 package.json 的 `pnpm e2e`），不是自己起 dev server。
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  use: { trace: 'off', video: 'off', screenshot: 'only-on-failure' },
});
