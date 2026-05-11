<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, derived, get } from 'svelte/store';
  import type { Readable } from 'svelte/store';
  import { profiles, runnerState, weather, demoTimeMin } from '../lib/stores';
  import { RACE_START, countdownTo } from '../lib/time';
  import { weatherIcon } from '../lib/weather';
  import { formatHMS } from '../lib/format';
  import type { RunnerProfile, RunnerState } from '../lib/runners';

  // ────────────────────────────────────────────────────────────
  // Reactive plumbing
  //
  // Old version manually iterated stores inside a $: block and used a
  // get() helper that didn't re-subscribe — which is why stale dev-mode
  // text persisted after returning to Live. The fix is a derived store
  // that takes ALL runner-state stores as inputs, so any state change
  // (including being reset to pre-race on demo exit) triggers a redraw.
  // ────────────────────────────────────────────────────────────

  interface Row { profile: RunnerProfile; state: RunnerState; }

  let cd = countdownTo(RACE_START);
  let tickHandle: ReturnType<typeof setInterval> | null = null;
  onMount(() => { tickHandle = setInterval(() => (cd = countdownTo(RACE_START)), 30_000); });
  onDestroy(() => { if (tickHandle) clearInterval(tickHandle); });

  /** Build a fresh derived store every time the profiles list changes. */
  function buildLiveStore(p: RunnerProfile[]): Readable<Row[]> {
    const stores = p.map(pp => runnerState(pp.id));
    if (stores.length === 0) return writable<Row[]>([]);
    return derived(stores as unknown as Readable<RunnerState>[], (states) =>
      p.map((profile, i) => ({ profile, state: (states as RunnerState[])[i] }))
    );
  }

  let liveStore: Readable<Row[]> = buildLiveStore($profiles);
  $: liveStore = buildLiveStore($profiles);

  function lineForRunning(state: RunnerState, name: string): string {
    const goal = state.etaSec ? formatHMS(state.etaSec) : null;
    const dist = state.distMi.toFixed(1);
    const pct = Math.round(state.pct);
    return goal
      ? `${name} is at mile ${dist} (${pct}%), trending toward ${goal}.`
      : `${name} is at mile ${dist} (${pct}%) — too early to predict.`;
  }

  function summary(rows: Row[]): string {
    if (rows.length === 0) return 'No runners configured.';

    // Treat "running" / "finished" only if EITHER the simulator is on OR the
    // runner has real movement. After exiting dev mode, resetVolatileState
    // wipes distMi/elapsedSec back to 0 so this collapses to pre-race text.
    const anyRunning = rows.some(r => r.state.status === 'running' && (r.state.distMi > 0.05 || r.state.elapsedSec > 5));
    const allFinished = rows.every(r => r.state.status === 'finished' && r.state.elapsedSec > 60);

    if (allFinished) {
      return rows
        .map(r => `${r.profile.name.split(' ')[0]} finished in ${formatHMS(r.state.elapsedSec)} 🏆`)
        .join('. ') + '.';
    }

    if (anyRunning) {
      return rows.map(r => {
        const first = r.profile.name.split(' ')[0];
        if (r.state.status === 'finished' && r.state.elapsedSec > 60) {
          return `${first} done in ${formatHMS(r.state.elapsedSec)}`;
        }
        if (r.state.status === 'running' && (r.state.distMi > 0.05 || r.state.elapsedSec > 5)) {
          return lineForRunning(r.state, first);
        }
        return `${first} hasn't started yet.`;
      }).join(' ');
    }

    // Pre-race
    const days = cd.days, hours = cd.hours;
    const wxLine = (() => {
      const w = get(weather);
      const r = w?.raceStartHour;
      if (!r) return 'Forecast loading.';
      const ic = weatherIcon(r.weatherCode);
      return `Forecast: ${ic.icon} ${Math.round(r.tempF)}°F, ${ic.label.toLowerCase()}, ${r.precipPct}% rain.`;
    })();

    if (cd.started) return 'Race is underway. Live data should appear shortly.';
    if (days > 0) return `Race starts in ${days}d ${hours}h. ${wxLine}`;
    if (hours > 1) return `Race in ${hours} hours. ${wxLine}`;
    return `Race starts within the hour — runners are at the start line. ${wxLine}`;
  }

  // Reactive text — depends on the derived store, the weather store, the
  // countdown tick, and (crucially) the demo-mode store so the moment dev
  // mode is locked we recompute.
  $: text = summary($liveStore);
  $: _depTick = cd;       // ← tick dependency
  $: _depWx   = $weather;
  $: _depSim  = $demoTimeMin;
  $: { void _depTick; void _depWx; void _depSim; }
</script>

<div class="how" data-tour="how-doing">
  <span class="dot"></span>
  <span class="text">{text}</span>
</div>

<style>
  .how {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    border-left: 3px solid var(--blue);
    margin-bottom: var(--gap-md);
    font-size: 13px;
    line-height: 1.45;
    color: var(--text-secondary);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--blue);
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.55; transform: scale(0.85); }
  }
</style>
