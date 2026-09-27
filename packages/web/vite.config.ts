import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Same layout as production: zync's API under /zync/api, its build under /zync/assets, and every
// other path (opencode's chat UI and its API) forwarded through the API server to opencode.
const api = { target: 'http://127.0.0.1:3001', ws: true }

export default defineConfig({
  plugins: [react({ babel: { plugins: [['babel-plugin-react-compiler', { target: '19' }]] } })],
  build: {
    assetsDir: 'zync/assets',
    rollupOptions: {
      output: {
        // Libraries change less often than the app: their own chunks stay cached across deploys.
        manualChunks: (id) =>
          /node_modules\/(react|react-dom|scheduler|react-router|@tanstack)\//.test(id) ? 'vendor' : undefined,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/zync/api': api,
      // Anything that isn't the app itself or Vite's dev files.
      // Not "/" itself (with or without a query): that's the app, and Vite's own HMR websocket.
      // Not the app's pages either (/w/…, /login): Vite serves index.html for those.
      '^/(?!(?:w|login|zync|src|node_modules|@vite|@react-refresh|@id|@fs|__vite[^/?]*)(?:[/?]|$))[^?]': api,
    },
  },
  test: {
    environment: 'node',
    // Calendar math is wall-clock; pin a zone with DST so day/week edges are exercised.
    env: { TZ: 'Europe/Paris' },
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
