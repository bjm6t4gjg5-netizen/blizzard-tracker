<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    profiles, activeTab,
    refreshAll, startAutoRefresh, stopAutoRefresh,
    loadWeather, demoMode,
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
  import { maybeAutoStart } from './lib/tour';
  import FamilyHQ from './tabs/FamilyHQ.svelte';
  import RunnerTab from './tabs/RunnerTab.svelte';
  import WeatherTab from './tabs/WeatherTab.svelte';
  import StatsTab from './tabs/StatsTab.svelte';
  import type { DemoStage } from './lib/rtrt';

  let mounted = false;

  onMount(() => {
    // ?demo=early|park|ocean|late|finish|pre — only honored when developer
    // mode is unlocked, so casual visitors can't trigger fake race state.
    const params = new URLSearchParams(location.search);
    const demo = params.get('demo');
    if (demo && get(devUnlocked)) demoMode.set(demo as DemoStage);

    // Touch every runner state store so they exist before any tab renders.
    for (const p of $profiles) runnerState(p.id);

    startAutoRefresh(60_000);
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
  </div>
</main>

<Footer />
<Toast />
<RunnersModal />
<RunnerSettingsModal />
{#if mounted}
  <Confetti />
  <TourGuide />
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
