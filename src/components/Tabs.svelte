<script lang="ts">
  import { profiles, activeTab, settingsOpen } from '../lib/stores';

  interface TabSpec { id: string; label: string; emoji: string; }

  $: tabs = [
    { id: 'family', label: 'Family HQ', emoji: '🏠' } as TabSpec,
    ...$profiles.map(p => ({ id: p.id, label: p.name.split(' ')[0], emoji: p.emoji } as TabSpec)),
    { id: 'weather', label: 'Weather', emoji: '🌤' } as TabSpec,
    { id: 'stats', label: 'Stats', emoji: '📊' } as TabSpec,
  ];
</script>

<div class="tabs" role="tablist" data-tour="tabs">
  {#each tabs as t, i (t.id)}
    <button
      class="tab"
      class:active={$activeTab === t.id}
      role="tab"
      aria-selected={$activeTab === t.id}
      on:click={() => activeTab.set(t.id)}
      data-tour={i === 1 ? 'runner-tab' : null}
    >
      <span class="emoji">{t.emoji}</span>
      <span class="label">{t.label}</span>
    </button>
  {/each}
  <button class="tab tab-add" title="Add or remove runners" on:click={() => settingsOpen.set(true)} aria-label="Manage runners">
    <span class="emoji">⊕</span>
  </button>
</div>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    margin: var(--gap-md) 0;
    padding: 4px;
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
    transition: background 100ms ease, color 100ms ease;
    scroll-snap-align: start;
  }
  .tab:hover { color: var(--text-primary); background: var(--surface-2); }
  .tab.active {
    background: var(--blue);
    color: white;
    box-shadow: var(--shadow-sm);
  }
  .emoji { font-size: 14px; }

  .tab-add {
    margin-left: auto;
    border: 1px dashed var(--separator);
    color: var(--text-tertiary);
    padding: 6px 10px;
  }
  .tab-add:hover { color: var(--blue); border-color: var(--blue); background: var(--blue-soft); }
  @media (max-width: 600px) {
    .label { display: none; }
    .tab { padding: 8px 12px; }
    .emoji { font-size: 18px; }
    .tabs { padding: 3px; }
  }
</style>
