<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = '🏃';
  export let open = false;

  const dispatch = createEventDispatcher();

  /** Running-themed presets. */
  const PRESETS: ReadonlyArray<{ label: string; items: string[] }> = [
    { label: 'Runners',  items: ['🏃', '🏃‍♀️', '🏃‍♂️', '🚶', '🚶‍♀️', '🚶‍♂️', '🦵', '👟'] },
    { label: 'Energy',   items: ['⚡', '💨', '🔥', '💪', '✨', '🌟', '💫', '🎯', '🚀'] },
    { label: 'Hearts',   items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🤍', '🖤'] },
    { label: 'Animals',  items: ['🦄', '🦁', '🐆', '🦅', '🐎', '🐅', '🦊', '🐰'] },
    { label: 'Awards',   items: ['🏆', '🥇', '🥈', '🥉', '🎖', '🏅', '🎗', '👑'] },
    { label: 'Nature',   items: ['🌈', '🌅', '☀️', '🌙', '⭐', '🌸', '🌻', '🍀'] },
  ];

  function pick(e: string) {
    value = e;
    dispatch('change', e);
    open = false;
  }
</script>

<div class="emoji-host">
  <button
    type="button"
    class="emoji-trigger form-input"
    on:click={() => (open = !open)}
    aria-haspopup="dialog"
  >
    <span class="big">{value || '🏃'}</span>
    <span class="caret">▾</span>
  </button>

  {#if open}
    <div class="popover" role="dialog" aria-label="Pick an emoji">
      {#each PRESETS as group}
        <div class="group">
          <div class="group-label">{group.label}</div>
          <div class="grid">
            {#each group.items as e}
              <button
                type="button"
                class="cell"
                class:active={value === e}
                on:click={() => pick(e)}
                aria-label={e}
              >
                {e}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .emoji-host { position: relative; }
  .emoji-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    cursor: pointer;
    padding: 4px 8px;
  }
  .big { font-size: 22px; line-height: 1; }
  .caret { font-size: 10px; color: var(--text-tertiary); }

  .popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 50;
    background: var(--surface);
    border: 1px solid var(--separator-soft);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    padding: 10px;
    width: 280px;
    max-height: 320px;
    overflow-y: auto;
  }
  .group + .group { margin-top: 10px; }
  .group-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-tertiary);
    margin-bottom: 4px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
  }
  .cell {
    background: transparent;
    border: none;
    border-radius: 6px;
    padding: 4px;
    cursor: pointer;
    font-size: 18px;
    transition: background 80ms ease, transform 80ms ease;
  }
  .cell:hover { background: var(--surface-2); transform: scale(1.15); }
  .cell.active { background: var(--blue-soft); }
</style>
