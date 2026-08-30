import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3011',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
