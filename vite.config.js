import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Deployed at https://<user>.github.io/blizzard-tracker/
// Use a relative base ('./') so the build works under any subpath without rewrites.
export default defineConfig({
  plugins: [svelte()],
  base: './',
  publicDir: 'public',
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    assetsInlineLimit: 4096,
    // CI builds run on a clean checkout so emptying isn't needed; locally we
    // keep emptyOutDir true so stale artifacts don't accumulate.
    emptyOutDir: !process.env.SKIP_EMPTY_OUTDIR,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
