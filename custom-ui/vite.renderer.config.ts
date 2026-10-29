import { defineConfig } from 'vite';
import path from 'node:path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // The license activation window is a page of its own, so it must be built alongside index.html
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'license-activation': path.resolve(__dirname, 'license-activation.html'),
      },
    },
  },
});
