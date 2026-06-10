<script lang="ts">
  import { onMount } from 'svelte';
  import { profiles } from '../lib/stores';
  import {
    CATHERINE_WEEKLY, HELAINE_WEEKLY,
    CATHERINE_RUNS, HELAINE_RUNS,
    CATHERINE_TRAINING, HELAINE_TRAINING,
    type RecentRun, type WeeklyMileage, type TrainingLocation,
  } from '../lib/trainingSample';
  import {
    fetchTrainingSummary, stravaConfigured, stravaConnectUrl,
    type TrainingSummary,
  } from '../lib/strava';
  import TrainingMap from '../components/TrainingMap.svelte';
  import TrainingMileageChart from '../components/TrainingMileageChart.svelte';

  $: gf  = $profiles.find(p => p.id === 'gf');
  $: mom = $profiles.find(p => p.id === 'mom');

  // ── Live Strava data (null → sample fallback) ──────────────
  let gfLive: TrainingSummary | null = null;
  let momLive: TrainingSummary | null = null;
  let loaded = false;

  const configured = stravaConfigured();

  onMount(async () => {
    if (configured) {
      [gfLive, momLive] = await Promise.all([
        fetchTrainingSummary('gf'),
        fetchTrainingSummary('mom'),
      ]);
    }
    loaded = true;
  });

  let gfWeekly: WeeklyMileage[];
  let momWeekly: WeeklyMileage[];
  let gfRuns: ReadonlyArray<RecentRun>;
  let momRuns: ReadonlyArray<RecentRun>;
  let gfLocs: ReadonlyArray<TrainingLocation>;
  let momLocs: ReadonlyArray<TrainingLocation>;
  $: gfWeekly  = gfLive?.weekly  ?? [...CATHERINE_WEEKLY];
  $: momWeekly = momLive?.weekly ?? [...HELAINE_WEEKLY];
  $: gfRuns    = gfLive?.recent  ?? CATHERINE_RUNS;
  $: momRuns   = momLive?.recent ?? HELAINE_RUNS;
  $: gfLocs    = gfLive?.locations?.length  ? gfLive.locations  : CATHERINE_TRAINING;
  $: momLocs   = momLive?.locations?.length ? momLive.locations : HELAINE_TRAINING;
  $: anyLive = !!(gfLive || momLive);
  /** Key forces the Leaflet map to rebuild when live data lands. */
  $: mapKey = `${gfLive ? 'g1' : 'g0'}-${momLive ? 'm1' : 'm0'}`;

  function liveBadge(s: TrainingSummary | null): string {
    if (!s?.fetchedAt) return 'sample data';
    const min = Math.round((Date.now() - s.fetchedAt) / 60_000);
    return min <= 1 ? 'live · just synced' : `live · synced ${min}m ago`;
  }

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
      case 'race':    return 'tone-workout';
      default:        return 'tone-easy';
    }
  }
</script>

