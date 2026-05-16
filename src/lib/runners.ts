// ============================================================
// runners.ts — Runner registry, goals, predictions, ETA
// ============================================================
import { TOTAL_MI } from './time';
import { ELEVATION_PROFILE } from './course';
import { load, save } from './storage';
import type { RtrtSnapshot } from './rtrt';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** Static profile of a runner — name, tracker, branding, demographics. */
export interface RunnerProfile {
  id: string;
  name: string;
  trackId: string;
  emoji: string;
  /** Brand color, used for chart strokes, accents. Must be 6-hex. */
  color: string;
  /** True for the two anchor runners (Catherine, Helaine). */
  fixed: boolean;
  /** Date of birth, YYYY-MM-DD. Age is computed from this. */
  dob?: string;
  /** Gender — drives age-group lookup. */
  gender?: 'F' | 'M';
  /** Height in inches (total). 67 = 5'7". */
  heightIn?: number;
  /** Body weight in pounds. */
  weightLb?: number;
  /** Start wave: 1, 2, 3, or 4 (RBC Brooklyn Half has four waves). */
  wave?: 1 | 2 | 3 | 4;
  /** Corral letter within the wave: A, B, C, ... */
  corral?: string;
}

// ────────────────────────────────────────────────────────────
// Wave start times
// ────────────────────────────────────────────────────────────

/**
 * Official RBC Brooklyn Half 2026 wave-start times.
 * Per Catherine's bib confirmation: waves are 30 minutes apart
 * (was 25 in earlier years).
 */
const WAVE_START_OFFSET_MIN: Record<1 | 2 | 3 | 4, number> = {
  1: 0,    // 7:00 AM ET
  2: 30,   // 7:30 AM
  3: 60,   // 8:00 AM
  4: 90,   // 8:30 AM
};

/** Approximate corral-to-corral funnel delay within a wave (minutes). */
function corralOffsetMin(corral: string | undefined): number {
  if (!corral) return 0;
  const idx = corral.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
  if (idx < 0 || idx > 25) return 0;
  // ~2 minutes between adjacent corrals — placeholder until NYRR confirms.
  return idx * 2;
}

/** Compute a runner's actual gun/chip start time on race day. */
export function runnerStartTime(profile: RunnerProfile, raceStart: Date): Date {
  const wave = (profile.wave ?? 1) as 1 | 2 | 3 | 4;
  const offsetMin = WAVE_START_OFFSET_MIN[wave] + corralOffsetMin(profile.corral);
  return new Date(raceStart.getTime() + offsetMin * 60_000);
}

/** Minutes from Wave 1 gun (7:00 AM ET) when this runner crosses the start. */
export function runnerStartOffsetMin(profile: RunnerProfile): number {
  const wave = (profile.wave ?? 1) as 1 | 2 | 3 | 4;
  return WAVE_START_OFFSET_MIN[wave] + corralOffsetMin(profile.corral);
}

/** Human-readable wave + corral label (e.g. "Wave 1 · Corral B · 7:02 AM"). */
export function waveLabel(profile: RunnerProfile, raceStart: Date): string {
  if (!profile.wave) return '';
  const t = runnerStartTime(profile, raceStart);
  const hours = t.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  });
  const corralPart = profile.corral ? ` · Corral ${profile.corral}` : '';
  return `Wave ${profile.wave}${corralPart} · ${hours} ET`;
}

/** Compute integer age from a YYYY-MM-DD birthday relative to a reference date. */
export function ageFromDob(dob: string | undefined, asOf: Date = new Date()): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const birth = new Date(dob + 'T00:00:00');
  if (Number.isNaN(birth.getTime())) return null;
  let age = asOf.getFullYear() - birth.getFullYear();
  const m = asOf.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < birth.getDate())) age--;
  return age >= 0 && age < 150 ? age : null;
}

/** A scenario is a named "what-if" race plan with a flat-equivalent pace. */
export interface Scenario {
  key: string;
  label: string;
  emoji: string;
  color: string;
  /** Flat-equivalent pace in seconds per mile. null = use goal-time inverse. */
  flatPaceSec: number | null;
  desc: string;
}

/** A target split — "be at this mile by this elapsed time". */
export interface SplitGoal {
  label: string;
  mi: number;
  targetSec: number;
}

