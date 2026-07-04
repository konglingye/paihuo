import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

// `pnpm eval` 专用配置（arch §7）：只跑 evals/ 下的 fixture 驱动评测，跟 `pnpm test` 的单测分开
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['evals/**/*.eval.test.ts'],
  },
});
