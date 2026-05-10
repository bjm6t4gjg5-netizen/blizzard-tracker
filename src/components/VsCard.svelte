<script lang="ts">
  import type { RunnerProfile } from '../lib/runners';
  import { runnerState, activeTab } from '../lib/stores';
  import { formatHMSFull, formatPace } from '../lib/format';

  export let profile: RunnerProfile;
  $: state = runnerState(profile.id);
  $: r = $state;

  function statusText(s: string): string {
    if (s === 'running')  return 'Running';
    if (s === 'finished') return 'Finished 🏆';
    if (s === 'unknown')  return '—';
    return 'Pre-race';
  }
</script>

<div
  class="vs-card"
  style="--pc: {profile.color}"
  on:click={() => activeTab.set(profile.id)}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && activeTab.set(profile.id)}
  role="button"
  tabindex="0"
>
  <div class="vs-name">{profile.emoji} {profile.name}</div>
  <div class="vs-status">{statusText(r.status)}</div>
  <div class="vs-rows">
    <div class="vs-row"><span>Distance</span><b>{r.distMi > 0 ? r.distMi.toFixed(2) + ' mi' : '—'}</b></div>
    <div class="vs-row"><span>Elapsed</span><b class="mono">{r.elapsedSec > 0 ? formatHMSFull(r.elapsedSec) : '—'}</b></div>
    <div class="vs-row"><span>Pace</span><b class="mono">{formatPace(r.elapsedSec, r.distMi)}/mi</b></div>
    <div class="vs-row"><span>Predicted finish</span><b class="mono" style="color: var(--pc)">{r.etaSec ? formatHMSFull(r.etaSec) : '—:—:—'}</b></div>
  </div>
</div>

<style>
  .vs-card {
    --pc: var(--blue);
    background: var(--surface);
    border-radius: var(--radius);
    padding: 16px;
    border-top: 3px solid var(--pc);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition: transform 100ms ease, box-shadow 150ms ease;
    height: 100%;
  }
  .vs-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
  .vs-card:focus-visible { outline: 2px solid var(--pc); outline-offset: 2px; }
  .vs-name { font-weight: 700; font-size: 17px; color: var(--pc); }
  .vs-status { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; margin-bottom: 12px; }
  .vs-rows { display: flex; flex-direction: column; gap: 6px; }
  .vs-row {
    display: flex; justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid var(--separator-soft);
    font-size: 13px;
  }
  .vs-row:last-child { border-bottom: none; }
  .vs-row span { color: var(--text-tertiary); }
</style>
