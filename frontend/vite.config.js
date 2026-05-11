import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5234',
        changeOrigin: true,
      },
      '/notificationHub': {
        target: 'http://localhost:5234',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})