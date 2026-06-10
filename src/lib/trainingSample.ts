// ============================================================
// trainingSample.ts — Training-data type definitions.
//
// Historical note: this file used to ship hand-written sample
// training data. That's gone by design — the Training tab now
// shows REAL Strava data or an honest empty state, never fakes.
// The shapes below are the contract between the Cloudflare
// Worker (worker/worker.js) and the client (src/lib/strava.ts).
// ============================================================

export interface TrainingLocation {
  /** Lat/lng (decimal degrees). */
  lat: number;
  lng: number;
  /** Display name shown in the map tooltip. */
  name: string;
  /** Run count from this location — drives marker size + heat intensity. */
  runs: number;
  /** Optional notes ("home base", race city, etc.). */
  note?: string;
}

export interface WeeklyMileage {
  /** Sunday of the week, YYYY-MM-DD. */
  weekOf: string;
  /** Miles by workout type. */
  easy: number;
  tempo: number;
  long: number;
  workout: number;
}

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

/** Bank of America Chicago Marathon start (Grant Park). */
export const CHICAGO_RACE_LOCATION = { lat: 41.8761, lng: -87.6230, name: 'Chicago Marathon · Oct 11, 2026' };
