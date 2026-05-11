// ============================================================
// trainingSample.ts — Sample / placeholder training data.
//
// Lives entirely in code today. Once we wire Strava (see
// docs/GARMIN_PLAN.md), this file gets deleted and the same
// shapes get pulled from the Worker API instead.
// ============================================================

export interface TrainingLocation {
  /** Lat/lng (decimal degrees). */
  lat: number;
  lng: number;
  /** Display name shown in the map tooltip. */
  name: string;
  /** Approximate run count from this location — drives marker size. */
  runs: number;
  /** Optional notes ("home base", race city, etc.). */
  note?: string;
}

/**
 * Catherine's training geography per Leon: most NYC, second-most St.
 * Peter-Ording (Germany, North Sea coast), plus a scatter of European
 * cities + Middlebury VT. All numbers are illustrative until we plug
 * in real Strava data.
 */
export const CATHERINE_TRAINING: ReadonlyArray<TrainingLocation> = [
  { lat: 40.7831, lng: -73.9712, name: 'New York City (Central Park, Brooklyn)', runs: 180, note: 'Home base' },
  { lat: 54.3169, lng:   8.6353, name: 'St. Peter-Ording, Germany',              runs:  42, note: 'North Sea beach long runs' },
  { lat: 51.5938, lng:   8.6817, name: 'Madfeld, Germany',                       runs:  18 },
  { lat: 48.1351, lng:  11.5820, name: 'Munich, Germany',                        runs:  12 },
  { lat: 51.5074, lng:  -0.1278, name: 'London, UK',                             runs:   8 },
  { lat: 52.3676, lng:   4.9041, name: 'Amsterdam, NL',                          runs:   6 },
  { lat: 47.4979, lng:  19.0402, name: 'Budapest, HU',                           runs:   4 },
  { lat: 46.9481, lng:   7.4474, name: 'Bern, Switzerland',                      runs:   5 },
  { lat: 44.0123, lng: -73.1671, name: 'Middlebury, VT',                         runs:   9 },
];

/**
 * Helaine's geography: anchored in Dallas, with most other markers
 * being the cities of her actual race history (the same locations
 * Leon's data already lists).
 */
export const HELAINE_TRAINING: ReadonlyArray<TrainingLocation> = [
  { lat: 32.7767, lng:  -96.7970, name: 'Dallas, TX',                  runs: 280, note: 'Home base' },
  { lat: 42.3601, lng:  -71.0589, name: 'Boston, MA',                  runs:  14 },
  { lat: 40.7128, lng:  -74.0060, name: 'New York, NY',                runs:  12 },
  { lat: 41.8781, lng:  -87.6298, name: 'Chicago, IL',                 runs:   7 },
  { lat: 51.5074, lng:   -0.1278, name: 'London, UK',                  runs:   4 },
  { lat: 52.5200, lng:   13.4050, name: 'Berlin, Germany',             runs:   3 },
  { lat: 35.4676, lng:  -97.5164, name: 'Oklahoma City, OK',           runs:   8 },
  { lat: 44.3386, lng:  -68.2733, name: 'Mount Desert Island, ME',     runs:   3 },
  { lat: 44.0521, lng: -123.0868, name: 'Eugene, OR',                  runs:   5 },
  { lat: 36.5552, lng: -121.9233, name: 'Carmel, CA (Big Sur)',        runs:   3 },
  { lat: 38.9072, lng:  -77.0369, name: 'Washington, DC',              runs:   6 },
  { lat: 32.7765, lng:  -79.9311, name: 'Charleston, SC',              runs:   2 },
  { lat: 44.4759, lng:  -73.2121, name: 'Burlington, VT',              runs:   2 },
];

/** Bank of America Chicago Marathon start (Grant Park). */
export const CHICAGO_RACE_LOCATION = { lat: 41.8761, lng: -87.6230, name: 'Chicago Marathon · Oct 11, 2026' };

