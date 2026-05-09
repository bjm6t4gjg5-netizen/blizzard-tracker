import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/blizzard-tracker/',
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
