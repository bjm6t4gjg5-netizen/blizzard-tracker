<script lang="ts">
  import PostRaceScreen from '../components/PostRaceScreen.svelte';

  /** Archive of past races (Brooklyn Half 2026 will be the first entry once
   *  it concludes). Until the dev moves entries here, this is mostly empty.
   *  Dev-mode-only tab. */
  interface ArchivedRace {
    id: string;
    name: string;
    date: string;
    summary: string;
  }

  const ARCHIVED: ArchivedRace[] = [
    {
      id: 'bkh2026',
      name: 'RBC Brooklyn Half 2026',
      date: '2026-05-16',
      summary: '13.1 mi · Brooklyn Museum → Coney Island. Catherine sub-1:32 attempt · Helaine sub-1:50 target.',
    },
  ];

  let selectedId: string | null = ARCHIVED[0]?.id ?? null;
  $: selected = ARCHIVED.find(r => r.id === selectedId) ?? null;
</script>

<h2 class="title">Old races · archive</h2>
<p class="sub">
  Dev-only for now. After each race finishes we'll fold its frozen state into
  this tab so the live dashboard can move on to the next one.
</p>

<div class="picker gap-md">
  {#each ARCHIVED as r}
    <button
      class="pick"
      class:active={selectedId === r.id}
      on:click={() => (selectedId = r.id)}
    >
      <div class="pick-name">{r.name}</div>
      <div class="pick-meta">
        <span class="mono">{r.date}</span>
        <span class="dot">·</span>
        <span class="summary">{r.summary}</span>
      </div>
    </button>
  {/each}
</div>

{#if selected}
  <div class="frozen">
    <div class="frozen-banner">
      📁 Showing archived state of <strong>{selected.name}</strong> ·
      <span class="mono">{selected.date}</span>
    </div>
    <PostRaceScreen />
  </div>
{:else}
  <div class="empty card card-pad">No archived races yet.</div>
{/if}

<style>
  .title { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; margin: 4px 0 2px; }
  .sub { color: var(--text-tertiary); font-size: 13px; margin: 0 0 var(--gap-md); }

  .picker { display: flex; flex-direction: column; gap: 6px; }
  .pick {
    text-align: left;
    border: 1px solid var(--separator-soft);
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    cursor: pointer;
    transition: all 100ms ease;
  }
  .pick:hover  { border-color: var(--blue); background: var(--blue-soft); }
  .pick.active { border-color: var(--blue); background: var(--blue-soft); }
  .pick-name { font-weight: 600; font-size: 14px; color: var(--text-primary); }
  .pick-meta { font-size: 11.5px; color: var(--text-tertiary); margin-top: 4px; }
  .dot { margin: 0 4px; opacity: 0.6; }

  .frozen-banner {
    background: rgba(255, 149, 0, 0.10);
    color: var(--orange);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    margin-bottom: var(--gap-md);
    text-align: center;
  }
  .frozen-banner strong { color: var(--text-primary); }
</style>