<div class="head">
  <div>
    <h2 class="title">Training · Road to Chicago</h2>
    <p class="sub">
      {#if anyLive}
        Every run Catherine and Helaine record syncs Garmin → Strava → here, minutes after they finish.
      {:else if configured}
        Strava is configured but {loaded ? 'no runner has connected yet — sample data below.' : 'loading…'}
      {:else}
        Sample data below — connect Strava to make this live (see <code>worker/README.md</code>).
      {/if}
    </p>
  </div>
</div>

<!-- Strava connection status -->
<div class="card gap-md">
  <div class="card-header"><div class="card-title">🔗 Strava</div></div>
  <div class="card-pad strava-row">
    {#if gf}
      <div class="athlete-chip" style="--pc: {gf.color}">
        <span class="chip-name">{gf.emoji} {gf.name.split(' ')[0]}</span>
        {#if gfLive}
          <span class="chip-state ok">{liveBadge(gfLive)}</span>
        {:else if configured}
          <a class="chip-cta" href={stravaConnectUrl('gf')} target="_blank" rel="noopener">Connect Strava →</a>
        {:else}
          <span class="chip-state">{liveBadge(null)}</span>
        {/if}
      </div>
    {/if}
    {#if mom}
      <div class="athlete-chip" style="--pc: {mom.color}">
        <span class="chip-name">{mom.emoji} {mom.name.split(' ')[0]}</span>
        {#if momLive}
          <span class="chip-state ok">{liveBadge(momLive)}</span>
        {:else if configured}
          <a class="chip-cta" href={stravaConnectUrl('mom')} target="_blank" rel="noopener">Connect Strava →</a>
        {:else}
          <span class="chip-state">{liveBadge(null)}</span>
        {/if}
      </div>
    {/if}
  </div>
</div>

<!-- Training-geography heat map -->
<div class="card gap-md">
  <div class="card-header">
    <div class="card-title">🌍 Training geography</div>
    <div class="legend">
      {#if gf}<span><span class="dot" style="background:{gf.color}"></span>{gf.name.split(' ')[0]}</span>{/if}
      {#if mom}<span><span class="dot" style="background:{mom.color}"></span>{mom.name.split(' ')[0]}</span>{/if}
      <span><span class="dot dot-chi"></span>Race day: Chicago 🏆</span>
    </div>
  </div>
  <div class="card-pad">
    {#key mapKey}
      <TrainingMap height="440px" catherineLocations={gfLocs} helaineLocations={momLocs} />
    {/key}
  </div>
</div>

<!-- Weekly mileage -->
<div class="grid-2 gap-md">
  {#if gf}
    <div class="card">
      <div class="card-header">
        <div class="card-title">{gf.emoji} {gf.name.split(' ')[0]} · weekly mileage</div>
        <div class="src-badge" class:live={!!gfLive}>{liveBadge(gfLive)}</div>
      </div>
      <div class="card-pad"><TrainingMileageChart weeks={gfWeekly} color={gf.color} /></div>
    </div>
  {/if}
  {#if mom}
    <div class="card">
      <div class="card-header">
        <div class="card-title">{mom.emoji} {mom.name.split(' ')[0]} · weekly mileage</div>
        <div class="src-badge" class:live={!!momLive}>{liveBadge(momLive)}</div>
      </div>
      <div class="card-pad"><TrainingMileageChart weeks={momWeekly} color={mom.color} /></div>
    </div>
  {/if}
</div>

<!-- Recent runs -->
<div class="grid-2 gap-md">
  {#if gf}
    <div class="card">
      <div class="card-header"><div class="card-title">{gf.emoji} {gf.name.split(' ')[0]} · last 5 runs</div></div>
      <div class="runs">
        {#each gfRuns as r}
          <div class="run">
            <span class="r-type {typeTone(r.type)}">{r.type}</span>
            <div class="r-main">
              <div class="r-top">
                <span class="r-dist mono">{r.distanceMi.toFixed(1)} mi</span>
                <span class="r-pace mono">· {pace(r.paceSecPerMile)}</span>
                {#if r.hrAvg}<span class="r-hr mono">· {r.hrAvg} bpm</span>{/if}
              </div>
              <div class="r-meta">{fmtDate(r.date)}{r.city ? ` · ${r.city}` : ''}{r.notes ? ` · ${r.notes}` : ''}</div>
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
        {#each momRuns as r}
          <div class="run">
            <span class="r-type {typeTone(r.type)}">{r.type}</span>
            <div class="r-main">
              <div class="r-top">
                <span class="r-dist mono">{r.distanceMi.toFixed(1)} mi</span>
                <span class="r-pace mono">· {pace(r.paceSecPerMile)}</span>
                {#if r.hrAvg}<span class="r-hr mono">· {r.hrAvg} bpm</span>{/if}
              </div>
              <div class="r-meta">{fmtDate(r.date)}{r.city ? ` · ${r.city}` : ''}{r.notes ? ` · ${r.notes}` : ''}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--gap-md); }
  .title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 4px 0 2px; }
  .sub { color: var(--text-tertiary); font-size: 13px; margin: 0 0 var(--gap-md); }
  .sub code { background: var(--surface-2); padding: 1px 6px; border-radius: 4px; font-size: 11.5px; }

  .strava-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .athlete-chip {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    border: 1px solid var(--separator-soft);
    border-left: 3px solid var(--pc);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    background: var(--surface);
  }
  .chip-name { font-weight: 700; font-size: 13px; }
  .chip-state { font-size: 11.5px; color: var(--text-tertiary); }
  .chip-state.ok { color: var(--green); font-weight: 600; }
  .chip-cta {
    font-size: 12px;
    font-weight: 700;
    color: #FC4C02; /* Strava orange */
    text-decoration: none;
  }
  .chip-cta:hover { text-decoration: underline; }

  .src-badge {
    font-size: 10.5px;
    color: var(--text-tertiary);
    background: var(--surface-2);
    border-radius: 999px;
    padding: 2px 8px;
  }
  .src-badge.live { color: var(--green); font-weight: 600; }

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
  .r-meta { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  @media (max-width: 720px) {
    .grid-2 { grid-template-columns: 1fr; }
    .run { grid-template-columns: 60px 1fr; padding: 10px; }
    .legend { flex-wrap: wrap; gap: 8px; }
  }
</style>
