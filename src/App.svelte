<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    profiles, activeTab,
    refreshAll, startAutoRefresh, stopAutoRefresh,
    loadWeather, demoTimeMin,
  } from './lib/stores';
  import { runnerState } from './lib/stores';
  import { devUnlocked } from './lib/devMode';
  import { get } from 'svelte/store';
  import Header from './components/Header.svelte';
  import Tabs from './components/Tabs.svelte';
  import Footer from './components/Footer.svelte';
  import Toast from './components/Toast.svelte';
  import RunnersModal from './components/RunnersModal.svelte';
  import RunnerSettingsModal from './components/RunnerSettingsModal.svelte';
  import Confetti from './components/Confetti.svelte';
  import TourGuide from './components/TourGuide.svelte';
  import CoachDan from './components/CoachDan.svelte';
  import InstallBanner from './components/InstallBanner.svelte';
  import { maybeAutoStart } from './lib/tour';
  import FamilyHQ from './tabs/FamilyHQ.svelte';
  import RunnerTab from './tabs/RunnerTab.svelte';
  import WeatherTab from './tabs/WeatherTab.svelte';
  import StatsTab from './tabs/StatsTab.svelte';
  import OldRacesTab from './tabs/OldRacesTab.svelte';
  import TrainingTab from './tabs/TrainingTab.svelte';

  let mounted = false;

  onMount(() => {
    // ?sim=<minutes-past-7AM> — only honored when developer mode is unlocked,
    // so casual visitors can't drop into fake race state. e.g., ?sim=30 jumps
    // to 7:30 AM (Catherine ~4mi, Helaine pre-race).
    const params = new URLSearchParams(location.search);
    const sim = params.get('sim');
    if (sim != null && get(devUnlocked)) {
      const n = parseInt(sim, 10);
      if (Number.isFinite(n) && n >= -60 && n <= 240) demoTimeMin.set(n);
    }

    // Touch every runner state store so they exist before any tab renders.
    for (const p of $profiles) runnerState(p.id);

    startAutoRefresh(5_000);
    loadWeather();
    mounted = true;
    maybeAutoStart();
  });

  onDestroy(() => stopAutoRefresh());
</script>

<Header />

<main class="app-main">
  <div class="container">
    <Tabs />

    <div class="pane" class:active={$activeTab === 'family'}>
      {#if mounted}<FamilyHQ />{/if}
    </div>

    {#each $profiles as p (p.id)}
      <div class="pane" class:active={$activeTab === p.id}>
        {#if mounted && $activeTab === p.id}<RunnerTab profileId={p.id} />{/if}
      </div>
    {/each}

    <div class="pane" class:active={$activeTab === 'weather'}>
      {#if mounted && $activeTab === 'weather'}<WeatherTab />{/if}
    </div>

    <div class="pane" class:active={$activeTab === 'stats'}>
      {#if mounted && $activeTab === 'stats'}<StatsTab />{/if}
    </div>

    {#if $devUnlocked}
      <div class="pane" class:active={$activeTab === 'old-races'}>
        {#if mounted && $activeTab === 'old-races'}<OldRacesTab />{/if}
      </div>
      <div class="pane" class:active={$activeTab === 'training'}>
        {#if mounted && $activeTab === 'training'}<TrainingTab />{/if}
      </div>
    {/if}
  </div>
</main>

<Footer />
<Toast />
<RunnersModal />
<RunnerSettingsModal />
{#if mounted}
  <Confetti />
  <TourGuide />
  <CoachDan />
  <InstallBanner />
{/if}

<style>
  .app-main {
    flex: 1 0 auto;       /* push footer to the bottom on short pages */
    padding-bottom: 40px;
  }
  .pane {
    display: none;
  }
  .pane.active {
    display: block;
    animation: fadein 250ms ease;
  }
  @keyframes fadein {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
