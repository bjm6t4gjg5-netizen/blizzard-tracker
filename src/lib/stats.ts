// ============================================================
// stats.ts — Field stats: percentiles, age groups, demographics
//
// Numbers are estimates derived from RBC Brooklyn Half 2024 / 2025
// public results. Marked "est." in the UI.
// ============================================================

/** Overall RBC Brooklyn Half field. [finishSeconds, percentOfFieldAtOrUnder]. */
export const FIELD_CDF: ReadonlyArray<[number, number]> = [
  [4_800, 1], [5_400, 3], [5_700, 6], [6_000, 11], [6_300, 18],
  [6_600, 26], [6_900, 35], [7_200, 45], [7_500, 54], [7_800, 62],
  [8_100, 69], [8_400, 75], [8_700, 80], [9_000, 85], [9_600, 90],
  [10_200, 94], [10_800, 97], [11_400, 99],
];

/** Women-only sub-population. Lifted a few minutes slower at each rank. */
export const WOMEN_FIELD_CDF: ReadonlyArray<[number, number]> = [
  [5_400, 1], [5_700, 2], [6_000, 4], [6_300, 8], [6_600, 13],
  [6_900, 19], [7_200, 27], [7_500, 36], [7_800, 45], [8_100, 54],
  [8_400, 62], [8_700, 70], [9_000, 77], [9_300, 82], [9_900, 89],
  [10_500, 93], [11_100, 96], [11_700, 98],
];

/** Men-only sub-population. ~10–15 min faster than women at each percentile. */
export const MEN_FIELD_CDF: ReadonlyArray<[number, number]> = [
  [4_500, 1], [5_100, 3], [5_400, 7], [5_700, 13], [6_000, 22],
  [6_300, 32], [6_600, 43], [6_900, 54], [7_200, 64], [7_500, 73],
  [7_800, 80], [8_100, 86], [8_400, 90], [8_700, 93], [9_300, 96],
  [9_900, 98], [10_500, 99],
];

/**
 * Returns the runner's percentile (1 = top of field) for a given finish time.
 * Pass a gender to use the male/female sub-CDF; default is the overall field.
 */
export function percentileFor(sec: number, gender?: 'F' | 'M'): number {
  const cdf =
    gender === 'F' ? WOMEN_FIELD_CDF :
    gender === 'M' ? MEN_FIELD_CDF :
    FIELD_CDF;
  if (!Number.isFinite(sec) || sec <= 0) return 100;
  if (sec <= cdf[0][0]) return cdf[0][1];
  for (let i = 0; i < cdf.length - 1; i++) {
    const [a, pa] = cdf[i];
    const [b, pb] = cdf[i + 1];
    if (sec <= b) {
      const t = (sec - a) / (b - a);
      return Math.round(pa + (pb - pa) * t);
    }
  }
  return 99;
}

export interface AgeGroupBand {
  range: string;
  median: number;
  label: string;
}

export const WOMEN_AGE_GROUPS: ReadonlyArray<AgeGroupBand> = [
  { range: '18–24', median: 7620,  label: '2:07:00' },
  { range: '25–29', median: 7800,  label: '2:10:00' },
  { range: '30–34', median: 8040,  label: '2:14:00' },
  { range: '35–39', median: 8280,  label: '2:18:00' },
  { range: '40–44', median: 8460,  label: '2:21:00' },
  { range: '45–49', median: 8700,  label: '2:25:00' },
  { range: '50–54', median: 9120,  label: '2:32:00' },
  { range: '55–59', median: 9540,  label: '2:39:00' },
  { range: '60–64', median: 10260, label: '2:51:00' },
  { range: '65+',   median: 11400, label: '3:10:00' },
];

export const MEN_AGE_GROUPS: ReadonlyArray<AgeGroupBand> = [
  { range: '18–24', median: 6720,  label: '1:52:00' },
  { range: '25–29', median: 6780,  label: '1:53:00' },
  { range: '30–34', median: 6900,  label: '1:55:00' },
  { range: '35–39', median: 7080,  label: '1:58:00' },
  { range: '40–44', median: 7260,  label: '2:01:00' },
  { range: '45–49', median: 7500,  label: '2:05:00' },
  { range: '50–54', median: 7800,  label: '2:10:00' },
  { range: '55–59', median: 8220,  label: '2:17:00' },
  { range: '60–64', median: 8820,  label: '2:27:00' },
  { range: '65+',   median: 9720,  label: '2:42:00' },
];

export const FIELD_HEADLINES = {
  finishers: 28_500,
  overallMedianSec: 8040,   // ~2:14:00
  womensWinnerSec: 4537,    // 1:15:37
  womensMedianSec: 8400,    // ~2:20:00
  elevationPenaltyPct: 1.9,
  typicalRaceTempF: 62,
};

/** Compute the runner's age in years on race day from a YYYY-MM-DD birthday. */
export function ageOnRaceDay(birthISO: string, raceDate: Date): number | null {
  const m = birthISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const birth = new Date(`${birthISO}T12:00:00Z`);
  let age = raceDate.getUTCFullYear() - birth.getUTCFullYear();
  const md = (raceDate.getUTCMonth() - birth.getUTCMonth()) || (raceDate.getUTCDate() - birth.getUTCDate());
  if (md < 0) age -= 1;
  return age;
}

export function ageGroupFor(age: number, gender: 'F' | 'M' = 'F'): AgeGroupBand | null {
  if (age < 18) return null;
  const table = gender === 'M' ? MEN_AGE_GROUPS : WOMEN_AGE_GROUPS;
  if (age <= 24) return table[0];
  if (age <= 29) return table[1];
  if (age <= 34) return table[2];
  if (age <= 39) return table[3];
  if (age <= 44) return table[4];
  if (age <= 49) return table[5];
  if (age <= 54) return table[6];
  if (age <= 59) return table[7];
  if (age <= 64) return table[8];
  return table[9];
}

/** Histogram bins for the finish-time distribution chart. */
export const DISTRIBUTION_BINS: ReadonlyArray<{ label: string; centerSec: number; share: number }> = [
  { label: '<1:30', centerSec: 5_100,  share: 0.06 },
  { label: '1:30',  centerSec: 5_700,  share: 0.05 },
  { label: '1:40',  centerSec: 6_300,  share: 0.07 },
  { label: '1:50',  centerSec: 6_900,  share: 0.10 },
  { label: '2:00',  centerSec: 7_500,  share: 0.14 },
  { label: '2:10',  centerSec: 8_100,  share: 0.16 },
  { label: '2:20',  centerSec: 8_700,  share: 0.13 },
  { label: '2:30',  centerSec: 9_300,  share: 0.10 },
  { label: '2:45',  centerSec: 10_200, share: 0.09 },
  { label: '3:00+', centerSec: 11_400, share: 0.10 },
];
