import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // maplibre-gl spawns its worker via a relative URL, which dev pre-bundling breaks
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
