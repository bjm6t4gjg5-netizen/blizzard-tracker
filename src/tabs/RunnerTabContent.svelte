<script lang="ts">
  import type { RunnerProfile } from '../lib/runners';
  import { runnerState, goalsStore, notify, runnerSettingsFor } from '../lib/stores';
  import RunnerCard from '../components/RunnerCard.svelte';
  import PaceChart from '../components/PaceChart.svelte';
  import CourseMap from '../components/CourseMap.svelte';
  import SpectatorList from '../components/SpectatorList.svelte';
  import SubTabs from '../components/SubTabs.svelte';
  import CareerCatherine from '../components/CareerCatherine.svelte';
  import CareerHelaine from '../components/CareerHelaine.svelte';
  import SixStar from '../components/SixStar.svelte';
  import VenmoButton from '../components/VenmoButton.svelte';
  import RunnerWaveCountdown from '../components/RunnerWaveCountdown.svelte';
  import { HELAINE_SUMMARY, CATHERINE_SUMMARY } from '../lib/career';
  import { formatHMS } from '../lib/format';
  import { waveLabel } from '../lib/runners';
  import { RACE_START } from '../lib/time';

  export let profile: RunnerProfile;
  let view: 'today' | 'career' = 'today';
  $: subTabs = [
    { key: 'today',  label: 'Today',  emoji: '⚡' },
    { key: 'career', label: 'Career', emoji: '🏅' },
  ];

  // Top-level store refs so Svelte's `$` autosubscribe works.
  $: state = runnerState(profile.id);
  $: goals = goalsStore(profile.id);

  const photosFor: Record<string, string[]> = {
    gf: [
      './photo-bkh2023.jpeg',
      './photo-kidrun.jpeg',
      './photo-berlin.jpeg',
      './photo-boston-start.jpeg',
      './photo-running.jpeg',
      './photo-met.jpeg',
    ],
    mom: [
      './photo-boston-medals.jpeg',
      './photo-dallas.jpeg',
      './photo-trashbag-helaine.jpeg',
      './photo-trashbag-both.jpeg',
      './photo-eugene.jpeg',
    ],
  };

  function sendCheer() {
    const url = `https://rtrt.me/bkh2026/track/${profile.trackId}#cheer`;
    window.open(url, '_blank', 'noopener,noreferrer');
    notify(`Cheer sent to ${profile.name.split(' ')[0]} 🎉`);
  }
</script>

