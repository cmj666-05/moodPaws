import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue')) return 'vue-vendor'
          if (id.includes('node_modules/echarts')) return 'echarts'
          if (id.includes('node_modules/@capacitor')) return 'capacitor'
        }
      }
    }
  }
})
