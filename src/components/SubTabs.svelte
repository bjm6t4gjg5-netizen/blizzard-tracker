<script lang="ts">
  export let value: string;
  export let tabs: { key: string; label: string; emoji?: string }[];
</script>

<div class="subtabs" role="tablist">
  {#each tabs as t (t.key)}
    <button
      class="subtab"
      class:active={value === t.key}
      role="tab"
      aria-selected={value === t.key}
      on:click={() => (value = t.key)}
    >
      {#if t.emoji}<span class="emoji">{t.emoji}</span>{/if}
      <span>{t.label}</span>
    </button>
  {/each}
</div>

<style>
  .subtabs {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--surface-2);
    border-radius: 999px;
    margin-bottom: var(--gap-md);
  }
  .subtab {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border-radius: 999px;
    border: none;
    background: transparent;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    cursor: pointer;
    transition: background 100ms ease, color 100ms ease;
  }
  .subtab:hover { color: var(--text-primary); }
  .subtab.active {
    background: var(--surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }
  .emoji { font-size: 13px; }
</style>
