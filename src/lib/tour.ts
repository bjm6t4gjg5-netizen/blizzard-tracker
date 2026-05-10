// ============================================================
// tour.ts — Guided onboarding wizard.
//
// Auto-runs the first time a visitor opens the app. Re-runnable
// from a "?" button in the header at any time. Each step targets
// an element via [data-tour="..."], may auto-switch to a specific
// tab beforehand, and supports next / previous / skip.
// ============================================================
import { writable, get } from 'svelte/store';
import { load, save } from './storage';

export interface TourStep {
  /** CSS selector for the target element. null = centered modal (no spotlight). */
  target: string | null;
  title: string;
  body: string;
  /** Which top-level tab must be active before we spotlight. */
  tab?: string;
  /** Preferred tooltip placement. Auto picks the side with the most room. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Optional small note shown beneath the body in a chip. */
  note?: string;
}

export const TOUR_STEPS: ReadonlyArray<TourStep> = [
  {
    target: null,
    title: 'Welcome to Blizzard Tracker ⚡',
    body: 'Your live race-day dashboard for Catherine and Helaine at the 2026 RBC Brooklyn Half. This 60-second tour shows you around. You can re-run it anytime from the ? icon in the header.',
  },
  {
    target: '[data-tour="countdown"]',
    title: 'Countdown to race start',
    body: 'Locked to Eastern Time so it stays correct no matter where you watch from. Once the race is live, the panel flips to "🏁 Race underway".',
  },
  {
    target: '[data-tour="how-doing"]',
    title: 'Status at a glance',
    body: 'One adaptive sentence at the top of Family HQ. Pre-race shows the forecast; mid-race shows live distance and predicted finish; post-race shows the results.',
    tab: 'family',
  },
  {
    target: '[data-tour="map"]',
    title: 'Real course, real route',
    body: 'A Garmin trace of the actual 2026 NYRR course — no more hand-drawn lines that zigzag through Brooklyn. Cheer-zone pins, mile markers, and pulsing runner positions all live here.',
    tab: 'family',
  },
  {
    target: '[data-tour="ical"]',
    title: 'Calendar export for spectators',
    body: 'Download an .ics file with predicted arrival times at every cheer zone. Your phone calendar will buzz five minutes before each runner reaches each spot.',
    tab: 'family',
    placement: 'top',
  },
  {
    target: '[data-tour="runner-tab"]',
    title: 'Per-runner pages',
    body: 'Each runner has their own tab with their live card, pace chart, mini-map and spectator ETAs. Plus a Career sub-view that shows their lifetime stats.',
  },
  {
    target: '[data-tour="runner-settings"]',
    title: 'Edit a runner',
    body: 'Click the ⚙ next to a runner\'s name to change their goal time, milestone paces, age and gender. The Stats tab uses age + gender to highlight which median band they\'re in.',
    tab: 'gf',
  },
  {
    target: '[data-tour="pace-chart"]',
    title: 'Pace chart',
    body: 'Pre-race shows full race plans for each scenario. Once running, every scenario FORKS from the current position — so you can see "from here, at this pace, what does the finish look like?". The dashed line marks "now".',
    tab: 'gf',
  },
  {
    target: '[data-tour="subtabs"]',
    title: 'Today vs Career',
    body: 'Sub-tabs at the top of each runner page. Career digs into PRs, race history, and (for Helaine) the World Marathon Major star count.',
    tab: 'gf',
  },
  {
    target: '[data-tour="tabs"]',
    title: 'Add or remove runners',
    body: 'Click ⊕ at the end of the tab bar to add anyone with an RTRT tracker ID for this event. Catherine and Helaine stay anchored.',
  },
  {
    target: '[data-tour="appearance"]',
    title: 'Make it yours',
    body: 'Light, dark or auto-follow-system theme. Seven accent colors. Per-runner brand colors stay fixed regardless.',
  },
  {
    target: '[data-tour="dev"]',
    title: 'Developer mode',
    body: 'Click "Developer" in the footer and enter the password to unlock the demo menu. Then preview what the app looks like at any race position without waiting for live data.',
  },
  {
    target: '[data-tour="help"]',
    title: 'Need this tour again?',
    body: 'Click the ? button anytime to re-run. See you on race day.',
  },
];

// ────────────────────────────────────────────────────────────
// Store
// ────────────────────────────────────────────────────────────

interface TourState {
  open: boolean;
  index: number;
}

export const tourState = writable<TourState>({ open: false, index: 0 });

const SEEN_KEY = 'tourSeenV2';
export const tourSeen = writable<boolean>(load<boolean>(SEEN_KEY, false));
tourSeen.subscribe(v => save(SEEN_KEY, v));

export function openTour(): void {
  tourState.set({ open: true, index: 0 });
}

export function closeTour(markSeen = true): void {
  tourState.update(s => ({ ...s, open: false }));
  if (markSeen) tourSeen.set(true);
}

export function nextStep(): void {
  tourState.update(s => {
    if (s.index + 1 >= TOUR_STEPS.length) {
      tourSeen.set(true);
      return { open: false, index: 0 };
    }
    return { ...s, index: s.index + 1 };
  });
}

export function prevStep(): void {
  tourState.update(s => ({ ...s, index: Math.max(0, s.index - 1) }));
}

/** Auto-run the tour on first visit, after the app has settled. */
export function maybeAutoStart(): void {
  if (get(tourSeen)) return;
  // Wait one render frame so the DOM is fully painted before we spotlight.
  requestAnimationFrame(() => {
    setTimeout(() => openTour(), 600);
  });
}
