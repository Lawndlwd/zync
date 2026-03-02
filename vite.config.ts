import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws/wakeword': {
        target: 'ws://localhost:9000',
        ws: true,
        rewrite: (path) => path.replace('/ws/wakeword', '/ws'),
      },
    },
    watch: {
      ignored: ['**/data/**'],
    },
  },
})
