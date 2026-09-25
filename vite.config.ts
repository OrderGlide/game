import { defineConfig } from 'vite';

// base './' so the build works from file:// inside the Capacitor WebView
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
});
