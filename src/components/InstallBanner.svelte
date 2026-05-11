<script lang="ts">
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { shouldShowInstallPrompt, installBannerDismissed } from '../lib/installPrompt';

  let visible = false;

  onMount(() => {
    if (!$installBannerDismissed && shouldShowInstallPrompt()) {
      // Small delay so it doesn't fight with the tour wizard for attention.
      setTimeout(() => { visible = true; }, 1500);
    }
  });

  function dismiss() {
    visible = false;
    installBannerDismissed.set(true);
  }
</script>

{#if visible}
  <div class="banner" transition:fly={{ y: 80, duration: 280 }} role="dialog" aria-label="Install instructions">
    <button class="x" on:click={dismiss} aria-label="Dismiss">✕</button>
    <div class="emoji" aria-hidden="true">📲</div>
    <div class="content">
      <div class="title">Add to your iPhone Home Screen</div>
      <ol class="steps">
        <li>
          Tap the <span class="kbd"><svg width="11" height="14" viewBox="0 0 11 14" aria-hidden="true"><path d="M5.5 0L8 2.5L7.3 3.2L6 1.9V8.5H5V1.9L3.7 3.2L3 2.5L5.5 0ZM10 5V12C10 13.1 9.1 14 8 14H3C1.9 14 1 13.1 1 12V5C1 3.9 1.9 3 3 3H4V4H3C2.4 4 2 4.4 2 5V12C2 12.6 2.4 13 3 13H8C8.6 13 9 12.6 9 12V5C9 4.4 8.6 4 8 4H7V3H8C9.1 3 10 3.9 10 5Z" fill="currentColor"/></svg> Share</span>
          button in Safari's toolbar
        </li>
        <li>Scroll down · tap <span class="kbd">＋ Add to Home Screen</span></li>
        <li>Tap <span class="kbd">Add</span> in the top-right corner</li>
      </ol>
      <div class="note">Launches full-screen as <strong>Blizzard Racing</strong> · works like a native app on iOS 17 + 18.</div>
    </div>
  </div>
{/if}

<style>
  .banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1400;
    margin: 0 auto;
    max-width: 480px;
    background: var(--surface);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.25);
    border: 1px solid var(--separator-soft);
    border-bottom: none;
    padding: 18px 20px 22px;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 14px;
    align-items: start;
    color: var(--text-primary);
  }
  .emoji {
    font-size: 32px;
    line-height: 1;
    margin-top: 2px;
  }
  .content { min-width: 0; }
  .title {
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.2px;
    margin-bottom: 8px;
  }
  .steps {
    margin: 0;
    padding-left: 18px;
    font-size: 12.5px;
    line-height: 1.65;
    color: var(--text-secondary);
  }
  .steps li { padding-left: 2px; }
  .steps li + li { margin-top: 2px; }
  .kbd {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 7px;
    background: var(--surface-2);
    border: 1px solid var(--separator);
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
  }
  .note {
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-tertiary);
    line-height: 1.4;
  }
  .note strong { color: var(--text-primary); }
  .x {
    position: absolute;
    top: 10px;
    right: 12px;
    width: 26px; height: 26px;
    border-radius: 50%;
    border: none;
    background: var(--surface-2);
    color: var(--text-tertiary);
    font-size: 12px;
    cursor: pointer;
  }
  .x:hover { background: var(--separator); color: var(--text-primary); }

  @media (max-width: 540px) {
    .banner { padding: 16px 16px 18px; }
    .emoji { font-size: 28px; }
  }
</style>
