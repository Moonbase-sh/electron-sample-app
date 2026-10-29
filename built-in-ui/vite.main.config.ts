import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // @moonbase.sh/electron loads its activation UI from its own folder in
      // node_modules, so it must be required from there rather than bundled
      external: ['@moonbase.sh/electron'],
    },
  },
});