/** Editable race plan for one runner. */
export interface RunnerGoals {
  goalSec: number;
  goalLabel: string;
  /** Target overall race pace (seconds per mile). Derived from goalSec but can be edited. */
  goalMilePaceSec?: number;
  /** Optional milestone pace targets (sec/mi at each split). */
  mile5kPaceSec?: number;
  mile10kPaceSec?: number;
  mile15kPaceSec?: number;
  mileFinishPaceSec?: number;
  scenarios: Scenario[];
  splitGoals: SplitGoal[];
}

export interface PaceSample {
  mi: number;
  elapsedSec: number;
}

/** Live state for one runner — combines profile + last RTRT snapshot. */
export interface RunnerState {
  profile: RunnerProfile;
  /** Status from the last successful fetch. */
  status: 'pre' | 'running' | 'finished' | 'unknown';
  distMi: number;
  elapsedSec: number;
  /** Percent of course complete in [0, 100]. */
  pct: number;
  /** Predicted finish time in seconds, or null if not enough data. */
  etaSec: number | null;
  /** Confidence in the ETA, percent in [0, 100]. */
  confidence: number;
  splits: { label: string; chipTime: string; pace: string }[];
  /** Cumulative pace samples — survives reload via localStorage. */
  paceHistory: PaceSample[];
  /** Time of last successful fetch (ms epoch). */
  lastUpdate: number | null;
  /** Name of the proxy that served the last snapshot, for debugging. */
  source: string | null;
}

// ────────────────────────────────────────────────────────────
// Default registry
// ────────────────────────────────────────────────────────────

export const DEFAULT_PROFILES: ReadonlyArray<RunnerProfile> = [
  // Catherine — born 25 May 1998 (age 28). Wave 1 · Corral B → 7:02 AM start.
  { id: 'gf',  name: 'Catherine Blizzard', trackId: 'RMGBEVSK', emoji: '💙', color: '#007AFF', fixed: true, dob: '1998-05-25', gender: 'F', heightIn: 65, weightLb: 125, wave: 1, corral: 'B' },
  // Helaine — born 13 Apr 1964 (age 62). Wave 2 · Corral C → 7:34 AM start.
  // Brand color: Apple Pink (#FF2D55) — visually distinct from Catherine's
  // blue so heat maps + map markers + chart lines never read as the same
  // runner at a glance.
  { id: 'mom', name: 'Helaine Blizzard',   trackId: 'RRM2PLD3', emoji: '⚡', color: '#FF2D55', fixed: true, dob: '1964-04-13', gender: 'F', heightIn: 67, weightLb: 120, wave: 2, corral: 'C' },
];

