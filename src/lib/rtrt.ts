// ============================================================
// rtrt.ts — RTRT.me live race-tracking client (v5)
//
// HISTORY: v1–v4 of this file scraped rtrt.me/{event}/track/{id}
// HTML through CORS proxies. On race day for the 2026 RBC
// Brooklyn Half we discovered that page is now a JS shell with
// zero server-rendered race data, so the parser saw nothing.
//
// v5 calls RTRT's real JSON API directly. The endpoint, public
// token, and request shape were captured from Safari's Network
// inspector on app.rtrt.me. The API serves CORS with
// `Access-Control-Allow-Origin: *`, so we hit it without proxies.
//
// We keep the original `fetchRunner(trackId)` signature so the
// rest of the app — stores, components, simulator — is untouched.
// ============================================================
import { TOTAL_MI } from './time';

const EVENT_ID  = 'NYRR-BROOKLYN-2026';
const APP_ID    = '4d7a9ceb0be65b3cc4948ee9';
/** Public tracker token (baked into RTRT's webtracker bundle — same token
 *  every browser uses, not a secret). If RTRT rotates it we'll need to
 *  re-capture from app.rtrt.me. */
const TOKEN     = 'C9EBC40A6928A006AC3C';
const API_BASE  = 'https://api.rtrt.me/events';

const FETCH_TIMEOUT_MS = 8_000;

export interface RtrtSplit {
  label: string;
  chipTime: string;
  pace: string;
}

export interface RtrtSnapshot {
  status: 'pre' | 'running' | 'finished' | 'unknown';
  distMi: number | null;
  elapsedSec: number | null;
  splits: RtrtSplit[];
  fetchedAt: number;
  /** Where the snapshot came from (api, sim, …) — diagnostics only. */
  source: string;
}

// ────────────────────────────────────────────────────────────
// API response types (only the fields we use)
// ────────────────────────────────────────────────────────────

interface RtrtSplitRow {
  pid?: string;
  label?: string;     // "5K", "10K", "Finish", etc.
  name?: string;      // alt label some events use
  time?: string;      // chip/clock time "HH:MM:SS" or "MM:SS"
  etime?: string;     // elapsed time since start mat
  pace?: string;      // "06:48 /mi" or similar
  dist?: string;      // distance number as string, see units
  units?: string;     // "mi" or "km"
  loc?: string;       // location/checkpoint slug
}

interface RtrtPending {
  countdown?: string;
  wavestart?: string;
}

interface SplitsResponse {
  list?: RtrtSplitRow[];
  error?: { type: string; msg: string };
  info?: {
    loc?: Record<string, {
      pending?: Record<string, RtrtPending>;
      course?: string;
      wavestart?: string;
    }>;
  };
}

// ────────────────────────────────────────────────────────────
// HTTP helpers
// ────────────────────────────────────────────────────────────

/** Fetch with timeout; throws on timeout, network error, or non-2xx. */
async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Build the form-encoded body RTRT expects. */
function rtrtBody(extra: Record<string, string>): string {
  const all: Record<string, string> = {
    appid: APP_ID,
    token: TOKEN,
    cbust: String(Math.random()),
    source: 'webtracker',
    ...extra,
  };
  return new URLSearchParams(all).toString();
}

async function postJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = `${API_BASE}/${EVENT_ID}/${path}`;
  return withTimeout(async signal => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'application/json',
      },
      body: rtrtBody(params),
      signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`rtrt ${path} → ${res.status}`);
    return res.json() as Promise<T>;
  }, FETCH_TIMEOUT_MS);
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Fetch the latest snapshot for a single runner. Returns null on any failure;
 * callers should keep showing the previous snapshot in that case.
 *
 * Under the hood we call /profiles/{pid}/splits which carries everything we
 * need: the live splits list when racing, and a `pending` + `wavestart`
 * marker before the wave goes off.
 */
export async function fetchRunner(trackId: string): Promise<RtrtSnapshot | null> {
  try {
    const data = await postJson<SplitsResponse>(`profiles/${encodeURIComponent(trackId)}/splits`, {
      max: '2000',
      loc: '1',
      pidversion: '1',
      agt: '0',
      catloc: '1',
      uselbhide: '1',
      etimes: '1',
      units: 'standard',
    });
    const parsed = parseSplitsResponse(data, trackId);
    return { ...parsed, fetchedAt: Date.now(), source: 'rtrt-api' };
  } catch {
    return null;
  }
}

/**
 * Batch variant — one POST returns both runners. Useful if/when we want to
 * cut API traffic in half. Not yet wired into stores.ts (which still calls
 * fetchRunner per id) but ready to drop in.
 */
