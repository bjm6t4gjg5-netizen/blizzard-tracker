<script lang="ts">
  import type { RunnerProfile } from '../lib/runners';
  import { runnerState } from '../lib/stores';
  import { createEventDispatcher } from 'svelte';

  export let profile: RunnerProfile;
  const dispatch = createEventDispatcher();
  $: state = runnerState(profile.id);

  function statusLabel(status: string, dist: number, pct: number): string {
    if (status === 'finished') return 'Finished 🏆';
    if (status === 'running')  return `${dist.toFixed(1)}mi · ${Math.round(pct)}%`;
    if (status === 'unknown')  return 'No data';
    return 'Pre-race';
  }

  $: r = $state;
</script>

<button
  class="pill"
  style="--pc: {profile.color}"
  on:click={() => dispatch('click')}
  title={profile.name}
>
  <span class="dot"></span>
  <span class="name">{profile.name.split(' ')[0]}</span>
  <span class="status">{statusLabel(r.status, r.distMi, r.pct)}</span>
</button>

<style>
  .pill {
    --pc: var(--blue);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--separator);
    background: var(--surface);
    cursor: pointer;
    transition: transform 80ms ease, border-color 100ms ease;
  }
  .pill:hover { transform: translateY(-1px); border-color: var(--pc); }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pc); }
  .name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
  .status { font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono); }
</style>
