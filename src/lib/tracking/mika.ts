// ============================================================
// tracking/mika.ts — mika:timing live results client
//
// The Bank of America Chicago Marathon publishes live splits on
// results.chicagomarathon.com (mika:timing). It is server-rendered
// HTML with NO CORS headers, so the browser must go through a relay:
// our own Cloudflare Worker in worker-results/ (see its README).
//
// Flow per runner:
//   1. bib → idp   (search page, cached forever: idp is stable)
//   2. idp → detail page → parseMikaDetail() → snapshot
//
// Between timing mats (every 5K + miles 20–25.2) we extrapolate the
// runner's position from her latest segment pace, so the map marker
// keeps moving instead of jumping every ~20 minutes.
// ============================================================
import type { RtrtSnapshot, RtrtSplit } from '../rtrt';

const KM_TO_MI = 0.621371;
const HALF_MI = 13.1094;
const FETCH_TIMEOUT_MS = 9_000;

export interface MikaParseOptions {
  /** Race date YYYY-MM-DD — anchors the "Start Time" clock value. */
  raceDate: string;
  /** IANA tz of the race (start clock is local wall time). */
  tz: string;
  /** Total course miles. */
  totalMi: number;
  /** Fallback pace (s/mi) when no split has been recorded yet. */
  fallbackPaceSec: number;
  /** Override now (ms) — tests only. */
  nowMs?: number;
}

export interface MikaSplitRow {
  label: string;
  mi: number;
  /** Elapsed chip seconds at this mat, null if not reached. */
  sec: number | null;
  pace: string;
}

export interface MikaParsed extends Omit<RtrtSnapshot, 'fetchedAt' | 'source'> {
  name: string | null;
  bib: string | null;
  /** Start-mat crossing as epoch ms, if recorded. */
  startEpochMs: number | null;
  finishSec: number | null;
  /** Official predicted finish (chip), seconds. */
  predictedFinishSec: number | null;
  lastSplit: string | null;
  rows: MikaSplitRow[];
  /** True when distMi is extrapolated between mats. */
  estimated: boolean;
}

// ────────────────────────────────────────────────────────────
// Small parsing helpers (regex — runs in browser, Node, tests)
// ────────────────────────────────────────────────────────────

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;|&#8211;/g, '–')
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "HH:MM:SS" / "H:MM:SS" / "MM:SS" → seconds; dashes/blank → null. */
export function hmsToSec(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const sec = m[3] != null ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
  return sec > 0 ? sec : null;
}

/** Value of `<td class="f-FIELD ...">…</td>` anywhere in the page. */
function field(html: string, f: string): string | null {
  const re = new RegExp(`<td[^>]*class="[^"]*\\bf-${f}\\b[^"]*"[^>]*>([\\s\\S]*?)</td>`);
  const m = html.match(re);
  if (!m) return null;
  const v = stripTags(m[1]);
  return v && v !== '–' && v !== '—' && v !== '-' ? v : null;
}

/** Split label → course miles. */
export function splitLabelToMiles(label: string, totalMi: number): number | null {
  const l = label.trim();
  let m = l.match(/^0?(\d{1,2})\s*K$/i);
  if (m) return +m[1] * KM_TO_MI;
  if (/^half/i.test(l)) return HALF_MI;
  m = l.match(/^mile\s*(\d{1,2}(?:\.\d+)?)$/i);
  if (m) return +m[1];
  if (/finish/i.test(l)) return totalMi;
  return null;
}

