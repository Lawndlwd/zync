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
