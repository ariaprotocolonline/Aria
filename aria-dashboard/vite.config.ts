import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Read .env from the ARIA monorepo root so all sub-projects share one file
  envDir: '../',
  define: {
    global: 'globalThis',
  },
})
