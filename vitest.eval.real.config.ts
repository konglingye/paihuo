import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

// T24 专用：真模型冒烟，只手动跑（pnpm eval:real），跟 pnpm test / pnpm eval 完全分开，
// 不设 PAIHUO_REAL_API_KEY 时 evals/real-model.manual.test.ts 里的用例全部自动跳过。
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['evals/real-model.manual.test.ts'],
    testTimeout: 60_000,
  },
});
