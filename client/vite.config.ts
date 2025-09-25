import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true }
    }
  },
  // ВАЖНО: заменить REPO_NAME на имя твоего репо на GitHub
  base: '/REPO_NAME/'
})
