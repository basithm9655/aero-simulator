import { defineConfig, loadEnv } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins:[cesium()],
    define:{
      __GOOGLE_MAPS_API_KEY__: JSON.stringify(env.GOOGLE_MAPS_API_KEY || ''),
      __CESIUM_ION_TOKEN__: JSON.stringify(env.CESIUM_ION_TOKEN || '')
    },
    build:{
      chunkSizeWarningLimit:1600,
      rollupOptions:{
        input:{
          main:'index.html',
          controller:'controller.html'
        }
      }
    }
  };
});
