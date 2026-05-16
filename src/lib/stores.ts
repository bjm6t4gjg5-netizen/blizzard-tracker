// ============================================================
// stores.ts — Svelte stores tying live state to localStorage
// ============================================================
import { writable, derived, get } from 'svelte/store';
import {
  type RunnerProfile, type RunnerState, type RunnerGoals,
  loadProfiles, saveProfiles, loadGoals, saveGoals,
  makeRunnerState, persistRunnerState, applySnapshot,
  runnerStartOffsetMin, mileAtElapsed,
} from './runners';
import { fetchRunner } from './rtrt';
import { fetchWeather, type WeatherSnapshot } from './weather';
import { now } from './time';
import { TOTAL_MI, RACE_START } from './time';
import { checkMilestones, ensurePermission, clearMilestones } from './notifications';
import { load, save } from './storage';

// ────────────────────────────────────────────────────────────
// Profiles + per-runner goals
// ────────────────────────────────────────────────────────────

const initialProfiles = loadProfiles();
export const profiles = writable<RunnerProfile[]>(initialProfiles);

profiles.subscribe(saveProfiles);

/** Map: runnerId → goals store. Lazily filled. */
const goalStores = new Map<string, ReturnType<typeof writable<RunnerGoals>>>();

export function goalsStore(id: string) {
  let s = goalStores.get(id);
  if (!s) {
    s = writable<RunnerGoals>(loadGoals(id));
    s.subscribe(g => saveGoals(id, g));
    goalStores.set(id, s);
  }
  return s;
}

// ────────────────────────────────────────────────────────────
// Live runner state — keyed by id, recomputed when profiles change
// ────────────────────────────────────────────────────────────

const stateStores = new Map<string, ReturnType<typeof writable<RunnerState>>>();

export function runnerState(id: string) {
  let s = stateStores.get(id);
  if (!s) {
    const profile = get(profiles).find(p => p.id === id);
    if (!profile) throw new Error(`No profile for runner: ${id}`);
    s = writable<RunnerState>(makeRunnerState(profile));
    s.subscribe(persistRunnerState);
    stateStores.set(id, s);
  }
  return s;
}

/** Convenience: list of all live state stores in profile order. */
export const allRunnerStates = derived(profiles, $p => $p.map(p => runnerState(p.id)));

// ────────────────────────────────────────────────────────────
// Refresh loop
// ────────────────────────────────────────────────────────────

export const lastRefreshAt = writable<number | null>(null);
export const refreshing = writable(false);

/**
 * Time-of-day simulator. When non-null, the value is the number of minutes
 * past Wave 1 gun (7:00 AM ET) the simulator pretends it is. Each runner's
 * state is then projected from `simMin - runnerStartOffsetMin(profile)` →
 * elapsed time → mile (via the goal-pace profile).
 *
 * null = LIVE data from RTRT.
 */
export const demoTimeMin = writable<number | null>(null);

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 1-second client-side tick. For each currently-running runner, advances
 * elapsedSec by 1 and recomputes pct/eta. This makes the visible stopwatch
 * tick smoothly between API polls (which happen every 5s). API responses
 * are monotonic (Math.max in applySnapshot) so the ticker never gets
 * overwritten backwards.
 */
function startTicker(): void {
  if (tickTimer != null) return;
  tickTimer = setInterval(() => {
    // Sim mode owns elapsedSec entirely — don't fight it.
    if (get(demoTimeMin) !== null) return;
    for (const store of stateStores.values()) {
      store.update(s => {
        if (s.status !== 'running') return s;
        const next = s.elapsedSec + 1;
        return {
          ...s,
          elapsedSec: next,
          // Don't recompute pct/eta every second — distMi only changes on
          // API polls, and those refresh derived fields via applySnapshot.
        };
      });
    }
  }, 1_000);
}

