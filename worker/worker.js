// ============================================================
// worker.js — Blizzard Tracker Strava proxy (Cloudflare Worker)
//
// Implements the architecture in docs/GARMIN_PLAN.md:
//
//   Garmin → Strava (auto-sync) → THIS WORKER → Svelte app
//
// The worker owns the OAuth tokens (they never reach the browser),
// refreshes them automatically, and serves a slim, cached summary
// endpoint the Training tab consumes. No live mid-run tracking —
// data appears after each run uploads to Strava.
//
// Routes:
//   GET /auth/:athlete          → redirect to Strava OAuth (athlete = gf | mom)
//   GET /oauth/callback         → token exchange, stores tokens in KV
//   GET /api/status             → { gf: bool, mom: bool } which athletes connected
//   GET /api/summary?athlete=gf → { weekly, recent, locations, athlete, fetchedAt }
//   GET /api/disconnect?athlete=gf&confirm=1 → revoke + delete tokens
//
// Setup: see worker/README.md
// ============================================================

const STRAVA_AUTH = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN = 'https://www.strava.com/oauth/token';
const STRAVA_API = 'https://www.strava.com/api/v3';

const ATHLETES = new Set(['gf', 'mom']);
const SUMMARY_CACHE_TTL = 15 * 60; // 15 min, seconds
const WEEKS = 12;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith('/auth/')) return authRedirect(url, env);
      if (path === '/oauth/callback') return oauthCallback(url, env);
      if (path === '/api/status') return withCors(await status(env), env);
      if (path === '/api/summary') return withCors(await summary(url, env), env);
      if (path === '/api/disconnect') return withCors(await disconnect(url, env), env);
      return new Response('Blizzard Tracker Strava worker. See /api/status', { status: 200 });
    } catch (err) {
      return withCors(json({ error: String(err?.message ?? err) }, 500), env);
    }
  },
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withCors(res, env) {
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN ?? '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return new Response(res.body, { status: res.status, headers });
}

// ────────────────────────────────────────────────────────────
// OAuth
// ────────────────────────────────────────────────────────────

function authRedirect(url, env) {
  const athlete = url.pathname.split('/')[2];
  if (!ATHLETES.has(athlete)) return json({ error: 'unknown athlete' }, 400);
  const redirectUri = `${url.origin}/oauth/callback`;
  const auth = new URL(STRAVA_AUTH);
  auth.searchParams.set('client_id', env.STRAVA_CLIENT_ID);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('approval_prompt', 'auto');
  auth.searchParams.set('scope', 'read,activity:read_all,profile:read_all');
  auth.searchParams.set('state', athlete);
  return Response.redirect(auth.toString(), 302);
}

async function oauthCallback(url, env) {
  const code = url.searchParams.get('code');
  const athlete = url.searchParams.get('state');
  if (!code || !ATHLETES.has(athlete)) return json({ error: 'bad callback' }, 400);

  const res = await fetch(STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return json({ error: `token exchange failed: ${res.status}` }, 502);
  const tok = await res.json();

  await env.TOKENS.put(`athlete:${athlete}`, JSON.stringify({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: tok.expires_at,
    strava_athlete_id: tok.athlete?.id ?? null,
    firstname: tok.athlete?.firstname ?? '',
    connected_at: Date.now(),
  }));
  // Bust any cached summary so fresh data shows immediately.
  await env.TOKENS.delete(`cache:${athlete}`);

  return new Response(
    `<!doctype html><meta charset="utf-8">
     <body style="font-family: -apple-system, sans-serif; text-align: center; padding-top: 18vh; background: #f5f5f7">
     <h1 style="font-size: 42px; margin-bottom: 4px">⚡ Connected!</h1>
     <p>${tok.athlete?.firstname ?? 'Athlete'}'s Strava is now linked to Blizzard Tracker.</p>
     <p style="color:#86868b">You can close this tab — training data appears in the app within a minute.</p>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function freshToken(athlete, env) {
  const raw = await env.TOKENS.get(`athlete:${athlete}`);
  if (!raw) return null;
  let tok = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  if (tok.expires_at - now > 120) return tok;

  // Refresh
  const res = await fetch(STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tok.refresh_token,
    }),
  });
  if (!res.ok) return null;
  const next = await res.json();
  tok = { ...tok, access_token: next.access_token, refresh_token: next.refresh_token, expires_at: next.expires_at };
  await env.TOKENS.put(`athlete:${athlete}`, JSON.stringify(tok));
  return tok;
}

// ────────────────────────────────────────────────────────────
// API
// ────────────────────────────────────────────────────────────

async function status(env) {
  const out = {};
  for (const a of ATHLETES) {
    out[a] = (await env.TOKENS.get(`athlete:${a}`)) != null;
  }
  return json(out);
}

async function disconnect(url, env) {
  const athlete = url.searchParams.get('athlete');
  if (!ATHLETES.has(athlete)) return json({ error: 'unknown athlete' }, 400);
  if (url.searchParams.get('confirm') !== '1') return json({ error: 'add &confirm=1' }, 400);
  const tok = await freshToken(athlete, env);
  if (tok) {
    await fetch('https://www.strava.com/oauth/deauthorize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.access_token}` },
    }).catch(() => {});
  }
  await env.TOKENS.delete(`athlete:${athlete}`);
  await env.TOKENS.delete(`cache:${athlete}`);
  return json({ ok: true });
}

