import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Same layout as production: zync's API under /zync/api, its build under /zync/assets, and every
// other path (opencode's chat UI and its API) forwarded through the API server to opencode.
const api = { target: 'http://127.0.0.1:3001', ws: true }

export default defineConfig({
  plugins: [react()],
  build: { assetsDir: 'zync/assets' },
  server: {
    port: 5173,
    proxy: {
      '/zync/api': api,
      // Anything that isn't the app itself or Vite's dev files.
      '^/(?!(w|zync|src|node_modules|@vite|@react-refresh|@id|@fs)(/|$)).+': api,
    },
  },
})
