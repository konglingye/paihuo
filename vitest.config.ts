import { configDefaults, defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

// evals/ 是独立的 `pnpm eval` 通道（见 vitest.eval.config.ts），不跟 `pnpm test` 混在一起跑
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [...configDefaults.exclude, 'evals/**'],
  },
});