export async function fetchRunners(trackIds: string[]): Promise<Record<string, RtrtSnapshot | null>> {
  if (trackIds.length === 0) return {};
  const out: Record<string, RtrtSnapshot | null> = {};
  try {
    const csv = trackIds.map(encodeURIComponent).join(',');
    const data = await postJson<SplitsResponse>(`profiles/${csv}/splits`, {
      max: '2000',
      loc: '1',
      pidversion: '1',
      agt: '0',
      catloc: '1',
      uselbhide: '1',
      etimes: '1',
      units: 'standard',
    });
    for (const id of trackIds) {
      const parsed = parseSplitsResponse(data, id);
      out[id] = { ...parsed, fetchedAt: Date.now(), source: 'rtrt-api' };
    }
  } catch {
    for (const id of trackIds) out[id] = null;
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// Parser (pure function — covered by unit tests)
// ────────────────────────────────────────────────────────────

const HMS_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function parseHmsToSec(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.trim().match(HMS_RE);
  if (!m) return null;
  const h = m[3] ? +m[1] : 0;
  const min = m[3] ? +m[2] : +m[1];
  const sec = m[3] ? +m[3] : +m[2];
  if (!Number.isFinite(h + min + sec)) return null;
  const total = h * 3600 + min * 60 + sec;
  // Reject obvious wall-clock values (>6h)
  if (total > 6 * 3600) return null;
  return total;
}

function distToMiles(dist: string | undefined, units: string | undefined): number | null {
  if (!dist) return null;
  const v = parseFloat(dist);
  if (!Number.isFinite(v) || v < 0 || v > 14) return null;
  return (units && /km/i.test(units)) ? v * 0.621371 : v;
}

/**
 * Turn a SplitsResponse into a status/dist/elapsed/splits snapshot for ONE pid.
 *
 *  - `error: { type: 'no_results' }` + `info.loc[pid].pending` → pre-race
 *  - `list` rows with `pid === pid` → running (or finished if 'finish' row exists)
 *  - everything missing → unknown
 */
export function parseSplitsResponse(
  data: SplitsResponse,
  pid: string,
): Omit<RtrtSnapshot, 'fetchedAt' | 'source'> {
  const rows = (data.list ?? []).filter(r => !r.pid || r.pid === pid);

  let maxDistMi: number | null = null;
  let maxElapsedSec: number | null = null;
  let finished = false;
  const splits: RtrtSplit[] = [];

  for (const row of rows) {
    const label = (row.label ?? row.name ?? '').trim();
    const time = row.etime ?? row.time ?? '';
    const pace = (row.pace ?? '—').trim();

    if (label && time) splits.push({ label, chipTime: time, pace });

    const d = distToMiles(row.dist, row.units);
    if (d != null && (maxDistMi == null || d > maxDistMi)) maxDistMi = d;

    const sec = parseHmsToSec(time);
    if (sec != null && (maxElapsedSec == null || sec > maxElapsedSec)) maxElapsedSec = sec;

    if (/finish/i.test(label) || /finish/i.test(row.loc ?? '')) finished = true;
  }

  const pending = data.info?.loc?.[pid]?.pending;
  const hasPending = !!pending && Object.keys(pending).length > 0;
  const noResults = data.error?.type === 'no_results';

  let status: RtrtSnapshot['status'];
  let distMi = maxDistMi;
  let elapsedSec = maxElapsedSec;

  if (finished) {
    status = 'finished';
    distMi = TOTAL_MI;
  } else if (rows.length > 0 && (maxDistMi != null || maxElapsedSec != null)) {
    status = 'running';
  } else if (hasPending && noResults) {
    status = 'pre';
    distMi = null;
    elapsedSec = null;
  } else if (noResults) {
    // API said no splits but didn't give pending info — could be just before
    // the wave goes off and the cache hasn't refreshed. Treat as pre, not unknown.
    status = 'pre';
    distMi = null;
    elapsedSec = null;
  } else {
    status = 'unknown';
    distMi = null;
    elapsedSec = null;
  }

  return { status, distMi, elapsedSec, splits };
}

// ────────────────────────────────────────────────────────────
// Demo / simulation mode (unchanged from v4 — used by dev simulator)
// ────────────────────────────────────────────────────────────

export type DemoStage = 'pre' | 'early' | 'park' | 'ocean' | 'late' | 'finish';

const DEMO_PROFILES: Record<DemoStage, { mi: number; sec: number; status: RtrtSnapshot['status'] }> = {
  pre:    { mi: 0.0,  sec: 0,     status: 'pre' },
  early:  { mi: 3.0,  sec: 1200,  status: 'running' },
  park:   { mi: 6.2,  sec: 2580,  status: 'running' },
  ocean:  { mi: 9.3,  sec: 3840,  status: 'running' },
  late:   { mi: 11.0, sec: 4500,  status: 'running' },
  finish: { mi: 13.11, sec: 5292, status: 'finished' },
};

export function demoSnapshot(
  stage: DemoStage,
  paceFactor = 1,
): Omit<RtrtSnapshot, 'fetchedAt' | 'source'> {
  const p = DEMO_PROFILES[stage];
  return {
    status: p.status,
    distMi: p.mi,
    elapsedSec: Math.round(p.sec * paceFactor),
    splits: [],
  };
}
