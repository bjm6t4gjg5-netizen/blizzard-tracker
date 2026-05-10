<script lang="ts">
  import type { RunnerProfile } from '../lib/runners';
  import { runnerState } from '../lib/stores';

  export let profile: RunnerProfile;
  export let mi: number;

  $: state = runnerState(profile.id);
  $: r = $state;

  function eta(distMi: number, elapsedSec: number, target: number): { text: string; tone: string } {
    if (distMi <= 0 || elapsedSec <= 0) return { text: 'Pre-race', tone: 'tbd' };
    if (distMi >= target)               return { text: 'Passed',  tone: 'past' };
    const pace = elapsedSec / Math.max(distMi, 0.01);
    const remaining = (target - distMi) * pace;
    const m = Math.floor(remaining / 60);
    const s = Math.round(remaining % 60);
    const tone = remaining < 60 ? 'soon' : 'wait';
    return { text: `~${m}:${String(s).padStart(2, '0')}`, tone };
  }

  $: e = eta(r.distMi, r.elapsedSec, mi);
</script>

<div class="eta eta-{e.tone}" style="--pc: {profile.color}">
  <span class="eta-emoji">{profile.emoji}</span>
  <span class="eta-text">{e.text}</span>
</div>

<style>
  .eta {
    --pc: var(--blue);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    background: var(--surface-2);
    color: var(--text-primary);
    font-family: var(--font-mono);
  }
  .eta-emoji { filter: saturate(0.8); }
  .eta-past { background: rgba(0,0,0,0.04); color: var(--text-muted); }
  .eta-soon { background: var(--pc); color: white; animation: pulse-bg 1.5s ease infinite; }
  .eta-wait { background: color-mix(in srgb, var(--pc) 12%, white); color: var(--pc); }
  .eta-tbd  { background: var(--surface-2); color: var(--text-muted); }
  @keyframes pulse-bg { 50% { opacity: 0.85; } }
</style>
