// ============================================================
// time.ts — race-day time anchors
// RACE_START is timezone-locked to America/Chicago so the
// countdown is correct regardless of the viewer's locale.
// ============================================================

/**
 * Bank of America Chicago Marathon 2026: Sunday October 11, 2026.
 * 7:30 AM CDT = pro start; Wave 1 goes off at 7:35 (offset handled
 * in runners.ts WAVE_START_OFFSET_MIN).
 */
export const RACE_START = new Date('2026-10-11T07:30:00-05:00');

/** Kept for the Old Races archive — RBC Brooklyn Half 2026 Wave 1 gun. */
export const BROOKLYN_HALF_2026 = new Date('2026-05-16T07:00:00-04:00');

/** Backwards-compat alias (Header used this for the post-Brooklyn countdown). */
export const CHICAGO_MARATHON_2026 = RACE_START;

/** Total race distance, miles. Fixed by World Athletics certification (42.195 km). */
export const TOTAL_MI = 26.2188;

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
