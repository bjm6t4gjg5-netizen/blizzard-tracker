<script lang="ts">
  /**
   * Old Races — frozen archive of past Team Blizzard race days.
   *
   * Each entry is a static snapshot taken after the race concluded, so this
   * tab stays correct no matter which race the live dashboard currently
   * points at. The live dashboard (Family HQ, runner tabs, map) is always
   * about the CURRENT race — history lives here.
   *
   * TODO(Leon): fill in the official Brooklyn 2026 chip times below.
   */
  interface ArchivedResult {
    emoji: string;
    name: string;
    color: string;
    goal: string;
    /** Official chip time, or null if not recorded yet. */
    time: string | null;
    note?: string;
  }

  interface ArchivedRace {
    id: string;
    name: string;
    date: string;
    dateLabel: string;
    distance: string;
    course: string;
    summary: string;
    results: ArchivedResult[];
    resultsHref?: string;
  }

  const ARCHIVED: ArchivedRace[] = [
    {
      id: 'bkh2026',
      name: 'RBC Brooklyn Half 2026',
      date: '2026-05-16',
      dateLabel: 'Saturday, May 16, 2026 · 7:00 AM ET',
      distance: '13.1 mi',
      course: 'Brooklyn Museum → Grand Army Plaza → Prospect Park → Ocean Pkwy → Coney Island Boardwalk',
      summary: 'The race this tracker was originally built for — mother and daughter on the same start line, 246ft of bumps, finish by the Atlantic.',
      results: [
        { emoji: '💙', name: 'Catherine Blizzard', color: '#007AFF', goal: 'Sub-1:32 (PR attempt)', time: null },
        { emoji: '⚡', name: 'Helaine Blizzard',   color: '#FF2D55', goal: 'Sub-1:50',             time: null },
      ],
      resultsHref: 'https://results.nyrr.org/',
    },
  ];

  let selectedId: string | null = ARCHIVED[0]?.id ?? null;
  $: selected = ARCHIVED.find(r => r.id === selectedId) ?? null;
</script>

<h2 class="title">Old races · archive</h2>
<p class="sub">
  Frozen snapshots of past race days. The live dashboard has moved on to
  Chicago — the history lives here.
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
        <span class="summary">{r.distance} · {r.summary}</span>
      </div>
    </button>
  {/each}
</div>

{#if selected}
  <div class="frozen">
    <div class="frozen-banner">
      📁 Archived race · <strong>{selected.name}</strong> ·
      <span class="mono">{selected.date}</span>
    </div>

    <div class="card card-pad arch">
      <div class="arch-head">
        <div class="arch-eyebrow">💙 Team Blizzard ⚡</div>
        <h3 class="arch-title">{selected.name}</h3>
        <p class="arch-sub">{selected.dateLabel}</p>
        <p class="arch-course">{selected.course}</p>
      </div>

      <div class="results">
        {#each selected.results as res}
          <div class="result-card" style="--pc: {res.color}">
            <div class="result-name">{res.emoji} {res.name}</div>
            <div class="result-time mono">{res.time ?? 'TBD'}</div>
            <div class="result-label">{res.time ? 'official chip time' : 'chip time — to be added'}</div>
            <div class="result-goal">Goal: {res.goal}</div>
            {#if res.note}<div class="result-note">{res.note}</div>{/if}
          </div>
        {/each}
      </div>

      {#if selected.resultsHref}
        <a class="results-link" href={selected.resultsHref} target="_blank" rel="noopener">
          Official results ↗
        </a>
      {/if}
    </div>
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

  .arch-head { text-align: center; margin-bottom: var(--gap-md); }
  .arch-eyebrow {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.6px; color: var(--text-tertiary);
  }
  .arch-title { font-size: 24px; font-weight: 800; letter-spacing: -0.6px; margin: 6px 0 2px; }
  .arch-sub { font-size: 13px; color: var(--text-secondary); margin: 0; }
  .arch-course { font-size: 12px; color: var(--text-tertiary); margin: 6px 0 0; }

  .results {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: var(--gap-md);
  }
  .result-card {
    --pc: var(--blue);
    border: 1px solid var(--separator-soft);
    border-top: 3px solid var(--pc);
    border-radius: var(--radius);
    padding: 16px 12px;
    text-align: center;
    background: var(--surface);
  }
  .result-name { font-weight: 700; font-size: 15px; }
  .result-time { font-weight: 800; font-size: 30px; letter-spacing: -0.6px; margin: 6px 0 2px; color: var(--pc); }
  .result-label { font-size: 11px; color: var(--text-tertiary); }
  .result-goal { font-size: 12px; color: var(--text-secondary); margin-top: 8px; }
  .result-note { font-size: 11.5px; color: var(--text-tertiary); margin-top: 4px; }

  .results-link {
    display: inline-block;
    font-size: 12.5px;
    color: var(--blue);
    text-decoration: none;
  }
  .results-link:hover { text-decoration: underline; }
</style>
