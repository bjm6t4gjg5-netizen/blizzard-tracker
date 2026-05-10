// ============================================================
// format.ts — pure time / pace / number formatters
// All functions are total: they never throw on bad input.
// ============================================================

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** Format seconds as H:MM:SS, or just M:SS if under one hour. */
export function formatHMS(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

/** Format seconds as full H:MM:SS (always shows hour). */
export function formatHMSFull(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return '—:—:—';
  const s = Math.floor(sec);
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Format an average pace from elapsed seconds + miles covered. */
export function formatPace(elapsedSec: number, miles: number): string {
  if (!miles || miles < 0.05 || !Number.isFinite(elapsedSec)) return '—';
  return formatPacePerMile(elapsedSec / miles);
}

/** Format seconds-per-mile as M:SS. */
export function formatPacePerMile(secPerMile: number): string {
  if (!Number.isFinite(secPerMile) || secPerMile <= 0) return '—';
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${pad(s)}`;
}

/** Parse "M:SS" or "MM:SS" pace string into seconds-per-mile. Returns null on failure. */
export function parsePace(str: string): number | null {
  if (typeof str !== 'string') return null;
  const m = str.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const mins = +m[1];
  const secs = +m[2];
  if (!Number.isFinite(mins) || !Number.isFinite(secs) || secs >= 60) return null;
  return mins * 60 + secs;
}

/** Parse "H:MM:SS" or "M:SS" or "MM" goal-time string into total seconds. */
export function parseGoalTime(str: string): number | null {
  if (typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  // Reject anything but digits + colons. Catches '1:bad:00' and '-5'.
  if (!/^\d+(?::\d+)*$/.test(trimmed)) return null;
  const parts = trimmed.split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0] * 60;
  return null;
}

/** Format a distance in miles. */
export function formatMiles(mi: number): string {
  if (!Number.isFinite(mi)) return '—';
  return mi.toFixed(2);
}

/** Format a percentage in [0, 100]. */
export function formatPct(pct: number): string {
  if (!Number.isFinite(pct)) return '—';
  return `${Math.round(pct)}%`;
}
