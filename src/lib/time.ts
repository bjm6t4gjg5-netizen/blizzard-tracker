// ============================================================
// time.ts — race-day time anchors
// RACE_START is timezone-locked to America/New_York so the
// countdown is correct regardless of the viewer's locale.
// ============================================================

/** RBC Brooklyn Half 2026: Saturday May 16, 2026 at 7:00 AM EDT (UTC-4). */
export const RACE_START = new Date('2026-05-16T07:00:00-04:00');

/** Bank of America Chicago Marathon 2026: Sunday October 11, 2026 at 7:30 AM CDT. */
export const CHICAGO_MARATHON_2026 = new Date('2026-10-11T07:30:00-05:00');

/** Total race distance, miles. Fixed by USATF certification. */
export const TOTAL_MI = 13.1094;

/** "Now", overridable for tests. */
export function now(): number {
  return Date.now();
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  /** True if RACE_START is in the past. */
  started: boolean;
}

export function countdownTo(target: Date | number, ref: number = now()): Countdown {
  const t = typeof target === 'number' ? target : target.getTime();
  const ms = t - ref;
  if (ms <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: ms, started: true };
  }
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
    totalMs: ms,
    started: false,
  };
}
