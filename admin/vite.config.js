import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  // Vite 会自动加载 .env 文件中 VITE_ 前缀的环境变量到 import.meta.env
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      },
      '/avatars': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    },
    watch: {
      ignored: ['**/.env']
    }
  }
})