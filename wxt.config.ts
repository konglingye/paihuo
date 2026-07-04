import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: '派活儿',
    description: '领导把活儿甩给你，你把活儿派给 AI',
    permissions: ['sidePanel', 'storage', 'contextMenus', 'clipboardWrite', 'alarms'],
    action: {
      default_title: '派活儿',
    },
  },
});
