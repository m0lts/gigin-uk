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
  define: {
    'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY),
    'process.env.VITE_MAPBOX_TOKEN': JSON.stringify(process.env.VITE_MAPBOX_TOKEN),
  },
})
