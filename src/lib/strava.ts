// ============================================================
// strava.ts — Client for the Blizzard Tracker Strava worker.
//
// The Cloudflare Worker (worker/worker.js) owns the OAuth tokens
// and exposes a slim summary endpoint. This module fetches it and
// hands the Training tab data in the exact shapes trainingSample.ts
// uses — so the tab renders identically from sample or live data.
//
// Not configured / not connected / fetch failed → callers fall back
// to sample data. No live mid-run tracking by design: data appears
// after each run syncs Garmin → Strava.
// ============================================================
import type { WeeklyMileage, RecentRun, TrainingLocation } from './trainingSample';

export type AthleteKey = 'gf' | 'mom';

export interface TrainingSummary {
  connected: boolean;
  athlete: AthleteKey;
  firstname?: string;
  fetchedAt?: number;
  weekly?: WeeklyMileage[];
  recent?: RecentRun[];
  locations?: TrainingLocation[];
}

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Worker base URL. Priority:
 *  1. localStorage 'stravaApiBase' (handy for testing without rebuilding)
 *  2. VITE_STRAVA_API_BASE baked in at build time (GitHub Actions variable)
 *  3. '' → not configured, Training tab shows sample data + setup hint
 */
export function stravaApiBase(): string {
  try {
    const ls = localStorage.getItem('stravaApiBase');
    if (ls) return ls.replace(/\/+$/, '');
  } catch { /* SSR / privacy mode */ }
  const env = (import.meta as any).env?.VITE_STRAVA_API_BASE as string | undefined;
  return env ? env.replace(/\/+$/, '') : '';
}

export function stravaConfigured(): boolean {
  return stravaApiBase().length > 0;
}

/** URL the runner opens to grant access (worker redirects to Strava OAuth). */
export function stravaConnectUrl(athlete: AthleteKey): string {
  return `${stravaApiBase()}/auth/${athlete}`;
}

async function getJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Which athletes have connected their Strava. Null if worker unreachable. */
export async function fetchStravaStatus(): Promise<Record<AthleteKey, boolean> | null> {
  if (!stravaConfigured()) return null;
  return getJson(`${stravaApiBase()}/api/status`);
}

/** Full training summary for one athlete. Null = unavailable (treat as sample). */
export async function fetchTrainingSummary(athlete: AthleteKey): Promise<TrainingSummary | null> {
  if (!stravaConfigured()) return null;
  const data = await getJson<TrainingSummary>(`${stravaApiBase()}/api/summary?athlete=${athlete}`);
  if (!data || !data.connected || !data.weekly) return null;
  return data;
}
