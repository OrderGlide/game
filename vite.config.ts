import { defineConfig } from 'vite';

// base './' so the build works from file:// inside the Capacitor WebView
export default defineConfig({
  base: './',
  // three.js alone is ~600 kB; it's loaded from local files inside the app, so one chunk is fine
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 1000 },
});
