<script lang="ts">
  import { theme, accent, ACCENT_PRESETS } from '../lib/appearance';

  export let open = false;

  function close() { open = false; }

  const themeOptions: { key: 'light' | 'dark' | 'system'; label: string; emoji: string }[] = [
    { key: 'light',  label: 'Light',  emoji: '☀️' },
    { key: 'dark',   label: 'Dark',   emoji: '🌙' },
    { key: 'system', label: 'Auto',   emoji: '🌓' },
  ];
</script>

{#if open}
  <div class="overlay" on:click={(e) => e.target === e.currentTarget && close()} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="app-title">
      <button class="x" on:click={close} aria-label="Close">✕</button>
      <div id="app-title" class="title">🎨 Appearance</div>
      <p class="lede">Personal to your device. Won't change what others see.</p>

      <div class="section">
        <div class="sec-title">Theme</div>
        <div class="theme-row">
          {#each themeOptions as t}
            <button
              class="theme-card"
              class:active={$theme === t.key}
              on:click={() => theme.set(t.key)}
            >
              <span class="theme-emoji">{t.emoji}</span>
              <span class="theme-label">{t.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="section">
        <div class="sec-title">Accent color</div>
        <div class="accent-row">
          {#each ACCENT_PRESETS as a}
            <button
              class="swatch"
              class:active={$accent === a.key}
              style="--swatch: {a.hue}"
              on:click={() => accent.set(a.key)}
              title={a.label}
              aria-label={`Set accent to ${a.label}`}
            >
              <span class="swatch-dot"></span>
              <span class="swatch-label">{a.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="hint">Per-runner colors stay personal — Catherine is always blue, Helaine indigo. Accent only changes app chrome.</div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .sheet {
    position: relative;
    width: 440px;
    max-width: 100%;
    max-height: 88vh;
    overflow-y: auto;
    background: var(--surface);
    color: var(--text-primary);
    border-radius: var(--radius-lg);
    padding: 22px;
    box-shadow: var(--shadow-lg);
  }
  .x {
    position: absolute;
    top: 12px; right: 12px;
    width: 28px; height: 28px;
    border-radius: 50%;
    border: none;
    background: var(--surface-2);
    color: var(--text-tertiary);
    font-size: 13px;
    cursor: pointer;
  }
  .x:hover { background: var(--separator); color: var(--text-primary); }
  .title { font-size: 18px; font-weight: 700; letter-spacing: -0.4px; }
  .lede { font-size: 12px; color: var(--text-tertiary); margin: 4px 0 14px; }

  .section { margin-bottom: 18px; }
  .sec-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-tertiary);
    margin-bottom: 8px;
  }

  .theme-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .theme-card {
    background: var(--surface-2);
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    padding: 14px 8px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--text-primary);
    transition: border-color 100ms ease, transform 80ms ease;
  }
  .theme-card:hover { transform: translateY(-1px); }
  .theme-card.active { border-color: var(--blue); }
  .theme-emoji { font-size: 22px; line-height: 1; }
  .theme-label { font-size: 12px; font-weight: 600; }

  .accent-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .swatch {
    --swatch: var(--blue);
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--surface-2);
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    padding: 9px 12px;
    cursor: pointer;
    color: var(--text-primary);
    transition: border-color 100ms ease, transform 80ms ease;
  }
  .swatch:hover { transform: translateY(-1px); }
  .swatch.active { border-color: var(--swatch); background: color-mix(in srgb, var(--swatch) 8%, var(--surface-2)); }
  .swatch-dot {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .swatch-label { font-size: 13px; font-weight: 600; }

  .hint {
    font-size: 11px;
    color: var(--text-tertiary);
    line-height: 1.4;
    margin-top: 8px;
  }
</style>
