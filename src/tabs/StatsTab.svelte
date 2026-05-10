<script lang="ts">
  import { profiles, runnerState, goalsStore } from '../lib/stores';
  import {
    FIELD_HEADLINES, WOMEN_AGE_GROUPS, percentileFor, ageGroupFor,
  } from '../lib/stats';
  import { formatHMS, parseGoalTime } from '../lib/format';
  import { RACE_START } from '../lib/time';
  import DistributionChart from '../components/DistributionChart.svelte';
  import StatsRow from '../components/StatsRow.svelte';

  let lookupTime = '2:00:00';
  let lookupResult = '';
  function doLookup() {
    const sec = parseGoalTime(lookupTime);
    if (sec == null) {
      lookupResult = 'Invalid format. Try 1:30:00';
      return;
    }
    const pct = percentileFor(sec);
    lookupResult = `Top ${pct}% of the field`;
  }

  /** For each women's age band, list which of our runners falls into it. */
  $: ageBandRunners = (() => {
    const map = new Map<string, typeof $profiles>();
    for (const p of $profiles) {
      if (p.gender !== 'F' || p.age == null) continue;
      const band = ageGroupFor(p.age);
      if (!band) continue;
      if (!map.has(band.range)) map.set(band.range, [] as any);
      (map.get(band.range) as any).push(p);
    }
    return map;
  })();
</script>

<h2 class="title">Race stats &amp; field analysis</h2>
<p class="sub">Numbers are estimates from RBC Brooklyn Half 2024–2025 public results.</p>

<div class="hist-grid gap-md">
  <div class="hist-card"><div class="hist-num" style="color: var(--blue)">{FIELD_HEADLINES.finishers.toLocaleString()}</div><div class="hist-lbl">2025 Finishers</div></div>
  <div class="hist-card"><div class="hist-num">{formatHMS(FIELD_HEADLINES.overallMedianSec)}</div><div class="hist-lbl">Overall median</div></div>
  <div class="hist-card"><div class="hist-num" style="color: var(--green)">{formatHMS(FIELD_HEADLINES.womensWinnerSec)}</div><div class="hist-lbl">Women's winner</div></div>
  <div class="hist-card"><div class="hist-num" style="color: var(--purple)">{formatHMS(FIELD_HEADLINES.womensMedianSec)}</div><div class="hist-lbl">Women's median</div></div>
  <div class="hist-card"><div class="hist-num" style="color: var(--orange)">+{FIELD_HEADLINES.elevationPenaltyPct}%</div><div class="hist-lbl">Elevation penalty</div></div>
  <div class="hist-card"><div class="hist-num">{FIELD_HEADLINES.typicalRaceTempF}°F</div><div class="hist-lbl">Typical race temp</div></div>
</div>

<div class="grid-2 gap-md">
  <div class="card">
    <div class="card-header"><div class="card-title">Women's median by age group · 2025 est.</div></div>
    <div class="card-pad ag-list">
      {#each WOMEN_AGE_GROUPS as ag}
        {@const here = ageBandRunners.get(ag.range)}
        <div class="ag-row" class:hit={!!here}>
          <span class="range">{ag.range}</span>
          <span class="mono median">{ag.label}</span>
          {#if here}
            <span class="runners">
              {#each here as p}
                <span class="r-tag" style="--pc: {p.color}">{p.emoji} {p.name.split(' ')[0]}</span>
              {/each}
            </span>
          {/if}
        </div>
      {/each}
      {#if ageBandRunners.size === 0}
        <div class="empty">Set age + gender in each runner's ⚙ settings to see which band they fall into.</div>
      {/if}
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">Finish-time distribution · 2025</div></div>
    <div class="card-pad">
      <DistributionChart />
    </div>
  </div>
</div>

<div class="card gap-md">
  <div class="card-header"><div class="card-title">Goal vs prediction</div></div>
  <div class="card-pad">
    <table class="cmp">
      <thead>
        <tr><th>Runner</th><th>Goal</th><th>Predicted</th><th>Goal percentile</th><th>ETA percentile</th></tr>
      </thead>
      <tbody>
        {#each $profiles as p (p.id)}
          <StatsRow profile={p} />
        {/each}
      </tbody>
    </table>
  </div>
</div>

<div class="card">
  <div class="card-header"><div class="card-title">Lookup any finish time</div></div>
  <div class="card-pad lookup">
    <span class="lbl">Finish time</span>
    <input class="form-input" bind:value={lookupTime} placeholder="2:00:00" />
    <button class="btn btn-sm" on:click={doLookup}>Look up</button>
    {#if lookupResult}<span class="lookup-result">{lookupResult}</span>{/if}
  </div>
</div>

<style>
  .title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 4px 0 2px; }
  .sub { color: var(--text-tertiary); font-size: 13px; margin: 0 0 var(--gap-md); }

  .hist-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 10px;
  }
  .hist-card {
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 14px;
    text-align: center;
    box-shadow: var(--shadow-sm);
  }
  .hist-num {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: var(--text-primary);
  }
  .hist-lbl { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap-md); }

  .ag-list { padding: 0 14px; }
  .ag-row {
    display: grid;
    grid-template-columns: 70px 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px solid var(--separator-soft);
    font-size: 13px;
  }
  .ag-row:last-child { border-bottom: none; }
  .ag-row.hit {
    border-radius: var(--radius-sm);
    margin: 0 -10px;
    padding: 9px 10px;
    background: var(--blue-soft);
  }
  .range { font-weight: 600; color: var(--text-secondary); }
  .median { color: var(--text-primary); }
  .runners { display: flex; flex-wrap: wrap; gap: 4px; }
  .r-tag {
    --pc: var(--blue);
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--pc);
    color: white;
    font-size: 10.5px;
    font-weight: 700;
  }
  .empty { font-size: 12px; color: var(--text-tertiary); padding: 12px 0; font-style: italic; }

  .cmp { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cmp th { text-align: left; padding: 6px 8px; font-weight: 600; color: var(--text-tertiary); border-bottom: 1px solid var(--separator-soft); }

  .lookup { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .lookup .lbl { color: var(--text-secondary); font-size: 13px; }
  .lookup .form-input { width: 110px; }
  .lookup-result { padding: 4px 12px; background: var(--blue-soft); color: var(--blue); border-radius: 999px; font-weight: 600; font-size: 12px; }

  @media (max-width: 980px) {
    .hist-grid { grid-template-columns: repeat(3, 1fr); }
    .grid-2 { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .hist-grid { grid-template-columns: repeat(2, 1fr); }
    .ag-row { grid-template-columns: 1fr 1fr; }
    .runners { grid-column: 1 / -1; }
  }
</style>
