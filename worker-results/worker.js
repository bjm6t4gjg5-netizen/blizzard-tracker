// ============================================================
// worker-results — tiny CORS relay for live race results
//
// results.chicagomarathon.com (mika:timing) serves HTML without CORS
// headers, so the tracker can't read it from the browser directly.
// This worker fetches the page server-side and returns it with CORS.
//
//   GET /?url=<encoded results URL>   → page HTML (+ CORS)
//   GET /health                       → { ok: true }
//
// Locked down: only allow-listed result hosts, GET only, 10s edge
// cache so a whole family refreshing every 5s costs one upstream hit.
// No secrets, no storage. Free tier is plenty.
// ============================================================

const ALLOWED_HOSTS = new Set([
  'results.chicagomarathon.com',
  'chicago-history.r.mikatiming.com',
]);

const CACHE_SECONDS = 10;

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowedOrigins = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
    const okOrigin = allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)
      || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const corsHeaders = cors(okOrigin ? (origin || '*') : 'null');

    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'GET') return new Response('GET only', { status: 405, headers: corsHeaders });
    if (url.pathname === '/health') {
      return new Response('{"ok":true}', { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!okOrigin) return new Response('Origin not allowed', { status: 403, headers: corsHeaders });

    const target = url.searchParams.get('url');
    let t;
    try { t = new URL(target); } catch { return new Response('Missing/invalid ?url=', { status: 400, headers: corsHeaders }); }
    if (t.protocol !== 'https:' || !ALLOWED_HOSTS.has(t.hostname)) {
      return new Response('Host not allowed', { status: 403, headers: corsHeaders });
    }

    const cache = caches.default;
    const cacheKey = new Request(t.toString(), { method: 'GET' });
    let res = await cache.match(cacheKey);
    if (!res) {
      const upstream = await fetch(t.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (blizzard-tracker results relay)', 'Accept': 'text/html' },
        redirect: 'follow',
      });
      const body = await upstream.text();
      res = new Response(body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'text/html; charset=utf-8',
          'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
        },
      });
      if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(corsHeaders)) out.headers.set(k, v);
    return out;
  },
};
