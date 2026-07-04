import { configDefaults, defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

// evals/ 是独立的 `pnpm eval` 通道（见 vitest.eval.config.ts）；e2e/ 是独立的 `pnpm e2e`
// 通道（见 playwright.config.ts，用 @playwright/test 的 test()，跟 vitest 的不是一回事），
// 都不跟 `pnpm test` 混在一起跑
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [...configDefaults.exclude, 'evals/**', 'e2e/**'],
  },
});
