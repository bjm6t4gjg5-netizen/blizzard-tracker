<script lang="ts">
  import type { Race } from '../lib/career';

  export let races: ReadonlyArray<Race>;
  export let prTime: string | null = null;

  // Marathons only, newest-first.
  $: marathons = races
    .filter(r => r.distance === 'Marathon')
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  /** Try a curated photo for known races by location/name keywords. Returns
   *  null if no thumbnail is appropriate. */
  function thumbFor(r: Race): string | null {
    const n = r.name.toLowerCase();
    const loc = (r.location ?? '').toLowerCase();
    if (n.includes('boston') && r.date.startsWith('2025')) return './photo-boston-finish-medal.jpeg';
    if (n.includes('big sur'))                              return './photo-big-sur-nature.jpeg';
    if (n.includes('berlin'))                               return './photo-berlin-brandenburg.jpeg';
    if (n.includes('eugene'))                               return './photo-eugene-beer.jpeg';
    if (n.includes('dallas') && r.date.startsWith('2023'))  return './photo-dallas.jpeg';
    if (loc.includes('hopkinton'))                          return './photo-boston-finish-medal.jpeg';
    return null;
  }

  function pretty(d: string): string {
    const t = new Date(d + 'T12:00:00');
    return t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<div class="card">
  <div class="card-header">
    <div class="card-title">Marathon roster · {marathons.length} race{marathons.length === 1 ? '' : 's'}</div>
  </div>
  <div class="rows">
    {#each marathons as r (r.date + r.name)}
      <div class="row" class:hl={!!r.highlight} class:pr={prTime && r.time === prTime}>
        {#if thumbFor(r)}
          <div class="thumb" style="background-image: url('{thumbFor(r)}')" aria-hidden="true"></div>
        {:else}
          <div class="thumb thumb-empty" aria-hidden="true"><span>🏃</span></div>
        {/if}
        <div class="info">
          <div class="r-top">
            <span class="r-name">{r.name}</span>
            {#if r.worldMajor}<span class="wm">⭐ Major</span>{/if}
            {#if prTime && r.time === prTime}<span class="pr-tag">PR</span>{/if}
          </div>
          <div class="r-meta">
            <span class="date">{pretty(r.date)}</span>
            {#if r.location}<span class="loc">· {r.location}</span>{/if}
          </div>
          {#if r.highlight}
            <div class="hl">{r.highlight}</div>
          {/if}
        </div>
        <div class="time mono">{r.time ?? '—'}</div>
        {#if r.href}
          <a class="ext" href={r.href} target="_blank" rel="noopener noreferrer" aria-label="Open official result">↗</a>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .rows { display: flex; flex-direction: column; }
  .row {
    display: grid;
    grid-template-columns: 56px 1fr auto auto;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-top: 1px solid var(--separator-soft);
  }
  .row:first-child { border-top: none; }
  .row.pr { background: color-mix(in srgb, var(--blue) 5%, var(--surface)); }
  .row.hl::before {
    content: '';
    position: absolute;
    /* visually subtle — actual highlight comes from .pr or worldMajor tag */
  }

  .thumb {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background-size: cover;
    background-position: center;
    background-color: var(--surface-2);
    box-shadow: var(--shadow-sm);
    flex-shrink: 0;
  }
  .thumb-empty {
    display: flex; align-items: center; justify-content: center;
    color: var(--text-tertiary);
    font-size: 22px;
  }

  .info { min-width: 0; }
  .r-top {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .r-name { font-weight: 600; font-size: 14px; }
  .wm {
    padding: 1px 6px;
    border-radius: 999px;
    background: linear-gradient(135deg, #FFB800, #FF9500);
    color: white;
    font-size: 9.5px;
    font-weight: 700;
  }
  .pr-tag {
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--blue);
    color: white;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 0.4px;
  }
  .r-meta { font-size: 11.5px; color: var(--text-tertiary); margin-top: 1px; }
  .hl {
    font-size: 11.5px;
    color: var(--orange);
    margin-top: 3px;
    font-style: italic;
  }

  .time {
    font-weight: 700;
    font-size: 16px;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.2px;
  }
  .ext {
    width: 24px; height: 24px;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-tertiary);
    display: flex; align-items: center; justify-content: center;
    text-decoration: none;
    font-size: 11px;
  }
  .ext:hover { background: var(--blue-soft); color: var(--blue); text-decoration: none; }

  @media (max-width: 540px) {
    .row { grid-template-columns: 44px 1fr auto; gap: 10px; padding: 10px; }
    .thumb { width: 44px; height: 44px; border-radius: 10px; }
    .ext { display: none; }
    .time { font-size: 14px; }
  }
</style>