export const DEFAULT_GOALS: Record<string, RunnerGoals> = {
  gf: {
    // Catherine's stated goal per her email: "absolutely do under a 1:32"
    // (existing half PR is 1:32:17 at Too Cold to Hold 2023). 1:32 is the
    // PR-attempt target; sub-90 is a future stretch.
    goalSec: 92 * 60,
    goalLabel: 'Sub-1:32',
    goalMilePaceSec: 7 * 60 + 1,
    // Note: there's no 'goal' scenario — the canonical goal line is drawn
    // from the editable split targets below. Keeping it as a scenario would
    // duplicate the same line under a different label.
    scenarios: [
      { key: 'dream',   label: 'Dream Day',   emoji: '🌟', color: '#34C759', flatPaceSec: 6 * 60 + 10, desc: 'Everything clicks, negative split' },
      { key: 'strong',  label: 'Strong Day',  emoji: '💪', color: '#5856D6', flatPaceSec: 7 * 60 + 0,  desc: 'Solid race, slight fade late' },
      { key: 'tough',   label: 'Tough Day',   emoji: '😅', color: '#FF9500', flatPaceSec: 7 * 60 + 30, desc: 'Warm/crowded, conservative finish' },
      { key: 'runwalk', label: 'Run/Walk',    emoji: '🚶', color: '#FF3B30', flatPaceSec: 8 * 60 + 30, desc: 'Backup plan, guaranteed finish' },
    ],
    splitGoals: [
      // Sub-1:32 (5,520 sec / 13.1 mi ≈ 7:01/mi flat eq.).
      { label: 'Mile 1',  mi: 1.0,      targetSec:  7 * 60 + 15 },
      { label: 'Mile 3',  mi: 3.0,      targetSec: 20 * 60 + 55 },
      { label: 'Mile 5',  mi: 5.0,      targetSec: 35 * 60 + 25 },
      { label: 'Mile 7',  mi: 7.0,      targetSec: 49 * 60 + 40 },
      { label: 'Mile 10', mi: 10.0,     targetSec: 70 * 60 + 20 },
      { label: 'Finish',  mi: TOTAL_MI, targetSec: 92 * 60      },
    ],
  },
  mom: {
    goalSec: 110 * 60,
    goalLabel: 'Sub-1:50',
    goalMilePaceSec: 8 * 60 + 24,
    // No 'goal' scenario — the editable split targets drive the goal line.
    scenarios: [
      { key: 'dream',   label: 'Best Day',   emoji: '🌟', color: '#34C759', flatPaceSec: 7 * 60 + 55, desc: 'Everything clicks' },
      { key: 'strong',  label: 'Strong Day', emoji: '💪', color: '#007AFF', flatPaceSec: 8 * 60 + 45, desc: 'Solid race' },
      { key: 'tough',   label: 'Tough Day',  emoji: '😅', color: '#FF9500', flatPaceSec: 9 * 60 + 30, desc: 'Warm / conservative' },
      { key: 'runwalk', label: 'Run/Walk',   emoji: '🚶', color: '#FF3B30', flatPaceSec: 11 * 60 + 0, desc: 'Backup plan' },
    ],
    splitGoals: [
      { label: 'Mile 1',  mi: 1.0,      targetSec:  8 * 60 + 40 },
      { label: 'Mile 3',  mi: 3.0,      targetSec: 25 * 60 + 30 },
      { label: 'Mile 5',  mi: 5.0,      targetSec: 42 * 60 + 30 },
      { label: 'Mile 7',  mi: 7.0,      targetSec: 59 * 60 + 30 },
      { label: 'Mile 10', mi: 10.0,     targetSec: 84 * 60 + 30 },
      { label: 'Finish',  mi: TOTAL_MI, targetSec: 110 * 60     },
    ],
  },
};

// ────────────────────────────────────────────────────────────
// State factory + initial loading
// ────────────────────────────────────────────────────────────

export function makeRunnerState(profile: RunnerProfile): RunnerState {
  const restored = load<{ paceHistory: PaceSample[] } | null>('paceHistory:' + profile.id, null);
  return {
    profile,
    status: 'pre',
    distMi: 0,
    elapsedSec: 0,
    pct: 0,
    etaSec: null,
    confidence: 0,
    splits: [],
    paceHistory: restored?.paceHistory ?? [],
    lastUpdate: null,
    source: null,
  };
}

/** Persist the volatile, race-relevant slice of state. */
export function persistRunnerState(s: RunnerState): void {
  save('paceHistory:' + s.profile.id, { paceHistory: s.paceHistory });
}

export function loadProfiles(): RunnerProfile[] {
  const stored = load<RunnerProfile[]>('profiles', DEFAULT_PROFILES as RunnerProfile[]);
  // Validate each entry — discard malformed or color-broken ones.
  const valid = stored.filter(p =>
    p && typeof p.id === 'string' && /^#[0-9a-f]{6}$/i.test(p.color),
  );
  if (valid.length === 0) return DEFAULT_PROFILES.map(p => ({ ...p }));
  // Forward-fill: ensure anchored runners carry their default age/gender if a
  // pre-v2.1 stored copy lacks them.
  return valid.map(p => {
    if (p.fixed) {
      const def = DEFAULT_PROFILES.find(d => d.id === p.id);
      if (def) return { ...def, ...p };
    }
    return p;
  });
}

export function saveProfiles(profiles: RunnerProfile[]): void {
  save('profiles', profiles);
}

export function loadGoals(id: string): RunnerGoals {
  const def = DEFAULT_GOALS[id] ?? DEFAULT_GOALS.gf;
  const stored = load<Partial<RunnerGoals> | null>('goals:' + id, null);
  if (!stored) return structuredClone(def);
  return { ...def, ...stored };
}

export function saveGoals(id: string, g: RunnerGoals): void {
  save('goals:' + id, g);
}

// ────────────────────────────────────────────────────────────
// Pace prediction — non-linear with elevation + fatigue
// ────────────────────────────────────────────────────────────

