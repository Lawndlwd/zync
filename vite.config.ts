import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3001'
const wakewordUrl = process.env.VITE_WAKEWORD_URL || 'ws://localhost:9000'

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['radix-ui', 'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          'vendor-query': ['@tanstack/react-query', 'zustand'],
          'vendor-charts': ['recharts'],
          'vendor-editor': ['@milkdown/crepe', '@milkdown/kit'],
          'vendor-shiki': ['shiki'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-dates': ['date-fns', 'cronstrue'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        timeout: 180_000, // 3 min for LLM-powered endpoints
      },
      '/ws/wakeword': {
        target: wakewordUrl,
        ws: true,
        rewrite: (path) => path.replace('/ws/wakeword', '/ws'),
      },
      '/opencode': {
        target: process.env.VITE_OPENCODE_URL || 'http://localhost:4096',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/opencode/, ''),
      },
    },
    watch: {
      ignored: ['**/data/**'],
    },
  },
})
