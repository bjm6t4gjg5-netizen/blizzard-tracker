<script lang="ts">
  import type { RunnerProfile, RunnerState, RunnerGoals } from '../lib/runners';
  import { runnerState, goalsStore, runnerSettingsFor } from '../lib/stores';
  import { CHECKPOINTS } from '../lib/course';
  import { TOTAL_MI } from '../lib/time';
  import { formatHMS, formatHMSFull, formatPace } from '../lib/format';

  export let profile: RunnerProfile;

  $: state = runnerState(profile.id);
  $: goals = goalsStore(profile.id);
  $: r = $state;
  $: g = $goals;

  $: paceStr = formatPace(r.elapsedSec, r.distMi);

  function statusBadge(status: string): { label: string; tone: string } {
    if (status === 'finished') return { label: 'Finished', tone: 'finished' };
    if (status === 'running')  return { label: 'Running',  tone: 'running' };
    if (status === 'unknown')  return { label: 'No data',  tone: 'unknown' };
    return { label: 'Pre-race', tone: 'pre' };
  }

  $: badge = statusBadge(r.status);

  function goalDelta(state: RunnerState, goals: RunnerGoals): { tone: 'ahead'|'behind'|'on'|'na'; text: string } {
    if (state.etaSec == null) return { tone: 'na', text: 'Awaiting data' };
    const diff = state.etaSec - goals.goalSec;
    const abs = Math.abs(diff);
    const m = Math.floor(abs / 60);
    const s = Math.round(abs % 60);
    const fmt = `${m}:${String(s).padStart(2, '0')}`;
    if (Math.abs(diff) < 30)        return { tone: 'on',     text: `On ${goals.goalLabel} pace` };
    if (diff < 0)                   return { tone: 'ahead',  text: `${fmt} ahead of ${goals.goalLabel}` };
    return                                  { tone: 'behind', text: `${fmt} behind ${goals.goalLabel}` };
  }

  $: gd = goalDelta(r, g);
</script>

