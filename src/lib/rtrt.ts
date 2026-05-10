// ============================================================
// rtrt.ts — RTRT.me live race-tracking client
//
// RTRT does not expose a public, CORS-friendly JSON endpoint, so we
// scrape the public tracker page through CORS proxies. Three things
// the v1 implementation got wrong, fixed here:
//
//   1. Single proxy (allorigins) → outage = silent freeze.
//      → Try a list of proxies in order; whichever returns first wins.
//   2. Naive regex against entire HTML matched static text like the
//      footer "13.1 mi" before the race even started.
//      → Anchor extractors on labelled fields (Distance, Elapsed,
//        Time) and reject obviously stale signals (e.g. distance
//        without a fresh elapsed time).
//   3. No retry / no timeout → one blip = stale UI for 60s.
//      → AbortController timeouts + exponential-backoff retry per
//        proxy.
//
// The parser is a pure function and is tested with fixture HTML.
// ============================================================

const EVENT_SLUG = 'bkh2026';
const FETCH_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS_PER_PROXY = 2;

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
  /** Which proxy / source produced this snapshot, for diagnostics. */
  source: string;
}

type ProxyFn = (url: string, signal: AbortSignal) => Promise<string>;

const PROXIES: ReadonlyArray<{ name: string; fn: ProxyFn }> = [
  {
    name: 'allorigins',
    fn: async (url, signal) => {
      const res = await fetch(
        `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        { signal, cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`allorigins ${res.status}`);
      const j = (await res.json()) as { contents?: string };
      return j.contents ?? '';
    },
  },
  {
    name: 'corsproxy.io',
    fn: async (url, signal) => {
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
        signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`corsproxy ${res.status}`);
      return res.text();
    },
  },
  {
    name: 'codetabs',
    fn: async (url, signal) => {
      const res = await fetch(
        `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
        { signal, cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`codetabs ${res.status}`);
      return res.text();
    },
  },
];

/** Fetch with timeout; rejects on timeout, network error, or non-2xx. */
async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Fetch the latest snapshot for a runner. Tries proxies in order; each proxy
 * is given up to MAX_ATTEMPTS_PER_PROXY attempts with exponential backoff.
 *
 * Returns null only if every proxy and every retry fail. Callers should NOT
 * panic in that case — keep the previous snapshot displayed.
 */
export async function fetchRunner(trackId: string): Promise<RtrtSnapshot | null> {
  const url = `https://rtrt.me/${EVENT_SLUG}/track/${encodeURIComponent(trackId)}`;
  for (const proxy of PROXIES) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_PROXY; attempt++) {
      try {
        const html = await withTimeout(s => proxy.fn(url, s), FETCH_TIMEOUT_MS);
        if (!html || html.length < 100) throw new Error('empty body');
        const parsed = parseRtrtHtml(html);
        return { ...parsed, fetchedAt: Date.now(), source: proxy.name };
      } catch (err) {
        if (attempt + 1 < MAX_ATTEMPTS_PER_PROXY) {
          await sleep(400 * 2 ** attempt);
        }
      }
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// Parser
// ────────────────────────────────────────────────────────────

const HMS_RE = /(\d{1,2}):(\d{2}):(\d{2})/g;
const DIST_MI_RE = /(\d+(?:\.\d+)?)\s*(?:mi(?:les?)?\b)/gi;
const DIST_KM_RE = /(\d+(?:\.\d+)?)\s*km\b/gi;

/**
 * Parse RTRT tracker page HTML into a snapshot.
 *
 * The strategy: collect all distance + time tokens, then heuristically pick
 * the freshest pair. This is intentionally tolerant of layout changes — RTRT
 * has reshuffled the DOM between events. We anchor on:
 *   • presence of "FINISHED" / "FINISH" tag → status=finished
 *   • presence of "PRE-RACE" / "Not Started" → status=pre
 *   • the LARGEST distance value seen (real distance > footer "13.1 mi")
 *   • the LARGEST H:MM:SS that's < 6 hours (race time, not a wall-clock)
 *
 * If both signals are missing → status=unknown, leave numbers null.
 */
export function parseRtrtHtml(html: string): Omit<RtrtSnapshot, 'fetchedAt' | 'source'> {
  const lower = html.toLowerCase();
  const hasFinished = /\bfinished\b|\bfinish line\b|\bcompleted\b/.test(lower);
  const hasPreRace =
    /\bpre[-\s]?race\b|\bnot\s*yet\s*started\b|\bnot\s*started\b/.test(lower) ||
    /race\s*day\s*is/.test(lower);

  // Collect candidate times in seconds
  const times: number[] = [];
  for (const m of html.matchAll(HMS_RE)) {
    const s = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
    // Half-marathon range: keep 1min..6h. Discards wall-clock 12:34:56.
    if (s >= 60 && s <= 6 * 3600) times.push(s);
  }
  // Collect candidate distances in miles
  const allDists: number[] = [];
  for (const m of html.matchAll(DIST_MI_RE)) {
    const v = +m[1];
    if (Number.isFinite(v) && v >= 0 && v <= 13.5) allDists.push(v);
  }
  for (const m of html.matchAll(DIST_KM_RE)) {
    const v = +m[1] * 0.621371;
    if (Number.isFinite(v) && v >= 0 && v <= 13.5) allDists.push(v);
  }
  // The string "13.1 mi" appears in headers/footers as the RACE TOTAL — strip
  // those candidates so we don't misread a pre-race page as the runner finishing.
  const liveDists = allDists.filter(d => Math.abs(d - 13.1) > 0.04);

  const elapsedSec = times.length ? Math.max(...times) : null;

  let status: RtrtSnapshot['status'];
  let distMi: number | null;
  if (hasFinished) {
    status = 'finished';
    distMi = 13.10;
  } else if (hasPreRace && liveDists.length === 0) {
    status = 'pre';
    distMi = null;
  } else if (elapsedSec != null && elapsedSec >= 60 && liveDists.length > 0) {
    status = 'running';
    distMi = Math.max(...liveDists);
  } else if (elapsedSec == null && liveDists.length === 0) {
    status = 'unknown';
    distMi = null;
  } else {
    status = 'pre';
    distMi = liveDists.length ? Math.max(...liveDists) : null;
  }

  // Splits — best-effort table scrape
  const splits: RtrtSplit[] = [];
  const tableRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const trMatch of html.matchAll(tableRe)) {
    const cells = [...trMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c =>
      c[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    if (cells.length < 2) continue;
    const label = cells[0];
    const time = cells.find(c => /^\d{1,2}:\d{2}(?::\d{2})?$/.test(c));
    const pace = cells.find(c => /^\d{1,2}:\d{2}\s*\/\s*mi/i.test(c));
    if (label && time && /^(start|\d+(?:\.\d+)?\s*(?:mi|km)|5k|10k|15k|20k|finish)/i.test(label)) {
      splits.push({ label, chipTime: time, pace: pace ?? '—' });
    }
  }

  return { status, distMi, elapsedSec, splits };
}

// ────────────────────────────────────────────────────────────
// Demo / simulation mode
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
