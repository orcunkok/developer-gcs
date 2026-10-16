import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [vue(), mode === 'test' && (await import('./test/testTerminal.js')).default()],
  // maplibre-gl spawns its worker via a relative URL, which dev pre-bundling breaks
  optimizeDeps: { exclude: ['maplibre-gl'] },
}))