/** Epoch ms of a local wall-clock time on the race date in `tz`. */
export function localClockToEpoch(date: string, clock: string, tz: string): number | null {
  const m = clock.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = +m[1];
  const ap = m[4]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  const [y, mo, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, +m[2], +(m[3] ?? 0));
  // Resolve tz offset at that instant.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(guess));
  const g = (t: string) => +(parts.find(p => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return guess - (asUtc - guess);
}

// ────────────────────────────────────────────────────────────
// Detail-page parser (pure)
// ────────────────────────────────────────────────────────────

export function parseMikaDetail(html: string, opts: MikaParseOptions): MikaParsed {
  const nowMs = opts.nowMs ?? Date.now();
  const name = field(html, '__fullname');
  const bib = field(html, 'start_no_text') ?? field(html, 'start_no');
  const startClock = field(html, 'starttime_net');
  const finishSec = hmsToSec(field(html, 'time_finish_netto'));
  const predictedFinishSec = hmsToSec(field(html, '__estimated_finish'));
  const lastSplit = field(html, '__last_split_name');
  const raceStatus = (field(html, '__race_status') ?? '').toLowerCase();

  // Splits table rows.
  const splitsBox = html.match(/box-splits[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  const rows: MikaSplitRow[] = [];
  if (splitsBox) {
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let r: RegExpExecArray | null;
    while ((r = rowRe.exec(splitsBox[1]))) {
      const cells = r[1];
      const label = stripTags(cells.match(/<th[^>]*class="[^"]*\bdesc\b[^"]*"[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? '');
      if (!label) continue;
      const mi = splitLabelToMiles(label, opts.totalMi);
      if (mi == null) continue;
      const timeRaw = stripTags(cells.match(/<td[^>]*class="time"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? '');
      const paceRaw = stripTags(cells.match(/<td[^>]*class="min_mile[^"]*"[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? '');
      const sec = hmsToSec(timeRaw);
      rows.push({ label, mi, sec, pace: sec && paceRaw && paceRaw !== '00:00' ? `${paceRaw} /mi` : '—' });
    }
  }

  const reached = rows.filter(r => r.sec != null).sort((a, b) => a.mi - b.mi);
  const last = reached.at(-1) ?? null;
  const startEpochMs = startClock ? localClockToEpoch(opts.raceDate, startClock, opts.tz) : null;

  const splits: RtrtSplit[] = reached
    .filter(r => r.label.toLowerCase() !== 'finish' || finishSec != null)
    .map(r => ({ label: r.label, chipTime: fmt(r.sec!), pace: r.pace }));

  const base = { name, bib, startEpochMs, finishSec, predictedFinishSec, lastSplit, rows, splits };

  // ── Finished ──────────────────────────────────────────────
  const finishRow = reached.find(r => /finish/i.test(r.label));
  const fin = finishSec ?? finishRow?.sec ?? null;
  if (fin != null || /finish/.test(raceStatus)) {
    return { ...base, status: 'finished', distMi: opts.totalMi, elapsedSec: fin, estimated: false };
  }

  // ── Not started ───────────────────────────────────────────
  if (!startEpochMs && reached.length === 0) {
    return { ...base, status: /dns|did not/.test(raceStatus) ? 'unknown' : 'pre', distMi: null, elapsedSec: null, estimated: false };
  }

  // ── Running ───────────────────────────────────────────────
  let elapsedSec: number;
  if (startEpochMs && nowMs > startEpochMs) {
    elapsedSec = Math.floor((nowMs - startEpochMs) / 1000);
  } else {
    elapsedSec = last?.sec ?? 0;
  }
  if (last && elapsedSec < last.sec!) elapsedSec = last.sec!;

  // Segment pace: latest mat-to-mat pace, else average, else fallback.
  let paceSec = opts.fallbackPaceSec;
  if (reached.length >= 2) {
    const a = reached.at(-2)!, b = reached.at(-1)!;
    const p = (b.sec! - a.sec!) / (b.mi - a.mi);
    if (Number.isFinite(p) && p > 180 && p < 1800) paceSec = p;
  } else if (last && last.sec) {
    const p = last.sec / last.mi;
    if (p > 180 && p < 1800) paceSec = p;
  }

  const fromMi = last?.mi ?? 0;
  const fromSec = last?.sec ?? 0;
  const nextMat = rows.find(r => r.mi > fromMi + 0.01)?.mi ?? opts.totalMi;
  // Never project past the next mat she hasn't crossed (minus a hair).
  const cap = Math.min(nextMat - 0.05, opts.totalMi - 0.05);
  const projected = fromMi + Math.max(0, elapsedSec - fromSec) / paceSec;
  const distMi = Math.max(fromMi, Math.min(projected, cap));

  return { ...base, status: 'running', distMi, elapsedSec, estimated: distMi > fromMi + 1e-6 };
}

function fmt(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Pull the participant idp out of a search-results page. */
export function parseIdpFromSearch(html: string): string | null {
  const m = html.match(/content=detail[^"'<>]*?idp=([A-Z0-9]{6,})/);
  return m ? m[1] : null;
}

// ────────────────────────────────────────────────────────────
// Network (via relay)
// ────────────────────────────────────────────────────────────

/** Where the relay lives. Override at runtime: localStorage.resultsProxy = 'https://…' */
export function resultsProxyBase(): string | null {
  try {
    const ls = typeof localStorage !== 'undefined' ? localStorage.getItem('resultsProxy') : null;
    if (ls) return ls.replace(/\/+$/, '');
  } catch { /* ignore */ }
  const env = (import.meta as any).env?.VITE_RESULTS_PROXY as string | undefined;
  if (env) return env.replace(/\/+$/, '');
  return defaultRelay ? defaultRelay.replace(/\/+$/, '') : null;
}

let defaultRelay: string | null = null;
/** Set by the provider dispatcher from races.ts. */
export function setDefaultRelay(url: string | null | undefined): void { defaultRelay = url ?? null; }

async function getText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

/** Fetch a results-site page through the relay (or directly, if CORS ever opens). */
export async function fetchResultsPage(target: string): Promise<string> {
  const proxy = resultsProxyBase();
  const candidates = proxy ? [`${proxy}/?url=${encodeURIComponent(target)}`, target] : [target];
  let lastErr: unknown;
  for (const u of candidates) {
    try { return await getText(u); } catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('unreachable');
}

const idpCache = new Map<string, string>();

function idpKey(base: string, event: string, bib: string) { return `mikaIdp:${base}|${event}|${bib}`; }

export async function lookupIdp(base: string, event: string, bib: string): Promise<string | null> {
  const key = idpKey(base, event, bib);
  if (idpCache.has(key)) return idpCache.get(key)!;
  try {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (cached) { idpCache.set(key, cached); return cached; }
  } catch { /* ignore */ }
  const url = `${base}?pid=search&pidp=start&lang=EN_CAP&event=${encodeURIComponent(event)}&search_event=${encodeURIComponent(event)}&search%5Bstart_no%5D=${encodeURIComponent(bib)}`;
  const idp = parseIdpFromSearch(await fetchResultsPage(url));
  if (idp) {
    idpCache.set(key, idp);
    try { localStorage.setItem(key, idp); } catch { /* ignore */ }
  }
  return idp;
}

export function detailUrl(base: string, event: string, idp: string): string {
  return `${base}?content=detail&idp=${encodeURIComponent(idp)}&event=${encodeURIComponent(event)}&lang=EN_CAP&pid=search`;
}

/** Public "open in official tracker" link for a bib. */
export function publicRunnerUrl(base: string, event: string, bib: string): string {
  return `${base}?pid=search&pidp=start&lang=EN_CAP&event=${encodeURIComponent(event)}&search_event=${encodeURIComponent(event)}&search%5Bstart_no%5D=${encodeURIComponent(bib)}`;
}

export async function fetchMikaRunner(
  base: string, event: string, bib: string, opts: MikaParseOptions,
): Promise<(MikaParsed & { fetchedAt: number; source: string }) | null> {
  if (!bib) return null;
  try {
    const idp = await lookupIdp(base, event, bib);
    if (!idp) return null;
    const html = await fetchResultsPage(detailUrl(base, event, idp));
    const parsed = parseMikaDetail(html, opts);
    return { ...parsed, fetchedAt: Date.now(), source: 'mika' };
  } catch {
    return null;
  }
}
