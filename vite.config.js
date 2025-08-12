import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // If you need raw access to envs inside the config:
  const env = loadEnv(mode, process.cwd(), ''); // loads .env.<mode>

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@features': path.resolve(__dirname, 'src/features'),
        '@components': path.resolve(__dirname, 'src/components'),
        '@lib': path.resolve(__dirname, 'src/lib'),
        '@hooks': path.resolve(__dirname, 'src/hooks'),
        '@context': path.resolve(__dirname, 'src/context'),
        '@assets': path.resolve(__dirname, 'src/assets'),
        '@styles': path.resolve(__dirname, 'src/assets/styles'),
        '@layouts': path.resolve(__dirname, 'src/layouts'),
        '@services': path.resolve(__dirname, 'src/services'),
      },
    },
  };
});

// export default defineConfig({
//   plugins: [react()],
//   resolve: {
//     alias: {
//       '@features': path.resolve(__dirname, 'src/features'),
//       '@components': path.resolve(__dirname, 'src/components'),
//       '@lib': path.resolve(__dirname, 'src/lib'),
//       '@hooks': path.resolve(__dirname, 'src/hooks'),
//       '@context': path.resolve(__dirname, 'src/context'),
//       '@assets': path.resolve(__dirname, 'src/assets'),
//       '@styles': path.resolve(__dirname, 'src/assets/styles'),
//       '@layouts': path.resolve(__dirname, 'src/layouts'),
//       '@services': path.resolve(__dirname, 'src/services'),
//     },
//   },
//   define: {
//     'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(process.env.VITE_FIREBASE_API_KEY),
//     'process.env.VITE_MAPBOX_TOKEN': JSON.stringify(process.env.VITE_MAPBOX_TOKEN),
//   },
// })