/** Elevation-derived grade penalty for a [a, b] mile segment. */
function gradeFactor(miStart: number, miEnd: number): number {
  const samples = ELEVATION_PROFILE.filter(p => p.mi >= miStart && p.mi <= miEnd);
  if (samples.length < 2) return 1;
  const rise = samples[samples.length - 1].ft - samples[0].ft;
  const distFt = Math.max((miEnd - miStart) * 5280, 1);
  const grade = rise / distFt; // decimal
  // GAP-style: +12 sec/mi per 1% climb, -6 sec/mi per 1% descent.
  const adj = grade * 100 * (grade > 0 ? 0.12 : 0.06);
  return Math.max(0.85, Math.min(1.25, 1 + adj));
}

/** Fatigue/freshness multiplier as a function of mile reached. */
function fatigueFactor(mi: number): number {
  if (mi < 1) return 1.05;   // crowded start, settling
  if (mi < 3) return 1.01;
  if (mi < 8) return 1.00;
  if (mi < 11) return 1.02;
  if (mi < 12.5) return 1.04;
  return 0.98;               // finishing kick
}

/** Build a cumulative time profile for a flat-pace plan. */
export function buildPaceProfile(flatPaceSec: number): { mi: number; sec: number }[] {
  const SEG = 0.5;
  let cum = 0;
  const pts: { mi: number; sec: number }[] = [{ mi: 0, sec: 0 }];
  for (let mi = 0; mi < TOTAL_MI; mi += SEG) {
    const next = Math.min(mi + SEG, TOTAL_MI);
    const pace = flatPaceSec * gradeFactor(mi, next) * fatigueFactor(mi);
    cum += pace * (next - mi);
    pts.push({ mi: +next.toFixed(3), sec: cum });
  }
  return pts;
}

/** Given an elapsed-time-from-runner-start, project how far they'd be along
 *  the course using their goal-time pace profile (elevation/fatigue model). */
export function mileAtElapsed(elapsedSec: number, goalSec: number): number {
  if (elapsedSec <= 0) return 0;
  if (elapsedSec >= goalSec) return TOTAL_MI;
  const flat = flatPaceForGoal(goalSec);
  const profile = buildPaceProfile(flat);
  for (let i = 0; i < profile.length - 1; i++) {
    if (profile[i + 1].sec >= elapsedSec) {
      const span = profile[i + 1].sec - profile[i].sec || 1e-9;
      const t = (elapsedSec - profile[i].sec) / span;
      return profile[i].mi + (profile[i + 1].mi - profile[i].mi) * t;
    }
  }
  return TOTAL_MI;
}