<div class="card runner-card" style="--pc: {profile.color}">
  <div class="top">
    <div class="avatar">{profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
    <div class="who">
      <div class="name">{profile.emoji} {profile.name}</div>
      <div class="sub">Tracker · {profile.trackId}</div>
    </div>
    <span class="status status-{badge.tone}">
      <span class="dot"></span>
      {badge.label}
    </span>
  </div>

  <div class="stats-row">
    <div class="stat">
      <div class="lbl">Distance</div>
      <div class="num">{r.distMi > 0 ? r.distMi.toFixed(2) : '—'}</div>
      <div class="unit">of 13.1 mi</div>
    </div>
    <div class="stat">
      <div class="lbl">Elapsed</div>
      <div class="num">{r.elapsedSec > 0 ? formatHMS(r.elapsedSec) : '—'}</div>
      <div class="unit">H:MM:SS</div>
    </div>
    <div class="stat">
      <div class="lbl">Avg Pace</div>
      <div class="num">{paceStr}</div>
      <div class="unit">min/mi</div>
    </div>
  </div>

  <div class="progress">
    <div class="progress-track">
      <div class="progress-fill" style="width: {Math.min(100, r.pct)}%"></div>
    </div>
    <div class="cps">
      {#each CHECKPOINTS as cp}
        <div
          class="cp"
          class:hit={r.distMi >= cp.mi - 0.05}
          style="left: {(cp.mi / TOTAL_MI) * 100}%"
          title="{cp.label} · mile {cp.mi.toFixed(1)}"
        ></div>
      {/each}
    </div>
  </div>

  <div class="eta-strip eta-{gd.tone}">
    <div class="eta-block">
      <div class="lbl">Predicted finish</div>
      <div class="eta-num">{r.etaSec ? formatHMSFull(r.etaSec) : '—:—:—'}</div>
    </div>
    <div class="eta-conf">
      <div class="lbl">Confidence</div>
      <div class="eta-conf-num">{r.confidence}%</div>
    </div>
    <div class="eta-goal">
      {gd.text}
    </div>
  </div>

  {#if r.splits.length}
    <div class="splits">
      <div class="splits-label">Splits</div>
      <table>
        <thead><tr><th>Checkpoint</th><th>Clock</th><th>Pace</th></tr></thead>
        <tbody>
          {#each r.splits as s}
            <tr><td>{s.label}</td><td class="mono">{s.chipTime}</td><td class="mono">{s.pace}</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if r.lastUpdate}
    <div class="upd mono">
      Updated {Math.round((Date.now() - r.lastUpdate) / 1000)}s ago via {r.source ?? '—'}
    </div>
  {/if}
</div>

<style>
  .runner-card { padding: 16px; }

  .top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--pc) 14%, white);
    color: var(--pc);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700;
    font-size: 14px;
    border: 1.5px solid color-mix(in srgb, var(--pc) 35%, white);
  }
  .who { flex: 1; min-width: 0; }
  .name { font-weight: 700; font-size: 17px; letter-spacing: -0.3px; }
  .sub { font-size: 11px; color: var(--text-tertiary); font-family: var(--font-mono); }

  .status {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 600;
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

  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }
  .stat {
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 10px;
    text-align: center;
  }
  .lbl {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.4px; color: var(--text-tertiary);
  }
  .num {
    font-family: var(--font-mono); font-variant-numeric: tabular-nums;
    font-weight: 700; font-size: 20px; color: var(--pc);
    margin: 2px 0;
  }
  .unit { font-size: 10px; color: var(--text-muted); }

  .progress { position: relative; margin-bottom: 16px; padding-top: 8px; padding-bottom: 16px; }
  .progress-track {
    height: 10px;
    background: var(--surface-2);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
    z-index: 1;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--pc), color-mix(in srgb, var(--pc) 60%, white));
    border-radius: 999px;
    transition: width 600ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .cps { position: absolute; inset: 8px 0 0 0; pointer-events: none; }
  .cp {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    width: 10px; height: 10px;
    border-radius: 50%;
    background: white;
    border: 2px solid var(--text-muted);
    z-index: 2;
  }
  .cp.hit { background: var(--pc); border-color: var(--pc); }

  .eta-strip {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--pc) 8%, white);
    border: 1px solid color-mix(in srgb, var(--pc) 18%, transparent);
  }
  .eta-num {
    font-family: var(--font-mono); font-variant-numeric: tabular-nums;
    font-weight: 700; font-size: 22px; color: var(--pc);
    letter-spacing: -0.4px; margin-top: 2px;
  }
  .eta-conf-num { font-weight: 700; font-size: 16px; color: var(--text-primary); }
  .eta-goal {
    text-align: right;
    font-size: 12px;
    font-weight: 600;
  }
  .eta-ahead .eta-goal   { color: var(--green); }
  .eta-behind .eta-goal  { color: var(--orange); }
  .eta-on .eta-goal      { color: var(--blue); }
  .eta-na .eta-goal      { color: var(--text-muted); font-weight: 400; }

  .splits { margin-top: 14px; }
  .splits-label {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.5px; color: var(--text-tertiary); margin-bottom: 6px;
  }
  .splits table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .splits th { text-align: left; padding: 4px 6px; font-weight: 500; color: var(--text-tertiary); border-bottom: 1px solid var(--separator-soft); }
  .splits td { padding: 6px; border-bottom: 1px solid var(--separator-soft); }
  .upd { margin-top: 10px; font-size: 10px; color: var(--text-muted); text-align: right; }

  @media (max-width: 540px) {
    .runner-card { padding: 12px; }
    .stats-row { gap: 6px; }
    .stat { padding: 8px 6px; }
    .num { font-size: 17px; }
    .lbl { font-size: 9px; }
    .eta-strip { grid-template-columns: 1fr 1fr; padding: 10px 12px; gap: 8px; }
    .eta-goal { grid-column: 1 / -1; text-align: left; padding-top: 6px; border-top: 1px solid var(--separator-soft); }
    .eta-num { font-size: 19px; }
  }
</style>
