// ============================================================
// stats.ts — Field stats: percentiles, age groups, demographics
//
// Numbers are estimates derived from Bank of America Chicago
// Marathon 2024 / 2025 public results. Marked "est." in the UI.
// ============================================================

/** Overall Chicago Marathon field. [finishSeconds, percentOfFieldAtOrUnder]. */
export const FIELD_CDF: ReadonlyArray<[number, number]> = [
  [9_600, 1], [10_800, 5], [11_400, 9], [12_000, 13], [12_600, 18],
  [13_200, 24], [13_800, 31], [14_400, 39], [15_000, 46], [15_600, 52],
  [16_200, 58], [17_100, 66], [18_000, 74], [18_900, 80], [19_800, 85],
  [21_600, 93], [23_400, 97], [25_200, 99],
];

/** Women-only sub-population. Shifted ~20–25 min slower at each rank. */
export const WOMEN_FIELD_CDF: ReadonlyArray<[number, number]> = [
  [10_800, 2], [11_700, 4], [12_600, 8], [13_500, 14], [14_400, 22],
  [15_300, 31], [16_200, 41], [17_100, 51], [18_000, 61], [18_900, 70],
  [19_800, 77], [21_600, 89], [23_400, 95], [25_200, 98],
];

/** Men-only sub-population. ~20–30 min faster than women at each percentile. */
export const MEN_FIELD_CDF: ReadonlyArray<[number, number]> = [
  [10_200, 3], [10_800, 7], [11_400, 12], [12_000, 18], [12_600, 25],
  [13_500, 36], [14_400, 47], [15_300, 57], [16_200, 65], [17_100, 73],
  [18_000, 80], [19_800, 89], [21_600, 95], [23_400, 98],
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
  { range: '18–24', median: 16_500, label: '4:35:00' },
  { range: '25–29', median: 16_680, label: '4:38:00' },
  { range: '30–34', median: 16_800, label: '4:40:00' },
  { range: '35–39', median: 17_100, label: '4:45:00' },
  { range: '40–44', median: 17_400, label: '4:50:00' },
  { range: '45–49', median: 17_880, label: '4:58:00' },
  { range: '50–54', median: 18_600, label: '5:10:00' },
  { range: '55–59', median: 19_500, label: '5:25:00' },
  { range: '60–64', median: 20_700, label: '5:45:00' },
  { range: '65+',   median: 22_200, label: '6:10:00' },
];

export const MEN_AGE_GROUPS: ReadonlyArray<AgeGroupBand> = [
  { range: '18–24', median: 15_000, label: '4:10:00' },
  { range: '25–29', median: 15_000, label: '4:10:00' },
  { range: '30–34', median: 15_120, label: '4:12:00' },
  { range: '35–39', median: 15_300, label: '4:15:00' },
  { range: '40–44', median: 15_600, label: '4:20:00' },
  { range: '45–49', median: 16_080, label: '4:28:00' },
  { range: '50–54', median: 16_800, label: '4:40:00' },
  { range: '55–59', median: 17_700, label: '4:55:00' },
  { range: '60–64', median: 18_900, label: '5:15:00' },
  { range: '65+',   median: 20_400, label: '5:40:00' },
];

export const FIELD_HEADLINES = {
  finishers: 52_000,
  overallMedianSec: 16_140,  // ~4:29:00
  womensWinnerSec: 7_796,    // 2:09:56 — Ruth Chepngetich's 2024 world record
  womensMedianSec: 17_100,   // ~4:45:00
  elevationPenaltyPct: 0.3,  // flattest of the Majors
  typicalRaceTempF: 55,      // mid-October Chicago morning
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
  { label: '<3:00', centerSec: 10_500, share: 0.05 },
  { label: '3:00',  centerSec: 11_400, share: 0.05 },
  { label: '3:20',  centerSec: 12_600, share: 0.08 },
  { label: '3:40',  centerSec: 13_800, share: 0.10 },
  { label: '4:00',  centerSec: 15_000, share: 0.13 },
  { label: '4:20',  centerSec: 16_200, share: 0.13 },
  { label: '4:40',  centerSec: 17_400, share: 0.13 },
  { label: '5:00',  centerSec: 18_600, share: 0.12 },
  { label: '5:30',  centerSec: 20_400, share: 0.11 },
  { label: '6:00+', centerSec: 22_800, share: 0.10 },
];
