<script lang="ts">
  import { SPECTATOR_SPOTS } from '../lib/course';
  import { profiles } from '../lib/stores';
  import SpectatorEta from './SpectatorEta.svelte';

  export let runnerId: string | null = null;
  export let title = 'Best spectator spots';

  $: visibleProfiles = runnerId
    ? $profiles.filter(p => p.id === runnerId)
    : $profiles;
</script>

<div class="card spec-card">
  <div class="card-header"><div class="card-title">{title}</div></div>
  <div class="rows">
    {#each SPECTATOR_SPOTS as s}
      <div class="row">
        <div class="badge {s.official ? 'badge-official' : 'badge-default'}">
          {s.mi.toFixed(1)}mi
        </div>
        <div class="info">
          <div class="name">
            {s.name}
            {#if s.official}<span class="tag">{s.official} cheer zone</span>{/if}
          </div>
          <div class="note">{s.note}</div>
          <div class="transit">🚇 {s.transit}</div>
        </div>
        <div class="etas">
          {#each visibleProfiles as p (p.id)}
            <SpectatorEta profile={p} mi={s.mi} />
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .spec-card { overflow: hidden; }
  .rows { display: flex; flex-direction: column; }
  .row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-top: 1px solid var(--separator-soft);
  }
  .row:first-child { border-top: none; }

  .badge {
    width: 56px;
    text-align: center;
    padding: 6px 0;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 12px;
  }
  .badge-default { background: var(--blue-soft); color: var(--blue); }
  .badge-official { background: linear-gradient(135deg, #FF9500, #FF3B30); color: white; }

  .name { font-weight: 600; font-size: 14px; }
  .tag {
    margin-left: 6px;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(255, 149, 0, 0.15);
    color: var(--orange);
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .note { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
  .transit { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }

  .etas { display: flex; gap: 8px; flex-direction: column; }

  @media (max-width: 600px) {
    .row { grid-template-columns: auto 1fr; }
    .etas { grid-column: 1 / -1; flex-direction: row; }
  }
</style>