function stopTicker(): void {
  if (tickTimer != null) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

export async function refreshOne(id: string): Promise<void> {
  const profile = get(profiles).find(p => p.id === id);
  if (!profile) return;

  // Simulator: synthesize a per-runner snapshot from the chosen race-day time.
  // Each runner's elapsed = (simMin - their wave-start offset) * 60.
  const simMin = get(demoTimeMin);
  if (simMin !== null) {
    const goals = loadGoals(id);
    const offsetMin = runnerStartOffsetMin(profile);
    const elapsedSec = Math.round((simMin - offsetMin) * 60);
    let status: RunnerState['status'];
    let distMi = 0;
    let elapsed = 0;
    if (elapsedSec < 0) {
      status = 'pre';
    } else if (elapsedSec >= goals.goalSec) {
      status = 'finished';
      distMi = TOTAL_MI;
      elapsed = goals.goalSec;
    } else {
      status = 'running';
      distMi = mileAtElapsed(elapsedSec, goals.goalSec);
      elapsed = elapsedSec;
    }
    runnerState(id).update(s => applySnapshot(s, {
      status,
      distMi,
      elapsedSec: elapsed,
      splits: [],
      fetchedAt: now(),
      source: 'sim',
    }));
    return;
  }

  const snap = await fetchRunner(profile.trackId);
  if (snap) {
    runnerState(id).update(s => applySnapshot(s, snap));
  }
  // Fire any missed milestone notifications.
  checkMilestones(profile, get(runnerState(id)));
}

export async function refreshAll(): Promise<void> {
  refreshing.set(true);
  try {
    const ids = get(profiles).map(p => p.id);
    await Promise.all(ids.map(refreshOne));
    lastRefreshAt.set(now());
  } finally {
    refreshing.set(false);
  }
}

export function startAutoRefresh(intervalMs = 5_000): void {
  stopAutoRefresh();
  // Ask for Notification permission once. If denied, we silently skip pings.
  ensurePermission();
  refreshAll(); // immediate
  refreshTimer = setInterval(refreshAll, intervalMs);
  startTicker();
}

export function stopAutoRefresh(): void {
  if (refreshTimer != null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  stopTicker();
}

/** Wipe volatile race-day state for one runner without touching their profile. */
function resetVolatileState(id: string): void {
  const s = stateStores.get(id);
  if (!s) return;
  s.update(state => ({
    ...state,
    status: 'pre',
    distMi: 0,
    elapsedSec: 0,
    pct: 0,
    etaSec: null,
    confidence: 0,
    splits: [],
    paceHistory: [],
    lastUpdate: null,
    source: null,
  }));
}

// React to simulator changes — always wipe positions first so the marker
// snaps back when we move the slider or return to Live.
let prevSim: number | null = null;
demoTimeMin.subscribe(t => {
  if (t !== prevSim) {
    prevSim = t;
    for (const p of get(profiles)) resetVolatileState(p.id);
    clearMilestones();
    refreshAll();
  }
});

// ────────────────────────────────────────────────────────────
// Weather
// ────────────────────────────────────────────────────────────

export const weather = writable<WeatherSnapshot | null>(null);

export async function loadWeather(): Promise<void> {
  const snap = await fetchWeather();
  if (snap) weather.set(snap);
}

// ────────────────────────────────────────────────────────────
// Runner CRUD
// ────────────────────────────────────────────────────────────

export function addRunner(input: {
  name: string;
  trackId: string;
  emoji: string;
  color: string;
}): { ok: boolean; error?: string; id?: string } {
  const name = input.name.trim();
  const trackId = input.trackId.trim().toUpperCase();
  const emoji = (input.emoji || '🏃').trim().slice(0, 2);
  const color = input.color || '#5856D6';

  if (!name) return { ok: false, error: 'Name is required' };
  if (!/^[A-Z0-9]{4,12}$/.test(trackId)) return { ok: false, error: 'Tracker ID must be 4-12 letters/digits (RTRT format)' };
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { ok: false, error: 'Color must be 6-digit hex' };

  const list = get(profiles);
  if (list.some(p => p.trackId === trackId)) return { ok: false, error: 'That tracker ID is already added' };

  // Generate a stable id from the trackId (kept short for nice URL/tab lookup)
  const id = 'r_' + trackId.toLowerCase().slice(0, 8);
  const profile: RunnerProfile = { id, name, trackId, emoji, color, fixed: false };

  profiles.set([...list, profile]);
  // Trigger a fetch immediately so the card is populated.
  refreshOne(id);
  return { ok: true, id };
}

export function removeRunner(id: string): boolean {
  const list = get(profiles);
  const profile = list.find(p => p.id === id);
  if (!profile || profile.fixed) return false;
  profiles.set(list.filter(p => p.id !== id));
  // If the removed runner's tab was active, jump back to Family HQ.
  if (get(activeTab) === id) activeTab.set('family');
  // Drop their state + goals from memory and storage.
  stateStores.delete(id);
  goalStores.delete(id);
  // Note: localStorage entries persist (tiny), cleaned up if name reused.
  return true;
}

export function updateRunner(id: string, patch: Partial<Omit<RunnerProfile, 'id' | 'fixed'>>): boolean {
  const list = get(profiles);
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return false;
  const next = [...list];
  next[idx] = { ...next[idx], ...patch };
  profiles.set(next);
  return true;
}

// ────────────────────────────────────────────────────────────
// UI state
// ────────────────────────────────────────────────────────────

export const activeTab = writable<string>('family');
export const settingsOpen = writable<boolean>(false);
/** When non-null, the per-runner settings modal opens for this runner id. */
export const runnerSettingsFor = writable<string | null>(null);

/** Persisted user-chosen tab order. Drag-and-drop in the tab bar mutates this. */
const initialTabOrder = load<string[]>('tabOrder', []);
export const tabOrder = writable<string[]>(initialTabOrder);
tabOrder.subscribe(o => save('tabOrder', o));

export const toast = writable<{ id: number; text: string } | null>(null);
let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function notify(text: string, ms = 2500): void {
  toastSeq += 1;
  toast.set({ id: toastSeq, text });
  if (toastTimer != null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.set(null), ms);
}