// ────────────────────────────────────────────────────────────
// Sample weekly mileage — last 12 weeks of imaginary training.
// ────────────────────────────────────────────────────────────

export interface WeeklyMileage {
  /** Sunday of the week, YYYY-MM-DD. */
  weekOf: string;
  /** Miles by workout type. */
  easy: number;
  tempo: number;
  long: number;
  workout: number;
}

/** Build a 12-week sample series with a tapered ramp. */
function sampleWeeks(base: number, jitter: number): WeeklyMileage[] {
  const out: WeeklyMileage[] = [];
  // Anchor the most-recent week at "today" (race week) and walk back.
  const ref = new Date('2026-05-10T00:00:00-04:00');
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ref);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const taper = i <= 1 ? 0.55 : i <= 3 ? 0.85 : 1.0; // taper last two weeks
    const total = (base + (Math.sin(i) * jitter)) * taper;
    const easy = Math.round(total * 0.55);
    const tempo = Math.round(total * 0.18);
    const long = Math.round(total * 0.22);
    const workout = Math.max(0, Math.round(total - easy - tempo - long));
    out.push({ weekOf: d.toISOString().slice(0, 10), easy, tempo, long, workout });
  }
  return out;
}

export const CATHERINE_WEEKLY = sampleWeeks(48, 6);
export const HELAINE_WEEKLY   = sampleWeeks(30, 4);

// ────────────────────────────────────────────────────────────
// Sample recent runs — last 5, newest first.
// ────────────────────────────────────────────────────────────

export interface RecentRun {
  date: string;
  type: 'easy' | 'tempo' | 'long' | 'workout' | 'race';
  distanceMi: number;
  paceSecPerMile: number;
  hrAvg?: number;
  elevationFt?: number;
  city: string;
  notes?: string;
}

export const CATHERINE_RUNS: ReadonlyArray<RecentRun> = [
  { date: '2026-05-09', type: 'easy',    distanceMi:  5.0, paceSecPerMile: 8 * 60 + 12, hrAvg: 142, city: 'New York City',           notes: 'Shakeout · Central Park loop' },
  { date: '2026-05-07', type: 'workout', distanceMi:  7.2, paceSecPerMile: 6 * 60 + 48, hrAvg: 168, city: 'New York City',           notes: '4×1mi @ goal · 90s rest' },
  { date: '2026-05-05', type: 'easy',    distanceMi:  6.4, paceSecPerMile: 8 * 60 + 5,  hrAvg: 140, city: 'New York City' },
  { date: '2026-05-03', type: 'long',    distanceMi: 14.0, paceSecPerMile: 7 * 60 + 40, hrAvg: 156, city: 'New York City',           notes: 'Last long run · Brooklyn-side loop' },
  { date: '2026-04-30', type: 'tempo',   distanceMi:  8.5, paceSecPerMile: 6 * 60 + 56, hrAvg: 164, city: 'New York City',           notes: '5 mi @ HMP' },
];

export const HELAINE_RUNS: ReadonlyArray<RecentRun> = [
  { date: '2026-05-09', type: 'easy', distanceMi:  4.0, paceSecPerMile: 9 * 60 + 50, hrAvg: 138, city: 'Dallas', notes: 'Shakeout · White Rock loop' },
  { date: '2026-05-07', type: 'tempo', distanceMi: 6.0, paceSecPerMile: 8 * 60 + 35, hrAvg: 160, city: 'Dallas', notes: '4 mi @ HMP' },
  { date: '2026-05-05', type: 'easy', distanceMi:  5.0, paceSecPerMile: 9 * 60 + 30, hrAvg: 140, city: 'Dallas' },
  { date: '2026-05-03', type: 'long', distanceMi: 10.0, paceSecPerMile: 9 * 60 + 10, hrAvg: 150, city: 'Dallas', notes: 'Last long run · Katy Trail' },
  { date: '2026-04-30', type: 'easy', distanceMi:  4.5, paceSecPerMile: 9 * 60 + 45, hrAvg: 137, city: 'Dallas' },
];