<div class="hero" style="--pc: {profile.color}; background: linear-gradient(135deg, color-mix(in srgb, {profile.color} 22%, white), color-mix(in srgb, {profile.color} 8%, white));">
  <div class="hero-content">
    <div class="hero-left">
      <div class="hero-name-row">
        <div class="hero-name">{profile.emoji} {profile.name}</div>
        <button
          class="settings-btn"
          on:click={() => runnerSettingsFor.set(profile.id)}
          title="Edit goal, paces, age, gender"
          aria-label="Settings"
          data-tour="runner-settings"
        >⚙</button>
      </div>
      <div class="hero-sub">RBC Brooklyn Half 2026 · {profile.trackId} · Goal: {formatHMS($goals.goalSec)} ({$goals.goalLabel})</div>
      {#if profile.wave}
        <div class="hero-wave-row">
          <span class="hero-wave">🏁 {waveLabel(profile, RACE_START)}</span>
          <RunnerWaveCountdown {profile} />
        </div>
      {/if}
      {#if profile.id === 'gf'}
        <div class="hero-badges">
          <span class="hb">🏅 2× XC Champion (6th, 8th)</span>
          <span class="hb">🏆 2012 DPL City Meet MVP</span>
          <span class="hb mono">3:06:12 marathon PR</span>
        </div>
        {#if CATHERINE_SUMMARY.starCount > 0}
          <div class="hero-stars">
            <SixStar stars={CATHERINE_SUMMARY.worldMajors} size="sm" title="World Major stars" />
          </div>
        {/if}
      {:else if profile.id === 'mom'}
        <div class="hero-badges">
          <span class="hb mono">{HELAINE_SUMMARY.marathons} marathons since {HELAINE_SUMMARY.firstYear}</span>
          <span class="hb">⭐ {HELAINE_SUMMARY.starCount} of 6 World Majors</span>
        </div>
        {#if HELAINE_SUMMARY.starCount > 0}
          <div class="hero-stars">
            <SixStar stars={HELAINE_SUMMARY.worldMajors} size="sm" title="World Major stars" />
          </div>
        {/if}
      {/if}
    </div>
    <div class="hero-cta">
      <button class="cheer" on:click={sendCheer}>📣 Send cheer</button>
      <VenmoButton variant="ghost" label={profile.id === 'gf' ? `🍺 Beer for ${profile.name.split(' ')[0]}` : '🍺 Buy them a beer'} note={profile.id === 'gf' ? 'Catherine — race-day beer 🍺' : 'For the Blizzards — race-day beer 🍺'} />
    </div>
  </div>
  {#if photosFor[profile.id]}
    <div class="strip">
      {#each photosFor[profile.id] as src}
        <div class="ps-item" style="background-image: url('{src}')"></div>
      {/each}
    </div>
  {/if}
</div>

<div data-tour="subtabs"><SubTabs bind:value={view} tabs={subTabs} /></div>

{#if view === 'career'}
  {#if profile.id === 'gf'}
    <CareerCatherine />
  {:else if profile.id === 'mom'}
    <CareerHelaine />
  {:else}
    <div class="card card-pad">No career data on file for this runner.</div>
  {/if}
{:else}
<div class="grid-2">
  <div class="col-left">
    <RunnerCard {profile} />
    <div class="card gap-md mini-map-card">
      <div class="card-header"><div class="card-title">📍 Live position</div></div>
      <div class="card-pad">
        <CourseMap detailed={false} runnerIds={[profile.id]} height="280px" />
      </div>
    </div>
  </div>
  <div class="col-right">
    <div class="card gap-md" data-tour="pace-chart">
      <div class="card-header"><div class="card-title">Pace plan & live trace</div></div>
      <div class="card-pad">
        <PaceChart goals={$goals} state={$state} />
      </div>
    </div>
    <SpectatorList runnerId={profile.id} title="Arrival estimates" />
  </div>
</div>
{/if}

<style>
  .hero {
    --pc: var(--blue);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    padding: 24px;
    margin-bottom: var(--gap-md);
    border: 1px solid var(--separator-soft);
  }
  .hero-content { display: flex; align-items: center; gap: var(--gap-md); }
  .hero-left { flex: 1; min-width: 0; }
  .hero-name-row { display: flex; align-items: center; gap: 10px; }
  .hero-name { font-weight: 800; font-size: 26px; letter-spacing: -0.8px; color: var(--text-primary); }
  .hero-sub { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
  .hero-wave-row {
    margin-top: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .hero-wave {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.8);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }
  .settings-btn {
    width: 36px; height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.55);
    color: var(--text-primary);
    font-size: 17px;
    cursor: pointer;
    transition: background 100ms ease, transform 80ms ease, border-color 100ms ease;
  }
  .settings-btn:hover {
    background: white;
    border-color: var(--pc);
    color: var(--pc);
    transform: rotate(45deg);
  }
  .hero-stars { margin-top: 12px; max-width: 520px; }
  .hero-badges { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
  .hb {
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.8);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .hero-cta {
    margin-left: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: stretch;
  }
  .cheer {
    border: none;
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    background: var(--pc);
    color: white;
    font-weight: 700;
    font-size: 13px;
    box-shadow: var(--shadow-sm);
    transition: transform 80ms ease;
    cursor: pointer;
    white-space: nowrap;
  }
  .cheer:hover { transform: translateY(-1px); }

  .strip {
    margin-top: 14px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
  }
  .ps-item {
    aspect-ratio: 3 / 4;
    background-size: cover;
    background-position: center 25%;
    border-radius: 10px;
    border: 3px solid white;
    box-shadow: var(--shadow-sm);
    transition: transform 200ms ease;
  }
  .ps-item:hover { transform: scale(1.04); }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap-md);
  }
  .col-left, .col-right { display: flex; flex-direction: column; gap: var(--gap-md); }

  .mini-map-card { padding-bottom: 0; }

  @media (max-width: 1024px) {
    /* iPad portrait */
    .hero { padding: 18px; }
    .hero-name { font-size: 22px; }
    .strip { grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); }
  }
  @media (max-width: 880px) {
    .grid-2 { grid-template-columns: 1fr; }
    .strip { grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); }
    .hero-name { font-size: 22px; }
    .hero-content { flex-wrap: wrap; }
    .hero-cta { width: 100%; flex-direction: row; }
    .cheer { flex: 1; }
  }
  @media (max-width: 540px) {
    .hero { padding: 14px; }
    .hero-name { font-size: 19px; }
    .hero-sub { font-size: 11px; }
    .settings-btn { width: 32px; height: 32px; font-size: 15px; }
    .strip { grid-template-columns: repeat(3, 1fr); }
  }
</style>
