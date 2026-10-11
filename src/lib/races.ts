// ============================================================
// races.ts — THE race registry. One file to touch per race.
//
// Starting a new race:
//   1. Move the current entry's results into ARCHIVE (newest first)
//      once official chip times are in.
//   2. Replace CURRENT_RACE with the new race (date, tz, waves,
//      tracking provider, bibs per runner, theme).
//   3. Drop the new course GPX into src/lib/course.gpx (keep the old
//      one as course-<id>.gpx for reference).
//   4. Update goals in runners.ts DEFAULT_GOALS.
// Storage is namespaced by CURRENT_RACE.id, so stale pace traces and
// goals from the previous race can never leak into the new one.
// ============================================================

export type TrackingProvider =
  /** mika:timing results sites (Chicago, Berlin, Boston, …). */
  | { type: 'mika'; base: string; event: string; label: string; publicUrl: string }
  /** RTRT.me JSON API (NYRR races, many US events). */
  | { type: 'rtrt'; eventId: string; label: string; publicUrl: string }
  /** No live feed — the app projects position from goal pace. */
  | { type: 'none'; label: string; publicUrl?: string };

export interface RaceWave {
  wave: number;
  /** Local wall-clock start, HH:MM (24h) in the race's timezone. */
  start: string;
}

export interface RaceTheme {
  /** Primary accent (buttons, links). */
  accent: string;
  /** Secondary accent (stars, highlights). */
  accent2: string;
  /** Hero gradient. */
  gradient: string;
  /** Short motif rendered in the header / hero. */
  motif: 'chicago' | 'brooklyn' | 'none';
}

export interface CurrentRace {
  id: string;
  name: string;
  shortName: string;
  city: string;
  /** ISO date YYYY-MM-DD. */
  date: string;
  /** IANA timezone of the race. */
  tz: string;
  /** Short TZ label for display (CT, ET, …). */
  tzLabel: string;
  /** First gun (pro start) as a full ISO timestamp with offset. */
  gunISO: string;
  distanceMi: number;
  waves: RaceWave[];
  tracking: TrackingProvider;
  /** Bib (or tracker id) per runner id. Empty string = not known yet. */
  bibs: Record<string, string>;
  theme: RaceTheme;
  hashtag: string;
}

export interface ArchivedResult {
  emoji: string;
  name: string;
  color: string;
  goal: string;
  /** Official chip time, or null if not recorded. */
  time: string | null;
  note?: string;
}

export interface ArchivedRace {
  id: string;
  name: string;
  date: string;
  dateLabel: string;
  distance: string;
  course: string;
  summary: string;
  results: ArchivedResult[];
  resultsHref?: string;
}

// ────────────────────────────────────────────────────────────
// Current race
// ────────────────────────────────────────────────────────────

export const CURRENT_RACE: CurrentRace = {
  id: 'chi2026',
  name: 'Bank of America Chicago Marathon 2026',
  shortName: 'Chicago Marathon',
  city: 'Chicago',
  date: '2026-10-11',
  tz: 'America/Chicago',
  tzLabel: 'CT',
  // Pros at 7:30 AM CDT. Waves per the official race-day schedule.
  gunISO: '2026-10-11T07:30:00-05:00',
  distanceMi: 26.2188,
  waves: [
    { wave: 1, start: '07:35' },
    { wave: 2, start: '08:00' },
    { wave: 3, start: '08:35' },
  ],
  tracking: {
    type: 'mika',
    base: 'https://results.chicagomarathon.com/2026/',
    event: 'MAR',
    label: 'Official results · mika:timing',
    publicUrl: 'https://results.chicagomarathon.com/2026/',
  },
  bibs: {
    gf: '15749',  // Catherine — from results.chicagomarathon.com/2026
    mom: '36364', // Helaine
  },
  theme: {
    // Chicago flag: light blue bars + red six-pointed stars.
    accent: '#0B7FC1',
    accent2: '#E4002B',
    gradient: 'linear-gradient(135deg, #41B6E6 0%, #0B7FC1 55%, #0A3D62 100%)',
    motif: 'chicago',
  },
  hashtag: '#ChicagoMarathon',
};

// ────────────────────────────────────────────────────────────
// Archive — frozen snapshots, newest first
// ────────────────────────────────────────────────────────────

export const ARCHIVE: ArchivedRace[] = [
  {
    id: 'bkh2026',
    name: 'RBC Brooklyn Half 2026',
    date: '2026-05-16',
    dateLabel: 'Saturday, May 16, 2026 · 7:00 AM ET',
    distance: '13.1 mi',
    course: 'Brooklyn Museum → Grand Army Plaza → Prospect Park → Ocean Pkwy → Coney Island Boardwalk',
    summary: 'The race this tracker was originally built for — mother and daughter on the same start line, 246ft of bumps, finish by the Atlantic.',
    results: [
      { emoji: '💙', name: 'Catherine Blizzard', color: '#007AFF', goal: 'Sub-1:32 (PR attempt)', time: '1:30:28', note: 'Half PR · 6:54/mi — goal beaten by 1:32' },
      { emoji: '⚡', name: 'Helaine Blizzard',   color: '#FF2D55', goal: 'Sub-1:50',             time: '1:50:03', note: '8:24/mi at 62 — 3 seconds off the goal' },
    ],
    resultsHref: 'https://results.nyrr.org/',
  },
];

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** UTC offset (minutes) of `tz` at the given instant, e.g. -300 for CDT. */
function tzOffsetMin(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => +(parts.find(p => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Absolute start instant of a wave on race day. */
export function waveStart(race: CurrentRace, wave: number): Date {
  const w = race.waves.find(x => x.wave === wave) ?? race.waves[0];
  const [h, m] = w.start.split(':').map(Number);
  const gun = new Date(race.gunISO);
  const off = tzOffsetMin(race.tz, gun);
  const [y, mo, d] = race.date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m) - off * 60_000);
}

/** Minutes between the pro gun and a wave's start. */
export function waveOffsetMin(race: CurrentRace, wave: number): number {
  return Math.round((waveStart(race, wave).getTime() - new Date(race.gunISO).getTime()) / 60_000);
}