/** Solve for the flat pace that hits a target finish time. */
export function flatPaceForGoal(goalSec: number): number {
  let lo = 200; // 3:20/mi
  let hi = 900; // 15:00/mi
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const total = buildPaceProfile(mid).at(-1)?.sec ?? Infinity;
    if (total < goalSec) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Default mile checkpoints the user gets a target time for. We chose 1/3/5/7/10
 * because they're the spots a spectator-coach can actually call out a "go go
 * go!" or "back off a tick" decision at, plus 13.1 for the finish.
 */
export const DEFAULT_SPLIT_MILES: ReadonlyArray<number> = [1, 3, 5, 7, 10, TOTAL_MI];

/** Compute split goals that net to goalSec, using the elevation/fatigue model. */
export function buildGoalSplits(
  goalSec: number,
  miles: ReadonlyArray<number> = DEFAULT_SPLIT_MILES,
): SplitGoal[] {
  const flat = flatPaceForGoal(goalSec);
  const profile = buildPaceProfile(flat);
  const at = (mi: number) => {
    // Linear interp between flanking samples (robust at fractional miles).
    for (let i = 0; i < profile.length - 1; i++) {
      if (profile[i + 1].mi >= mi) {
        const span = profile[i + 1].mi - profile[i].mi || 1e-9;
        const t = (mi - profile[i].mi) / span;
        return profile[i].sec + (profile[i + 1].sec - profile[i].sec) * t;
      }
    }
    return profile[profile.length - 1]?.sec ?? 0;
  };
  return miles.map(mi => {
    const label = mi >= TOTAL_MI - 0.05 ? 'Finish' : `Mile ${mi % 1 === 0 ? mi : mi.toFixed(1)}`;
    const targetSec = mi >= TOTAL_MI - 0.05 ? goalSec : Math.round(at(mi));
    return { label, mi, targetSec };
  });
}


// ────────────────────────────────────────────────────────────
// ETA computation
// ────────────────────────────────────────────────────────────

export interface EtaResult {
  etaSec: number | null;
  confidence: number;
  /** Pace, sec/mi, used to project the remaining distance. */
  projectedFlatPaceSec: number | null;
}

/**
 * Project a finish time from a runner's current position.
 *
 * Approach: use the runner's average pace so far as a flat-equivalent input
 * to buildPaceProfile, then read off the time at TOTAL_MI minus the time at
 * the current mile. This naturally accounts for the elevation/fatigue mix
 * between "miles already done" and "miles still to go".
 */
export function computeEta(state: RunnerState): EtaResult {
  if (state.distMi < 0.4 || state.elapsedSec < 60) {
    return { etaSec: null, confidence: 0, projectedFlatPaceSec: null };
  }
  if (state.status === 'finished') {
    return { etaSec: state.elapsedSec, confidence: 100, projectedFlatPaceSec: null };
  }
  // Use observed flat-equivalent pace if we have it; otherwise raw.
  const obsPace = state.elapsedSec / Math.max(state.distMi, 0.01);
  // Back out a flat pace by reversing the model: the average effective
  // multiplier so far.
  let modelMix = 0;
  let segs = 0;
  const STEP = 0.25;
  for (let m = 0; m < state.distMi; m += STEP) {
    const next = Math.min(m + STEP, state.distMi);
    modelMix += gradeFactor(m, next) * fatigueFactor(m) * (next - m);
    segs += next - m;
  }
  const avgMul = segs > 0 ? modelMix / segs : 1;
  const flatPaceEst = obsPace / avgMul;

  // Build the profile and read off the remaining time.
  const profile = buildPaceProfile(flatPaceEst);
  let timeAtNow = 0;
  for (const p of profile) {
    if (p.mi >= state.distMi) {
      timeAtNow = p.sec;
      break;
    }
  }
  const total = profile.at(-1)?.sec ?? state.elapsedSec;
  const remaining = total - timeAtNow;
  const etaSec = Math.round(state.elapsedSec + remaining);

  // Confidence: 10% baseline + 0.85 per percent complete, capped 95.
  const pct = (state.distMi / TOTAL_MI) * 100;
  const confidence = Math.min(95, Math.round(10 + pct * 0.85));

  return { etaSec, confidence, projectedFlatPaceSec: flatPaceEst };
}

// ────────────────────────────────────────────────────────────
// Apply a fresh RTRT snapshot to a state object
// ────────────────────────────────────────────────────────────

export function applySnapshot(state: RunnerState, snap: RtrtSnapshot): RunnerState {
  const newDist = snap.distMi != null ? Math.min(Math.max(snap.distMi, 0), TOTAL_MI) : state.distMi;
  // Monotonic on elapsed: never go backward, so the 1-second UI tick in
  // stores.ts is never overwritten with a slightly-stale API value (which
  // would cause visible 1-sec hiccups on the stopwatch).
  const apiElapsed = snap.elapsedSec != null ? Math.max(snap.elapsedSec, 0) : null;
  const newElapsed = apiElapsed != null ? Math.max(state.elapsedSec, apiElapsed) : state.elapsedSec;

  // Append to pace history only if we actually moved (avoids spamming dupes).
  let history = state.paceHistory;
  if (newDist > 0 && (history.length === 0 || newDist > history[history.length - 1].mi + 0.01)) {
    history = [...history, { mi: newDist, elapsedSec: newElapsed }];
  }

  const updated: RunnerState = {
    ...state,
    status: snap.status === 'unknown' ? state.status : snap.status,
    distMi: newDist,
    elapsedSec: newElapsed,
    pct: (newDist / TOTAL_MI) * 100,
    splits: snap.splits.length ? snap.splits : state.splits,
    paceHistory: history,
    lastUpdate: snap.fetchedAt,
    source: snap.source,
  };
  const eta = computeEta(updated);
  updated.etaSec = eta.etaSec;
  updated.confidence = eta.confidence;
  return updated;
}
