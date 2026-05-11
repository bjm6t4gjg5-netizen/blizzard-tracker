<script lang="ts">
  import { profiles } from '../lib/stores';
  import {
    CATHERINE_WEEKLY, HELAINE_WEEKLY,
    CATHERINE_RUNS, HELAINE_RUNS,
    type RecentRun,
  } from '../lib/trainingSample';
  import TrainingMap from '../components/TrainingMap.svelte';
  import TrainingMileageChart from '../components/TrainingMileageChart.svelte';

  $: gf  = $profiles.find(p => p.id === 'gf');
  $: mom = $profiles.find(p => p.id === 'mom');

  function pace(secPerMile: number): string {
    const m = Math.floor(secPerMile / 60);
    const s = Math.round(secPerMile % 60);
    return `${m}:${String(s).padStart(2, '0')}/mi`;
  }
  function fmtDate(d: string): string {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function typeTone(t: RecentRun['type']): string {
    switch (t) {
      case 'easy':    return 'tone-easy';
      case 'tempo':   return 'tone-tempo';
      case 'long':    return 'tone-long';
      case 'workout': return 'tone-workout';
      default:        return 'tone-easy';
    }
  }
</script>

<div class="head">
  <div>
    <h2 class="title">Training</h2>
    <p class="sub">
      Dev-only preview. Sample data today — wired to Strava (auto-synced from Garmin)
      after Brooklyn Half. Full plan: <code>docs/GARMIN_PLAN.md</code>.
    </p>
  </div>
</div>

<!-- Training-geography heat map -->
<div class="card gap-md">
  <div class="card-header">
    <div class="card-title">🌍 Training geography</div>
    <div class="legend">
      {#if gf}<span><span class="dot" style="background:{gf.color}"></span>{gf.name.split(' ')[0]}</span>{/if}
      {#if mom}<span><span class="dot" style="background:{mom.color}"></span>{mom.name.split(' ')[0]}</span>{/if}
      <span><span class="dot dot-chi"></span>Next: Chicago 🏆</span>
    </div>
  </div>
  <div class="card-pad">
    <TrainingMap height="440px" />
  </div>
</div>

<!-- Weekly mileage -->
<div class="grid-2 gap-md">
  {#if gf}
    <div class="card">
      <div class="card-header"><div class="card-title">{gf.emoji} {gf.name.split(' ')[0]} · weekly mileage</div></div>
      <div class="card-pad"><TrainingMileageChart weeks={CATHERINE_WEEKLY} color={gf.color} /></div>
    </div>
  {/if}
  {#if mom}
    <div class="card">
      <div class="card-header"><div class="card-title">{mom.emoji} {mom.name.split(' ')[0]} · weekly mileage</div></div>
      <div class="card-pad"><TrainingMileageChart weeks={HELAINE_WEEKLY} color={mom.color} /></div>
    </div>
  {/if}
</div>

<!-- Recent runs -->
<div class="grid-2 gap-md">
  {#if gf}
    <div class="card">
      <div class="card-header"><div class="card-title">{gf.emoji} {gf.name.split(' ')[0]} · last 5 runs</div></div>
      <div class="runs">
        {#each CATHERINE_RUNS as r}
          <div class="run">
            <span class="r-type {typeTone(r.type)}">{r.type}</span>
            <div class="r-main">
              <div class="r-top">
                <span class="r-dist mono">{r.distanceMi.toFixed(1)} mi</span>
                <span class="r-pace mono">· {pace(r.paceSecPerMile)}</span>
                {#if r.hrAvg}<span class="r-hr mono">· {r.hrAvg} bpm</span>{/if}
              </div>
              <div class="r-meta">{fmtDate(r.date)} · {r.city}{r.notes ? ` · ${r.notes}` : ''}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
  {#if mom}
    <div class="card">
      <div class="card-header"><div class="card-title">{mom.emoji} {mom.name.split(' ')[0]} · last 5 runs</div></div>
      <div class="runs">
        {#each HELAINE_RUNS as r}
          <div class="run">
            <span class="r-type {typeTone(r.type)}">{r.type}</span>
            <div class="r-main">
              <div class="r-top">
                <span class="r-dist mono">{r.distanceMi.toFixed(1)} mi</span>
                <span class="r-pace mono">· {pace(r.paceSecPerMile)}</span>
                {#if r.hrAvg}<span class="r-hr mono">· {r.hrAvg} bpm</span>{/if}
              </div>
              <div class="r-meta">{fmtDate(r.date)} · {r.city}{r.notes ? ` · ${r.notes}` : ''}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- Integration plan summary -->
<div class="card">
  <div class="card-header"><div class="card-title">🛠 Integration plan (placeholder data above)</div></div>
  <div class="card-pad">
    <p class="plan">
      Final stack: Garmin → Strava (auto-sync, already enabled) → Cloudflare Worker
      (token exchange + cache) → this app.<br>
      OAuth: Strava v2 · API: <code>/athlete/activities</code> · <code>/streams</code> · cached 15&nbsp;min<br>
      Effort: ~1 day focused work · Cost: free (Workers free tier).<br>
      Full architecture in <code>docs/GARMIN_PLAN.md</code>.
    </p>
  </div>
</div>

<style>
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--gap-md); }
  .title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 4px 0 2px; }
  .sub { color: var(--text-tertiary); font-size: 13px; margin: 0 0 var(--gap-md); }
  .sub code { background: var(--surface-2); padding: 1px 6px; border-radius: 4px; font-size: 11.5px; }

  .legend {
    display: flex;
    gap: 14px;
    font-size: 11px;
    color: var(--text-tertiary);
  }
  .legend > span { display: inline-flex; align-items: center; gap: 5px; }
  .dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot-chi { background: linear-gradient(135deg, #FF9500, #FF3B30); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-md); }

  .runs { display: flex; flex-direction: column; }
  .run {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 12px;
    padding: 10px 14px;
    border-top: 1px solid var(--separator-soft);
    align-items: center;
  }
  .run:first-child { border-top: none; }
  .r-type {
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    text-align: center;
    color: white;
  }
  .tone-easy    { background: var(--blue); }
  .tone-tempo   { background: var(--orange); }
  .tone-long    { background: var(--green); }
  .tone-workout { background: var(--red); }

  .r-main { min-width: 0; }
  .r-top { font-weight: 600; font-size: 13px; }
  .r-dist { color: var(--text-primary); }
  .r-pace, .r-hr { color: var(--text-secondary); margin-left: 2px; }
  .r-meta { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }

  .plan { font-size: 12.5px; color: var(--text-secondary); margin: 0; line-height: 1.6; }
  .plan code { background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 11.5px; }

  @media (max-width: 720px) {
    .grid-2 { grid-template-columns: 1fr; }
    .run { grid-template-columns: 60px 1fr; padding: 10px; }
    .legend { flex-wrap: wrap; gap: 8px; }
  }
</style>
