<script lang="ts">
  import type { RunnerProfile } from '../lib/runners';
  import { runnerState, activeTab } from '../lib/stores';
  import { formatHMSFull, formatPace } from '../lib/format';

  export let profile: RunnerProfile;
  $: state = runnerState(profile.id);
  $: r = $state;

  /** Same tone vocabulary as RunnerCard so both views read identically. */
  function badge(status: string): { label: string; tone: string } {
    if (status === 'finished') return { label: 'Finished', tone: 'finished' };
    if (status === 'running')  return { label: 'Running',  tone: 'running' };
    if (status === 'unknown')  return { label: 'No data',  tone: 'unknown' };
    return { label: 'Pre-race', tone: 'pre' };
  }
  $: b = badge(r.status);
</script>

<div
  class="vs-card"
  style="--pc: {profile.color}"
  on:click={() => activeTab.set(profile.id)}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && activeTab.set(profile.id)}
  role="button"
  tabindex="0"
>
  <span class="status status-{b.tone}" title="{b.label}">
    <span class="dot"></span>{b.label}
  </span>

  <div class="vs-name">{profile.emoji} {profile.name}</div>

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
    position: relative;
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

  /* Top-right status pill — mirrors RunnerCard's badge exactly so the
     two surfaces speak the same visual language. */
  .status {
    position: absolute;
    top: 14px;
    right: 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: -0.1px;
  }
  .status .dot { width: 6px; height: 6px; border-radius: 50%; }
  .status-pre      { background: var(--surface-2); color: var(--text-tertiary); }
  .status-pre .dot { background: var(--text-muted); }
  .status-running  { background: rgba(52, 199, 89, 0.12); color: #1F9D4F; }
  .status-running .dot { background: var(--green); animation: blink 1s ease-in-out infinite; }
  .status-finished { background: rgba(255, 149, 0, 0.14); color: var(--orange); }
  .status-finished .dot { background: var(--orange); }
  .status-unknown  { background: rgba(255, 59, 48, 0.10); color: var(--red); }
  .status-unknown .dot { background: var(--red); }
  @keyframes blink { 50% { opacity: 0.4; } }

  .vs-name {
    font-weight: 700;
    font-size: 17px;
    color: var(--pc);
    margin-bottom: 12px;
    padding-right: 80px;     /* keep clear of the status pill */
  }

  .vs-rows { display: flex; flex-direction: column; gap: 6px; }
  .vs-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid var(--separator-soft);
    font-size: 13px;
  }
  .vs-row:last-child { border-bottom: none; }
  .vs-row span { color: var(--text-tertiary); }
</style>
