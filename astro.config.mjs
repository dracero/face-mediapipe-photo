// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',

  vite: {
    optimizeDeps: {
      exclude: ['better-sqlite3'],
    },
    define: {
      global: 'globalThis',
    },
    server: {
      fs: {
        allow: ['..']
      },
      proxy: {
        '/api': 'http://localhost:8000',
        '/ws': {
          target: 'http://localhost:8000',
          ws: true,
        },
      },
    },
  },

  devToolbar: {
    enabled: false,
  },
});
