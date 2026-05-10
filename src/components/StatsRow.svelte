<script lang="ts">
  import type { RunnerProfile } from '../lib/runners';
  import { runnerState, goalsStore } from '../lib/stores';
  import { formatHMS } from '../lib/format';
  import { percentileFor } from '../lib/stats';

  export let profile: RunnerProfile;
  $: state = runnerState(profile.id);
  $: goals = goalsStore(profile.id);
  $: r = $state;
  $: g = $goals;
</script>

<tr>
  <td><span class="emoji">{profile.emoji}</span> {profile.name}</td>
  <td class="mono">{formatHMS(g.goalSec)}</td>
  <td class="mono">{r.etaSec ? formatHMS(r.etaSec) : '—'}</td>
  <td class="mono">Top {percentileFor(g.goalSec)}%</td>
  <td class="mono">{r.etaSec ? `Top ${percentileFor(r.etaSec)}%` : '—'}</td>
</tr>

<style>
  td { padding: 8px; border-bottom: 1px solid var(--separator-soft); font-size: 13px; }
  .emoji { font-size: 14px; }
</style>
