<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { RunnerProfile } from '../lib/runners';
  import { runnerStartTime } from '../lib/runners';
  import { RACE_START } from '../lib/time';
  import { runnerState } from '../lib/stores';

  export let profile: RunnerProfile;

  $: state = runnerState(profile.id);
  $: target = runnerStartTime(profile, RACE_START);

  let nowMs = Date.now();
  let tick: ReturnType<typeof setInterval> | null = null;

  // 1s tick while we're counting down; once the runner is past their start
  // we don't need to keep recalculating per-second.
  onMount(() => {
    tick = setInterval(() => {
      nowMs = Date.now();
    }, 1000);
  });
  onDestroy(() => { if (tick) clearInterval(tick); });

  $: deltaMs = target.getTime() - nowMs;
  $: hasStarted = deltaMs <= 0;
  // Hide the countdown once RTRT or the simulator reports the runner is
  // already running or finished — at that point the countdown is moot.
  $: shouldShow = !hasStarted && ($state.status === 'pre' || $state.status === 'unknown');

  function fmt(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${String(s).padStart(2, '0')}s`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }
</script>

{#if shouldShow}
  <div class="cd-pill" title="Time until {profile.name.split(' ')[0]} crosses the start line">
    <span class="cd-emoji">⏱</span>
    <span class="cd-label">Starts in</span>
    <span class="cd-time mono">{fmt(deltaMs)}</span>
  </div>
{/if}

<style>
  .cd-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.85);
    font-size: 12px;
    color: var(--text-primary);
    font-weight: 600;
    backdrop-filter: blur(4px);
  }
  .cd-emoji { font-size: 12px; }
  .cd-label { color: var(--text-tertiary); font-weight: 500; }
  .cd-time {
    font-weight: 700;
    letter-spacing: -0.2px;
  }
</style>