async function summary(url, env) {
  const athlete = url.searchParams.get('athlete');
  if (!ATHLETES.has(athlete)) return json({ error: 'unknown athlete' }, 400);

  // Serve from cache when fresh.
  const cached = await env.TOKENS.get(`cache:${athlete}`);
  if (cached) return json(JSON.parse(cached));

  const tok = await freshToken(athlete, env);
  if (!tok) return json({ connected: false, athlete }, 200);

  // Pull last 12 weeks + a few days of runs (one page of 200 covers it).
  const after = Math.floor(Date.now() / 1000) - (WEEKS * 7 + 3) * 86400;
  const res = await fetch(
    `${STRAVA_API}/athlete/activities?per_page=200&after=${after}`,
    { headers: { Authorization: `Bearer ${tok.access_token}` } },
  );
  if (!res.ok) return json({ error: `strava ${res.status}` }, 502);
  const activities = await res.json();
  const runs = activities.filter(a => /run/i.test(a.type ?? a.sport_type ?? ''));

  const out = {
    connected: true,
    athlete,
    firstname: tok.firstname,
    fetchedAt: Date.now(),
    weekly: weeklyBuckets(runs),
    recent: recentRuns(runs, 5),
    locations: locationClusters(runs),
  };

  await env.TOKENS.put(`cache:${athlete}`, JSON.stringify(out), { expirationTtl: SUMMARY_CACHE_TTL });
  return json(out);
}

// ────────────────────────────────────────────────────────────
// Shaping — output mirrors the types in src/lib/trainingSample.ts
// ────────────────────────────────────────────────────────────

const M_PER_MI = 1609.344;

/** Strava workout_type for runs: 0 default, 1 race, 2 long run, 3 workout. */
function runType(a) {
  if (a.workout_type === 1) return 'race';
  if (a.workout_type === 2) return 'long';
  if (a.workout_type === 3) return 'workout';
  const mi = a.distance / M_PER_MI;
  if (mi >= 11) return 'long';
  return 'easy';
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

/** Sunday-anchored week buckets for the last 12 weeks, oldest first. */
function weeklyBuckets(runs) {
  const now = new Date();
  // Most recent Sunday (UTC is fine at week granularity).
  const sunday = new Date(now);
  sunday.setUTCDate(sunday.getUTCDate() - sunday.getUTCDay());
  sunday.setUTCHours(0, 0, 0, 0);

  const weeks = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(sunday);
    start.setUTCDate(start.getUTCDate() - i * 7);
    weeks.push({ weekOf: isoDay(start), startMs: start.getTime(), easy: 0, tempo: 0, long: 0, workout: 0 });
  }
  for (const a of runs) {
    const t = new Date(a.start_date).getTime();
    const mi = a.distance / M_PER_MI;
    for (let i = weeks.length - 1; i >= 0; i--) {
      if (t >= weeks[i].startMs) {
        const type = runType(a);
        const key = type === 'race' ? 'workout' : type; // races count as workout volume
        weeks[i][key] += mi;
        break;
      }
    }
  }
  return weeks.map(({ startMs, ...w }) => ({
    ...w,
    easy: Math.round(w.easy * 10) / 10,
    tempo: Math.round(w.tempo * 10) / 10,
    long: Math.round(w.long * 10) / 10,
    workout: Math.round(w.workout * 10) / 10,
  }));
}

function recentRuns(runs, n) {
  return runs
    .slice()
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    .slice(0, n)
    .map(a => {
      const mi = a.distance / M_PER_MI;
      const paceSecPerMile = mi > 0 ? Math.round(a.moving_time / mi) : 0;
      return {
        date: a.start_date_local?.slice(0, 10) ?? a.start_date.slice(0, 10),
        type: runType(a),
        distanceMi: Math.round(mi * 10) / 10,
        paceSecPerMile,
        hrAvg: a.average_heartrate ? Math.round(a.average_heartrate) : undefined,
        elevationFt: a.total_elevation_gain ? Math.round(a.total_elevation_gain * 3.28084) : undefined,
        city: a.location_city || a.timezone?.split('/').pop()?.replace(/_/g, ' ') || '',
        notes: a.name,
      };
    });
}

/** Cluster run start points to ~10km cells for the geography heat map. */
function locationClusters(runs) {
  const cells = new Map();
  for (const a of runs) {
    const ll = a.start_latlng;
    if (!Array.isArray(ll) || ll.length !== 2) continue;
    const key = `${ll[0].toFixed(1)},${ll[1].toFixed(1)}`;
    const cell = cells.get(key) ?? { lat: 0, lng: 0, runs: 0, name: '' };
    cell.lat += ll[0];
    cell.lng += ll[1];
    cell.runs += 1;
    if (!cell.name && a.location_city) cell.name = a.location_city;
    cells.set(key, cell);
  }
  return [...cells.values()]
    .map(c => ({
      lat: Math.round((c.lat / c.runs) * 1e4) / 1e4,
      lng: Math.round((c.lng / c.runs) * 1e4) / 1e4,
      runs: c.runs,
      name: c.name || 'Training spot',
    }))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 40);
}
