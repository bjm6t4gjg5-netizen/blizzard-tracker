<script lang="ts">
  import { onMount } from 'svelte';
  import { profiles } from '../lib/stores';
  import type { RecentRun, TrainingLocation } from '../lib/trainingSample';
  import {
    fetchTrainingSummary, stravaConfigured, stravaConnectUrl,
    type TrainingSummary,
  } from '../lib/strava';
  import TrainingMap from '../components/TrainingMap.svelte';
  import TrainingMileageChart from '../components/TrainingMileageChart.svelte';

  $: gf  = $profiles.find(p => p.id === 'gf');
  $: mom = $profiles.find(p => p.id === 'mom');

  // ── Live Strava data only — no sample/placeholder data. ────
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

  const EMPTY_LOCS: ReadonlyArray<TrainingLocation> = [];
  let gfLocs: ReadonlyArray<TrainingLocation> = EMPTY_LOCS;
  let momLocs: ReadonlyArray<TrainingLocation> = EMPTY_LOCS;
  $: gfLocs  = gfLive?.locations  ?? EMPTY_LOCS;
  $: momLocs = momLive?.locations ?? EMPTY_LOCS;
  $: anyLive = !!(gfLive || momLive);
  /** Key forces the Leaflet map to rebuild when live data lands. */
  $: mapKey = `${gfLive ? 'g1' : 'g0'}-${momLive ? 'm1' : 'm0'}`;

  function liveBadge(s: TrainingSummary | null): string {
    if (!s?.fetchedAt) return 'not connected';
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
        {loaded ? 'Strava is set up — each runner just needs to tap Connect below.' : 'Loading training data…'}
      {:else}
        Live training data needs the Strava worker deployed once — see <code>worker/README.md</code>. No placeholder data here: what you see is real or nothing.
      {/if}
    </p>
  </div>
</div>

<!-- Per-runner Strava connection -->
<div class="grid-2 gap-md">
  {#each [gf, mom] as p, i}
    {#if p}
      {@const live = i === 0 ? gfLive : momLive}
      <div class="card athlete-card" style="--pc: {p.color}">
        <div class="card-pad athlete-row">
          <div class="athlete-id">
            <span class="a-emoji">{p.emoji}</span>
            <div>
              <div class="a-name">{p.name.split(' ')[0]}</div>
              <div class="a-state" class:ok={!!live}>{liveBadge(live)}</div>
            </div>
          </div>
          <div class="athlete-actions">
            {#if p.stravaUrl}
              <a class="a-link" href={p.stravaUrl} target="_blank" rel="noopener">View profile ↗</a>
            {/if}
            {#if !live && configured && (p.id === 'gf' || p.id === 'mom')}
              <a class="a-connect" href={stravaConnectUrl(p.id)} target="_blank" rel="noopener">Connect Strava</a>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/each}
</div>

{#if anyLive}
  <!-- Training-geography heat map -->
  <div class="card gap-md">
    <div class="card-header">
      <div class="card-title">🌍 Training geography</div>
      <div class="legend">
        {#if gfLive && gf}<span><span class="dot" style="background:{gf.color}"></span>{gf.name.split(' ')[0]}</span>{/if}
        {#if momLive && mom}<span><span class="dot" style="background:{mom.color}"></span>{mom.name.split(' ')[0]}</span>{/if}
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
    {#if gf && gfLive?.weekly}
      <div class="card">
        <div class="card-header">
          <div class="card-title">{gf.emoji} {gf.name.split(' ')[0]} · weekly mileage</div>
          <div class="src-badge live">{liveBadge(gfLive)}</div>
        </div>
        <div class="card-pad"><TrainingMileageChart weeks={gfLive.weekly} color={gf.color} /></div>
      </div>
    {/if}
    {#if mom && momLive?.weekly}
      <div class="card">
        <div class="card-header">
          <div class="card-title">{mom.emoji} {mom.name.split(' ')[0]} · weekly mileage</div>
          <div class="src-badge live">{liveBadge(momLive)}</div>
        </div>
        <div class="card-pad"><TrainingMileageChart weeks={momLive.weekly} color={mom.color} /></div>
      </div>
    {/if}
  </div>

  <!-- Recent runs -->
  <div class="grid-2 gap-md">
    {#each [{ p: gf, live: gfLive }, { p: mom, live: momLive }] as entry}
      {#if entry.p && entry.live?.recent?.length}
        <div class="card">
          <div class="card-header"><div class="card-title">{entry.p.emoji} {entry.p.name.split(' ')[0]} · last {entry.live.recent.length} runs</div></div>
          <div class="runs">
            {#each entry.live.recent as r}
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
    {/each}
  </div>
{:else if loaded}
  <!-- No data yet — honest empty state, no fake charts. -->
  <div class="card card-pad empty">
    <div class="empty-emoji">🏃‍♀️📡</div>
    <div class="empty-title">No training data yet</div>
    <p class="empty-sub">
      {#if configured}
        Once Catherine and Helaine tap <strong>Connect Strava</strong> above, their weekly
        mileage, recent runs, and a training-geography heat map appear here — updated
        automatically after every run they record.
      {:else}
        One-time setup: deploy the tiny Strava worker (<code>worker/README.md</code>, ~15 min,
        free), then each runner taps Connect. After that, every recorded practice run
        shows up here automatically.
      {/if}
    </p>
  </div>
{/if}

<style>
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--gap-md); }
  .title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 4px 0 2px; }
  .sub { color: var(--text-tertiary); font-size: 13px; margin: 0 0 var(--gap-md); }
  .sub code { background: var(--surface-2); padding: 1px 6px; border-radius: 4px; font-size: 11.5px; }

  .athlete-card { border-left: 3px solid var(--pc); }
  .athlete-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .athlete-id { display: flex; align-items: center; gap: 10px; }
  .a-emoji { font-size: 22px; }
  .a-name { font-weight: 700; font-size: 14px; }
  .a-state { font-size: 11.5px; color: var(--text-tertiary); }
  .a-state.ok { color: var(--green); font-weight: 600; }
  .athlete-actions { display: flex; align-items: center; gap: 12px; }
  .a-link { font-size: 12px; color: var(--blue); text-decoration: none; }
  .a-link:hover { text-decoration: underline; }
  .a-connect {
    font-size: 12px;
    font-weight: 700;
    color: white;
    background: #FC4C02; /* Strava orange */
    padding: 7px 12px;
    border-radius: var(--radius-sm);
    text-decoration: none;
  }
  .a-connect:hover { filter: brightness(1.08); }

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

  .empty { text-align: center; padding: 42px 24px; }
  .empty-emoji { font-size: 34px; }
  .empty-title { font-weight: 700; font-size: 17px; margin: 8px 0 4px; }
  .empty-sub { font-size: 13px; color: var(--text-tertiary); max-width: 480px; margin: 0 auto; line-height: 1.6; }
  .empty-sub code { background: var(--surface-2); padding: 1px 6px; border-radius: 4px; font-size: 11.5px; }

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
