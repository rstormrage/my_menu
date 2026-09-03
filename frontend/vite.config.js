import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// GitHub Pages 项目站地址是 https://<user>.github.io/my_menu/
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  base: command === 'build' ? '/my_menu/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  preview: {
    port: 4173,
  },
}))
