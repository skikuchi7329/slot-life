import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // 本番は GitHub Pages（https://skikuchi7329.github.io/slot-life/）に置くため、パスの頭に /slot-life/ を付ける（ADR-024）
  base: command === 'build' ? '/slot-life/' : '/',
  plugins: [react(), tailwindcss()],
}))
