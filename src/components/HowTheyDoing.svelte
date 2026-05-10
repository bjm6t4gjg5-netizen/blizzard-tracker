<script lang="ts">
  import { profiles, runnerState } from '../lib/stores';
  import { RACE_START, countdownTo } from '../lib/time';
  import { onMount, onDestroy } from 'svelte';
  import { weather } from '../lib/stores';
  import { weatherIcon } from '../lib/weather';
  import { formatHMS } from '../lib/format';
  import type { RunnerState } from '../lib/runners';
  import type { Readable } from 'svelte/store';

  let cd = countdownTo(RACE_START);
  let tick: ReturnType<typeof setInterval> | null = null;
  onMount(() => { tick = setInterval(() => (cd = countdownTo(RACE_START)), 30_000); });
  onDestroy(() => { if (tick) clearInterval(tick); });

  // Compose a single readable store with all runner states.
  $: stateStores = $profiles.map(p => ({ profile: p, store: runnerState(p.id) }));

  $: rs = stateStores.map(({ profile, store }) => ({ profile, state: get(store) }));

  function get<T>(store: Readable<T>): T {
    let value!: T;
    const unsub = store.subscribe(v => (value = v));
    unsub();
    return value;
  }

  function lineForRunning(state: RunnerState, name: string): string {
    const goal = state.etaSec ? formatHMS(state.etaSec) : null;
    const dist = state.distMi.toFixed(1);
    const pct = Math.round(state.pct);
    return goal
      ? `${name} is at mile ${dist} (${pct}%), trending toward ${goal}.`
      : `${name} is at mile ${dist} (${pct}%) — too early to predict.`;
  }

  function summary(): string {
    if (rs.length === 0) return 'No runners configured.';

    const allFinished = rs.every(({ state }) => state.status === 'finished');
    const anyRunning = rs.some(({ state }) => state.status === 'running');

    if (allFinished) {
      return rs
        .map(({ profile, state }) => `${profile.name.split(' ')[0]} finished in ${formatHMS(state.elapsedSec)} 🏆`)
        .join('. ') + '.';
    }

    if (anyRunning) {
      return rs
        .map(({ profile, state }) => {
          const first = profile.name.split(' ')[0];
          if (state.status === 'finished') return `${first} done in ${formatHMS(state.elapsedSec)}`;
          if (state.status === 'running')  return lineForRunning(state, first);
          return `${first} hasn't started yet.`;
        })
        .join(' ');
    }

    // Pre-race
    const days = cd.days, hours = cd.hours;
    const wxLine = (() => {
      const r = $weather?.raceStartHour;
      if (!r) return 'Forecast loading.';
      const w = weatherIcon(r.weatherCode);
      return `Forecast: ${w.icon} ${Math.round(r.tempF)}°F, ${w.label.toLowerCase()}, ${r.precipPct}% rain.`;
    })();

    if (cd.started) return 'Race is underway. Live data should appear shortly.';
    if (days > 0) return `Race starts in ${days}d ${hours}h. ${wxLine}`;
    if (hours > 1) return `Race in ${hours} hours. ${wxLine}`;
    return `Race starts within the hour — runners are at the start line. ${wxLine}`;
  }

  // Re-evaluate when any input changes — explicit refs so Svelte tracks them.
  $: _wxDep = $weather;
  $: _cdDep = cd;
  $: _rsDep = rs;
  $: text = ((): string => {
    void _wxDep; void _cdDep; void _rsDep;
    return summary();
  })();
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
