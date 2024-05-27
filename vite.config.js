import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '/components': '/src/components',
      '/logos': '/src/components/ui/logos',
      '/styles': '/src/assets/styles',
      '/forms': '/src/components/forms',
      '/ui': '/src/components/ui',
      '/pages': '/src/pages',
      '/assets': '/src/assets',
      '/utils': '/src/utils',
      '/sections': '/src/sections',
    },
  },
})
