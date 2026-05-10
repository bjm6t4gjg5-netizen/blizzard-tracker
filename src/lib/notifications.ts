// ============================================================
// notifications.ts — Browser Notification API milestones.
//
// Fires at 25/50/75/100% progress per runner, once per session per
// runner-milestone. Permission is requested lazily the first time
// the race goes live.
// ============================================================
import type { RunnerProfile, RunnerState } from './runners';
import { formatHMS, formatPace } from './format';
import { load, save } from './storage';

const STATE_KEY = 'notifFired';

/** runnerId → set of milestones already fired (string for JSON storage). */
type FiredMap = Record<string, string[]>;

let fired: FiredMap = load<FiredMap>(STATE_KEY, {});

function hasFired(runnerId: string, key: string): boolean {
  return (fired[runnerId] ?? []).includes(key);
}

function markFired(runnerId: string, key: string): void {
  if (!fired[runnerId]) fired[runnerId] = [];
  fired[runnerId].push(key);
  save(STATE_KEY, fired);
}

export async function ensurePermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

const MILESTONES: ReadonlyArray<{ pct: number; label: string }> = [
  { pct: 25, label: '¼ done' },
  { pct: 50, label: '½ done' },
  { pct: 75, label: '¾ done' },
  { pct: 100, label: 'Finished!' },
];

/** Check a runner's latest state and fire any missed milestones. */
export function checkMilestones(profile: RunnerProfile, state: RunnerState): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (state.status === 'pre' || state.status === 'unknown') return;

  for (const m of MILESTONES) {
    if (state.pct < m.pct) continue;
    const key = String(m.pct);
    if (hasFired(profile.id, key)) continue;
    markFired(profile.id, key);

    const isFinish = m.pct === 100;
    const title = `${profile.emoji} ${profile.name.split(' ')[0]} — ${m.label}`;
    const body = isFinish
      ? `🎉 Finished in ${formatHMS(state.elapsedSec)}!`
      : `${state.distMi.toFixed(1)} mi · ${formatPace(state.elapsedSec, state.distMi)}/mi${state.etaSec ? ` · proj ${formatHMS(state.etaSec)}` : ''}`;

    try {
      new Notification(title, {
        body,
        icon: './icon-192.png',
        tag: `${profile.id}-${key}`,
      });
    } catch {
      // Notification constructor failed (e.g., Safari sometimes). Silent.
    }
  }
}

/** Clear all stored milestones — call when demo mode resets state. */
export function clearMilestones(): void {
  fired = {};
  save(STATE_KEY, fired);
}
