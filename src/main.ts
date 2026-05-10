// ============================================================
// main.ts — Mount the Svelte app.
// ============================================================
import './app.css';
import './lib/appearance';  // bootstraps theme/accent from localStorage
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app container not found');

const app = new App({ target });
export default app;

// PWA: register the service worker. The worker is intentionally minimal —
// it caches the static shell only and NEVER caches API/proxy responses.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + 'sw.js')
      .catch(() => {/* silent — SW failure is non-fatal */});
  });
}
