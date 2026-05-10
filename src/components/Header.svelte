<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { RACE_START, countdownTo } from '../lib/time';
  import {
    profiles, runnerState, activeTab,
    refreshAll, lastRefreshAt, refreshing, demoMode,
  } from '../lib/stores';
  import type { DemoStage } from '../lib/rtrt';
  import RunnerPill from './RunnerPill.svelte';
  import { devUnlocked, lockDevMode } from '../lib/devMode';
  import AppearanceModal from './AppearanceModal.svelte';
  import { openTour } from '../lib/tour';

  let appearanceOpen = false;

  let cd = countdownTo(RACE_START);
  let cdHandle: ReturnType<typeof setInterval> | null = null;
  let lastRefreshDisplay = '—';
  let lastRefreshHandle: ReturnType<typeof setInterval> | null = null;

  function refreshLabel(ts: number | null): string {
    if (!ts) return '—';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  function pad(n: number, w = 2) {
    return String(n).padStart(w, '0');
  }

  onMount(() => {
    cd = countdownTo(RACE_START);
    cdHandle = setInterval(() => {
      cd = countdownTo(RACE_START);
    }, 1000);
    const updateRefresh = () => {
      lastRefreshDisplay = refreshLabel($lastRefreshAt);
    };
    updateRefresh();
    lastRefreshHandle = setInterval(updateRefresh, 5000);
  });

  // Re-derive on store change too.
  $: lastRefreshDisplay = refreshLabel($lastRefreshAt);

  onDestroy(() => {
    if (cdHandle) clearInterval(cdHandle);
    if (lastRefreshHandle) clearInterval(lastRefreshHandle);
  });

  const DEMO_STAGES: { key: DemoStage | null; label: string; tip: string }[] = [
    { key: null,     label: 'Live',  tip: 'Real RTRT data' },
    { key: 'pre',    label: 'Pre',   tip: 'Pre-race' },
    { key: 'early',  label: '3 mi',  tip: 'Early race' },
    { key: 'park',   label: '6 mi',  tip: 'In Prospect Park' },
    { key: 'ocean',  label: '9 mi',  tip: 'On Ocean Pkwy' },
    { key: 'late',   label: '11 mi', tip: 'Late race' },
    { key: 'finish', label: 'Fin',   tip: 'Finished' },
  ];

  let demoOpen = false;
</script>

<header class="hdr">
  <div class="container hdr-inner">
    <div class="brand">
      <svg width="28" height="32" viewBox="0 0 28 32" aria-hidden="true">
        <ellipse cx="18" cy="4" rx="4" ry="4" fill="currentColor" />
        <path d="M18 8 L13 20 L5 30 M18 8 L23 20 L26 29 M13 20 L11 29 M23 20 L21 29"
              stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <path d="M11 14 L23 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <div class="brand-text">
        <div class="brand-title">Blizzard Tracker</div>
        <div class="brand-sub">RBC Brooklyn Half · May 16 · 7:00 AM ET</div>
      </div>
    </div>

    <div class="cd" class:cd-go={cd.started} data-tour="countdown">
      {#if cd.started}
        <div class="cd-go-label">🏁 Race underway</div>
      {:else}
        <div class="cd-unit"><span class="cd-num">{pad(cd.days)}</span><span class="cd-lbl">days</span></div>
        <span class="cd-sep">:</span>
        <div class="cd-unit"><span class="cd-num">{pad(cd.hours)}</span><span class="cd-lbl">hrs</span></div>
        <span class="cd-sep">:</span>
        <div class="cd-unit"><span class="cd-num">{pad(cd.minutes)}</span><span class="cd-lbl">min</span></div>
        <span class="cd-sep">:</span>
        <div class="cd-unit"><span class="cd-num">{pad(cd.seconds)}</span><span class="cd-lbl">sec</span></div>
      {/if}
    </div>

    <div class="pills">
      {#each $profiles as p (p.id)}
        <RunnerPill profile={p} on:click={() => activeTab.set(p.id)} />
      {/each}
    </div>

    <div class="controls">
      {#if $demoMode}
        <span class="demo-flag" title="Showing simulated race data">DEMO · {$demoMode}</span>
      {/if}
      <span class="refresh-info" title="Last refresh">
        <span class="spin" class:on={$refreshing}></span>
        <span class="mono refresh-label">{lastRefreshDisplay}</span>
      </span>
      <button class="hdr-btn" on:click={() => refreshAll()} aria-label="Refresh" title="Refresh now">↻</button>
      <button class="hdr-btn" on:click={openTour} title="Replay tour" aria-label="Tour" data-tour="help">?</button>
      <button class="hdr-btn" on:click={() => (appearanceOpen = true)} title="Appearance settings" aria-label="Appearance" data-tour="appearance">⚙</button>

      {#if $devUnlocked}
        <div class="demo-menu">
          <button class="hdr-btn dev-btn" on:click={() => (demoOpen = !demoOpen)} title="Demo race position" aria-haspopup="menu">🛠</button>
          {#if demoOpen}
            <div class="demo-pop" role="menu" tabindex="-1" on:mouseleave={() => (demoOpen = false)}>
              <div class="demo-pop-title">Preview race position</div>
              {#each DEMO_STAGES as st}
                <button
                  class="demo-row"
                  class:active={$demoMode === st.key}
                  on:click={() => { demoMode.set(st.key); demoOpen = false; }}
                >
                  <span>{st.label}</span>
                  <span class="demo-row-tip">{st.tip}</span>
                </button>
              {/each}
              <div class="demo-divider"></div>
              <button class="demo-row demo-row-logout" on:click={() => { lockDevMode(); demoMode.set(null); demoOpen = false; }}>
                <span>Lock dev mode</span>
                <span class="demo-row-tip">Hide tools</span>
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</header>

<AppearanceModal bind:open={appearanceOpen} />

<style>
  .hdr {
    position: sticky;
    top: 0;
    /* Leaflet's panes use z-index 200–800, so the header must sit above them
       (otherwise the map tiles slide over the header on scroll). 1100 leaves
       headroom under the modals (2000). */
    z-index: 1100;
    background: var(--surface-glass);
    backdrop-filter: saturate(140%) blur(14px);
    -webkit-backdrop-filter: saturate(140%) blur(14px);
    border-bottom: 1px solid var(--separator-soft);
  }
  .hdr-inner {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    padding: 10px var(--gap-md);
    min-height: 60px;
  }
  .brand { display: flex; align-items: center; gap: var(--gap-sm); color: var(--blue); }
  .brand-text { line-height: 1.15; }
  .brand-title { font-weight: 700; font-size: 17px; letter-spacing: -0.4px; color: var(--text-primary); }
  .brand-sub { font-size: 11px; color: var(--text-tertiary); }

  .cd {
    display: flex;
    align-items: baseline;
    gap: 2px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    background: var(--blue-soft);
    color: var(--blue);
  }
  .cd-go {
    background: linear-gradient(135deg, #34C759, #007AFF);
    color: white;
    padding: 8px 14px;
    font-weight: 700;
    letter-spacing: -0.3px;
  }
  .cd-go-label { font-size: 13px; font-weight: 700; }
  .cd-unit { display: flex; flex-direction: column; align-items: center; }
  .cd-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-weight: 700; font-size: 16px; line-height: 1; }
  .cd-lbl { font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; }
  .cd-sep { font-family: var(--font-mono); font-weight: 700; opacity: 0.4; margin: 0 4px; }

  .pills { display: flex; gap: 6px; }

  .controls { margin-left: auto; display: flex; align-items: center; gap: 6px; }
  .demo-flag {
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(255, 149, 0, 0.15);
    color: var(--orange);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
  }
  .refresh-info { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-muted); }
  .spin {
    width: 10px; height: 10px;
    border-radius: 50%;
    border: 1.5px solid var(--blue-soft);
    border-top-color: var(--blue);
    transition: opacity 150ms;
    opacity: 0.4;
  }
  .spin.on { animation: spin 0.7s linear infinite; opacity: 1; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .hdr-btn {
    border: 1px solid var(--separator);
    background: var(--surface);
    border-radius: var(--radius-sm);
    width: 32px; height: 32px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--text-secondary);
    transition: background 100ms ease, color 100ms ease;
  }
  .hdr-btn:hover { background: var(--blue-soft); color: var(--blue); }
  .dev-btn { background: rgba(255, 149, 0, 0.12); color: var(--orange); border-color: rgba(255, 149, 0, 0.3); }
  .dev-btn:hover { background: rgba(255, 149, 0, 0.22); color: var(--orange); }
  .demo-divider { height: 1px; background: var(--separator-soft); margin: 4px 6px; }
  .demo-row-logout { color: var(--red); }

  .demo-menu { position: relative; }
  .demo-pop {
    position: absolute;
    top: calc(100% + 6px); right: 0;
    min-width: 220px;
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--separator-soft);
    padding: 6px;
    z-index: 100;
  }
  .demo-pop-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-tertiary); padding: 6px 10px;
  }
  .demo-row {
    display: flex; width: 100%;
    align-items: center; justify-content: space-between;
    padding: 8px 10px;
    border: none; background: transparent;
    border-radius: var(--radius-sm);
    font-size: 13px; color: var(--text-primary);
    text-align: left;
  }
  .demo-row:hover { background: var(--blue-soft); }
  .demo-row.active { background: var(--blue); color: white; }
  .demo-row.active .demo-row-tip { color: rgba(255,255,255,0.85); }
  .demo-row-tip { font-size: 11px; color: var(--text-tertiary); }

  @media (max-width: 1024px) {
    /* iPad portrait + small laptop */
    .hdr-inner { gap: var(--gap-sm); }
  }
  @media (max-width: 980px) {
    .pills { display: none; }
    .cd-lbl { font-size: 7px; }
  }
  @media (max-width: 700px) {
    .brand-sub { display: none; }
    .cd { padding: 4px 8px; }
    .cd-num { font-size: 13px; }
    .hdr-inner { padding: 8px 12px; min-height: 56px; }
  }
  @media (max-width: 540px) {
    /* iPhone — strip every non-essential pixel */
    .brand-title { font-size: 14px; letter-spacing: -0.2px; }
    .brand svg { width: 22px; height: 26px; }
    .cd { padding: 4px 6px; gap: 1px; }
    .cd-num { font-size: 12px; }
    .cd-lbl { font-size: 6px; }
    .cd-sep { margin: 0 2px; }
    .controls { gap: 4px; }
    .hdr-btn { width: 28px; height: 28px; font-size: 13px; }
    .refresh-info { display: none; }
    .demo-flag { font-size: 9px; padding: 2px 6px; }
  }
  @media (max-width: 380px) {
    /* iPhone SE / mini */
    .brand-text { display: none; }
    .hdr-inner { padding: 6px 10px; }
  }
</style>
