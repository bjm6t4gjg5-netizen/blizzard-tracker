<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { derived } from 'svelte/store';
  import type { Readable } from 'svelte/store';
  import { RACE_START, CHICAGO_MARATHON_2026, countdownTo } from '../lib/time';
  import {
    profiles, runnerState, activeTab,
    refreshAll, lastRefreshAt, refreshing, demoTimeMin,
  } from '../lib/stores';
  import type { RunnerState } from '../lib/runners';
  import RunnerPill from './RunnerPill.svelte';
  import { devUnlocked, lockDevMode } from '../lib/devMode';
  import AppearanceModal from './AppearanceModal.svelte';
  import { openTour } from '../lib/tour';

  let appearanceOpen = false;

  /** Format a "minutes-past-7am" value as "h:MM AM/PM" for display. */
  function fmtTimeOfDay(min: number | null): string {
    if (min === null) return 'Live';
    const totalMinFrom7 = min; // 0 = 7:00 AM
    const totalAbsMin = 7 * 60 + totalMinFrom7;
    let h = Math.floor(totalAbsMin / 60);
    const m = ((totalAbsMin % 60) + 60) % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  }

  // Sim slider value when active. Defaults to 0 (7:00 AM) on first reveal.
  let simSliderMin = 0;
  $: if ($demoTimeMin !== null) simSliderMin = $demoTimeMin;

  /** Preset jump-points, picked to demonstrate the staggered wave races. */
  const SIM_PRESETS: { label: string; min: number; note: string }[] = [
    { label: 'Pre-race',         min: -10, note: '6:50 AM' },
    { label: 'Wave 1 gun',       min:   0, note: 'Catherine starts' },
    { label: 'Cat ~30 min in',   min:  32, note: '7:32 — Cat ~4mi · Helaine pre' },
    { label: 'Wave 3 gun',       min:  50, note: 'Helaine starts' },
    { label: 'Cat finishing',    min:  92, note: '8:32 — Cat at finish · Helaine ~5mi' },
    { label: 'Helaine ~7mi',     min: 130, note: '9:10 — Cat done · Helaine on Ocean Pkwy' },
    { label: 'Helaine finishing',min: 164, note: '9:44 — both done soon' },
    { label: 'All done',         min: 180, note: '10:00 AM' },
  ];

  // ────────────────────────────────────────────────────────────
  // Race-phase logic for the header clock
  //
  // pre-bkh   → counting down to Wave 1 gun (May 16, 7:00 AM ET)
  // live      → at least one runner is actively running
  // chicago   → both runners finished; flip to "Road to Chicago" countdown
  //
  // The phase is derived from runner-state stores (which also reflect the
  // dev simulator), so dragging the time slider in dev mode flips the
  // header in real time.
  // ────────────────────────────────────────────────────────────

  type Phase = 'pre-bkh' | 'live' | 'chicago';

  function buildPhaseStore(p: typeof $profiles): Readable<Phase> {
    if (p.length === 0) return derived(profiles, () => 'pre-bkh' as Phase);
    const stores = p.map(pp => runnerState(pp.id));
    return derived(stores as unknown as Readable<RunnerState>[], (states) => {
      const ss = states as RunnerState[];
      if (ss.length === 0) return 'pre-bkh';
      const allFinished = ss.every(s => s.status === 'finished' && s.elapsedSec > 60);
      if (allFinished) return 'chicago';
      const anyRunning = ss.some(
        s => (s.status === 'running' && (s.distMi > 0.05 || s.elapsedSec > 5)) ||
             (s.status === 'finished' && s.elapsedSec > 60),   // partial-finish in middle of group
      );
      if (anyRunning) return 'live';
      return 'pre-bkh';
    });
  }
  let phaseStore: Readable<Phase> = buildPhaseStore($profiles);
  $: phaseStore = buildPhaseStore($profiles);

  // Two separate countdowns — the active one is picked by the phase.
  let cd = countdownTo(RACE_START);
  let cdChicago = countdownTo(CHICAGO_MARATHON_2026);
  let cdHandle: ReturnType<typeof setInterval> | null = null;
  let lastRefreshDisplay = '—';
  let lastRefreshHandle: ReturnType<typeof setInterval> | null = null;

  /** A pulse counter for the "Race is live" indicator — ticks every second. */
  let livePulse = 0;

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
    cdChicago = countdownTo(CHICAGO_MARATHON_2026);
    cdHandle = setInterval(() => {
      cd = countdownTo(RACE_START);
      cdChicago = countdownTo(CHICAGO_MARATHON_2026);
      livePulse += 1;
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

    <div
      class="cd"
      class:cd-live={$phaseStore === 'live'}
      class:cd-chicago={$phaseStore === 'chicago'}
      data-tour="countdown"
    >
      {#if $phaseStore === 'live'}
        <!-- ─── Race is happening right now ─── -->
        <span class="live-dot" aria-hidden="true"></span>
        <div class="cd-live-label">
          <span class="lbl-top">🏁 Race is live</span>
          <span class="lbl-sub">RBC Brooklyn Half · {pad(cd.hours === 0 ? 0 : 0)}—follow the runner pills →</span>
        </div>
      {:else if $phaseStore === 'chicago'}
        <!-- ─── Both done — road to Chicago Marathon ─── -->
        <div class="cd-chicago-label">
          <span class="chi-eyebrow">🏆 Road to Chicago</span>
          <span class="chi-time mono">
            {pad(cdChicago.days)}d {pad(cdChicago.hours)}h {pad(cdChicago.minutes)}m {pad(cdChicago.seconds)}s
          </span>
        </div>
      {:else}
        <!-- ─── Pre-race countdown to Wave 1 gun ─── -->
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
      {#if $demoTimeMin !== null}
        <span class="demo-flag" title="Showing simulated race data">SIM · {fmtTimeOfDay($demoTimeMin)}</span>
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
          <button class="hdr-btn dev-btn" on:click={() => (demoOpen = !demoOpen)} title="Race-day time simulator" aria-haspopup="menu">🛠</button>
          {#if demoOpen}
            <div class="demo-pop demo-pop-wide" role="menu" tabindex="-1">
              <div class="demo-pop-head">
                <div>
                  <div class="demo-pop-title">Race-day time simulator</div>
                  <div class="demo-pop-sub">
                    {#if $demoTimeMin === null}
                      <span class="live-dot"></span> Currently <strong>Live</strong> (real RTRT data)
                    {:else}
                      Simulating <strong>{fmtTimeOfDay($demoTimeMin)}</strong> · runners projected from their own wave start
                    {/if}
                  </div>
                </div>
                <button class="x-btn" on:click={() => (demoOpen = false)} aria-label="Close">✕</button>
              </div>

              <div class="slider-wrap">
                <input
                  type="range"
                  min="-30"
                  max="210"
                  step="1"
                  bind:value={simSliderMin}
                  on:input={() => demoTimeMin.set(simSliderMin)}
                />
                <div class="slider-ticks">
                  <span>6:30</span>
                  <span>7:00</span>
                  <span>7:30</span>
                  <span>8:00</span>
                  <span>8:30</span>
                  <span>9:00</span>
                  <span>9:30</span>
                  <span>10:00</span>
                  <span>10:30</span>
                </div>
              </div>

              <div class="presets-title">Quick jump</div>
              <div class="presets">
                {#each SIM_PRESETS as p}
                  <button
                    class="preset"
                    class:active={$demoTimeMin === p.min}
                    on:click={() => demoTimeMin.set(p.min)}
                    title={p.note}
                  >
                    <span class="preset-label">{p.label}</span>
                    <span class="preset-note">{p.note}</span>
                  </button>
                {/each}
              </div>

              <div class="demo-divider"></div>
              <button
                class="demo-row"
                class:active={$demoTimeMin === null}
                on:click={() => { demoTimeMin.set(null); demoOpen = false; }}
              >
                <span>📡 Lock to Live data</span>
                <span class="demo-row-tip">Real RTRT</span>
              </button>
              <button class="demo-row demo-row-logout" on:click={() => { lockDevMode(); demoTimeMin.set(null); demoOpen = false; }}>
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
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    background: var(--blue-soft);
    color: var(--blue);
    transition: background 200ms ease, color 200ms ease;
  }
  /* "Race is live" — pulsing green gradient. */
  .cd-live {
    background: linear-gradient(135deg, #34C759, #1F9D4F);
    color: white;
    padding: 8px 14px;
    box-shadow: 0 0 0 0 rgba(52, 199, 89, 0);
    animation: live-glow 2s ease-in-out infinite;
  }
  @keyframes live-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.0); }
    50%      { box-shadow: 0 0 0 6px rgba(52, 199, 89, 0.25); }
  }
  .live-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.85);
    animation: live-pulse 1s ease-in-out infinite;
  }
  @keyframes live-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.85); }
    50%      { box-shadow: 0 0 0 5px rgba(255, 255, 255, 0); }
  }
  .cd-live-label {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .lbl-top { font-size: 13px; font-weight: 700; letter-spacing: -0.2px; }
  .lbl-sub { font-size: 9px; opacity: 0.85; margin-top: 1px; }

  /* "Road to Chicago" — warm gradient, mono countdown. */
  .cd-chicago {
    background: linear-gradient(135deg, #FF9500, #FF3B30);
    color: white;
    padding: 8px 14px;
  }
  .cd-chicago-label {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }
  .chi-eyebrow {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    opacity: 0.9;
  }
  .chi-time {
    font-weight: 700;
    font-size: 14px;
    letter-spacing: -0.2px;
    margin-top: 2px;
  }

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
  .demo-pop-wide { width: 340px; padding: 12px; }
  .demo-pop-title {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-tertiary); padding: 6px 10px;
  }
  .demo-pop-wide .demo-pop-title { padding: 0; }
  .demo-pop-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: 8px; margin-bottom: 10px;
  }
  .demo-pop-sub {
    font-size: 12px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;
  }
  .demo-pop-sub strong { color: var(--text-primary); font-weight: 700; }
  .live-dot {
    display: inline-block; width: 7px; height: 7px;
    border-radius: 50%; background: var(--green);
    margin-right: 4px;
    animation: live-pulse 1.6s ease-in-out infinite;
  }
  @keyframes live-pulse { 50% { opacity: 0.4; } }
  .x-btn {
    width: 24px; height: 24px; border-radius: 50%;
    border: none; background: var(--surface-2); color: var(--text-tertiary);
    cursor: pointer; font-size: 11px;
    flex-shrink: 0;
  }
  .x-btn:hover { background: var(--separator); color: var(--text-primary); }

  .slider-wrap { margin: 10px 0 14px; }
  .slider-wrap input[type="range"] {
    width: 100%;
    accent-color: var(--blue);
    height: 24px;
  }
  .slider-ticks {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: var(--text-tertiary);
    font-family: var(--font-mono);
    margin-top: 2px;
  }

  .presets-title {
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--text-tertiary); margin-bottom: 6px;
  }
  .presets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin-bottom: 10px;
  }
  .preset {
    display: flex; flex-direction: column; align-items: flex-start;
    padding: 6px 9px;
    border: 1px solid var(--separator-soft);
    background: var(--surface);
    border-radius: var(--radius-sm);
    cursor: pointer;
    text-align: left;
    transition: all 100ms ease;
  }
  .preset:hover { background: var(--blue-soft); border-color: var(--blue); }
  .preset.active { background: var(--blue); color: white; border-color: var(--blue); }
  .preset.active .preset-note { color: rgba(255,255,255,0.8); }
  .preset-label { font-size: 11.5px; font-weight: 600; color: var(--text-primary); }
  .preset.active .preset-label { color: white; }
  .preset-note { font-size: 9.5px; color: var(--text-tertiary); margin-top: 1px; }
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
    .cd { padding: 4px 6px; gap: 6px; }
    .cd-num { font-size: 12px; }
    .cd-lbl { font-size: 6px; }
    .cd-sep { margin: 0 2px; }
    .lbl-top { font-size: 11px; }
    .lbl-sub { display: none; }
    .chi-time { font-size: 12px; }
    .chi-eyebrow { font-size: 9px; }
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
