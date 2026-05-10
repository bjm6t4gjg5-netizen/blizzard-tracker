<script lang="ts">
  import { TOTAL_GAIN_FT, COURSE } from '../lib/course';
  import { devUnlocked, lockDevMode } from '../lib/devMode';
  import { notify, demoTimeMin } from '../lib/stores';
  import DevLoginModal from './DevLoginModal.svelte';
  import VenmoButton from './VenmoButton.svelte';

  let showDevModal = false;

  function handleDevClick() {
    if ($devUnlocked) {
      // One-click lock when already active. Avoids the modal popping up
      // again over the map and gives a clear way to log out.
      lockDevMode();
      demoTimeMin.set(null);
      notify('🔒 Developer mode locked');
    } else {
      showDevModal = true;
    }
  }
</script>

<footer class="ftr">
  <div class="container ftr-inner">
    <div>
      Made with ❤️ by <strong>Leon Schulte</strong> · May 2026
    </div>
    <div class="meta">
      <span class="pill">📐 {COURSE.length} GPS points</span>
      <span class="pill">⛰ {TOTAL_GAIN_FT}ft elev gain</span>
      <span class="pill">📡 RTRT.me live data</span>
      <VenmoButton variant="pill" label="🍺 Buy them a beer" />
      <VenmoButton variant="pill" label="🛠 Tip the dev" user="leonschulte" note="Tip for Leon's Blizzard Tracker work 🛠" />
      <button
        class="dev-link"
        class:active={$devUnlocked}
        data-tour="dev"
        on:click={handleDevClick}
        title={$devUnlocked ? 'Click to lock developer mode' : 'Open developer mode'}
      >
        {#if $devUnlocked}
          🔓 Developer · click to lock
        {:else}
          🛠 Developer
        {/if}
      </button>
    </div>
  </div>
</footer>

<DevLoginModal bind:open={showDevModal} />

<style>
  .ftr {
    flex-shrink: 0;
    border-top: 1px solid var(--separator-soft);
    background: var(--surface-glass);
    backdrop-filter: blur(8px);
    margin-top: var(--gap-xl);
  }
  .ftr-inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-sm);
    padding: var(--gap-md);
    font-size: 12px;
    color: var(--text-tertiary);
  }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .pill {
    padding: 3px 9px;
    background: var(--surface);
    border: 1px solid var(--separator-soft);
    border-radius: 999px;
    font-size: 11px;
  }
  .dev-link {
    background: transparent;
    border: 1px solid var(--separator-soft);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 11px;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all 100ms ease;
  }
  .dev-link:hover { border-color: var(--orange); color: var(--orange); background: rgba(255, 149, 0, 0.06); }
  .dev-link.active { border-color: var(--orange); color: var(--orange); background: rgba(255, 149, 0, 0.10); font-weight: 600; }

  @media (max-width: 540px) {
    .ftr-inner { flex-direction: column; align-items: flex-start; gap: 8px; }
    .meta { gap: 4px; }
    .pill { font-size: 10px; padding: 2px 7px; }
  }
</style>
