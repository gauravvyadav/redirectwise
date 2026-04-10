import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    default_locale: 'en',
    name: '__MSG_extensionName__',
    description: '__MSG_extensionDesc__',
    version: '1.4.0',
    permissions: ['webRequest', 'webNavigation', 'tabs', 'storage', 'sidePanel'],
    host_permissions: ['<all_urls>'],
    icons: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
    build: {
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
          passes: 2,
        },
        mangle: {
          properties: {
            regex: /^_/,
          },
        },
        format: {
          comments: false,
        },
      },
      sourcemap: false,
    },
  }),
});
