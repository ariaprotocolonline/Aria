import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../',
  define: {
    global: 'globalThis',
  },
  server: {
    proxy: {
      // Proxy /tg/* → aria-tgbot on port 3003
      '/tg': {
        target: 'http://127.0.0.1:3003',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/tg/, ''),
      },
      // Proxy /api/* and /auth/* and /conversations/* → aria-server on port 3002
      '/api':           { target: 'http://127.0.0.1:3002', changeOrigin: true },
      '/auth':          { target: 'http://127.0.0.1:3002', changeOrigin: true },
      '/conversations': { target: 'http://127.0.0.1:3002', changeOrigin: true },
      '/security':      { target: 'http://127.0.0.1:3002', changeOrigin: true },
      '/feed':          { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
})
