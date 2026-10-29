import { defineConfig } from 'vite';
import { moonbase } from '@moonbase.sh/electron/vite';

// https://vitejs.dev/config
export default defineConfig({
  // @moonbase.sh/electron loads its activation UI from the folder it runs from,
  // so the plugin copies the UI beside the main process bundle
  plugins: [moonbase()],
});
