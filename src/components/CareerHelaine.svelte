<script lang="ts">
  import { HELAINE_RACES, HELAINE_SUMMARY } from '../lib/career';
  import SixStar from './SixStar.svelte';

  // Year-by-year roll-up
  $: byYear = (() => {
    const map = new Map<number, { marathons: number; halves: number; other: number; races: typeof HELAINE_RACES }>();
    for (const r of HELAINE_RACES) {
      const y = +r.date.slice(0, 4);
      if (!map.has(y)) map.set(y, { marathons: 0, halves: 0, other: 0, races: [] as any });
      const bucket = map.get(y)!;
      if (r.distance === 'Marathon') bucket.marathons++;
      else if (r.distance === 'Half') bucket.halves++;
      else bucket.other++;
      (bucket.races as any).push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  })();

  $: maxBar = (() => {
    let m = 0;
    for (const [, b] of byYear) m = Math.max(m, b.marathons + b.halves + b.other);
    return Math.max(m, 1);
  })();

  let hover: { year: number; marathons: number; halves: number; other: number; x: number; y: number } | null = null;

  function showHover(e: Event, year: number, b: { marathons: number; halves: number; other: number }) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const host = target.closest('.bars-host') as HTMLElement | null;
    if (!host) return;
    const hostRect = host.getBoundingClientRect();
    hover = {
      year,
      marathons: b.marathons,
      halves: b.halves,
      other: b.other,
      x: rect.left - hostRect.left + rect.width / 2,
      y: rect.top - hostRect.top - 6,
    };
  }
  function clearHover() { hover = null; }
</script>

<div class="career">
  <!-- Headline counters -->
  <div class="counters">
    <div class="counter"><div class="num">{HELAINE_SUMMARY.totalRaces}</div><div class="lbl">Races since {HELAINE_SUMMARY.firstYear}</div></div>
    <div class="counter"><div class="num">{HELAINE_SUMMARY.marathons}</div><div class="lbl">Marathons</div></div>
    <div class="counter"><div class="num">{HELAINE_SUMMARY.halves}</div><div class="lbl">Half marathons</div></div>
    <div class="counter star-counter"><div class="num">{HELAINE_SUMMARY.starCount}/6</div><div class="lbl">World Major stars</div></div>
  </div>

  <!-- 6-Star tracker -->
  <div class="card">
    <div class="card-header"><div class="card-title">Abbott World Marathon Majors</div></div>
    <div class="card-pad">
      <SixStar stars={HELAINE_SUMMARY.worldMajors} size="lg" title="" />
      <div class="next">
        {#if HELAINE_SUMMARY.starCount === 5}
          <span class="goal-tag">🎯 Tokyo next?</span>
          <span class="goal-tag-text">5 of 6. One marathon away from the 6-Star — completed by ~720 runners worldwide.</span>
        {:else if HELAINE_SUMMARY.starCount === 6}
          <span class="goal-tag goal-tag-done">🎉 6-Star complete</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Year-by-year bar chart (CSS) -->
  <div class="card">
    <div class="card-header"><div class="card-title">Races per year</div></div>
    <div class="card-pad">
      <div class="bars-host">
        <div class="bars">
          {#each byYear as [year, b]}
            <div
              class="bar-col"
              on:mouseenter={(e) => showHover(e, year, b)}
              on:mouseleave={clearHover}
              on:focus={(e) => showHover(e, year, b)}
              on:blur={clearHover}
              role="img"
              aria-label={`${year}: ${b.marathons} marathon, ${b.halves} half, ${b.other} other`}
              tabindex="0"
            >
              <div class="bars-stack">
                <div class="bar bar-mar" style="height: {(b.marathons / maxBar) * 100}%"></div>
                <div class="bar bar-hlf" style="height: {(b.halves / maxBar) * 100}%"></div>
                <div class="bar bar-oth" style="height: {(b.other / maxBar) * 100}%"></div>
              </div>
              <div class="year">{String(year).slice(2)}</div>
            </div>
          {/each}
        </div>
        {#if hover}
          <div class="tip" style="left: {hover.x}px; top: {hover.y}px;">
            <div class="tip-year">{hover.year}</div>
            <div class="tip-rows">
              <div><span class="tdot tdot-mar"></span>{hover.marathons} marathon{hover.marathons === 1 ? '' : 's'}</div>
              <div><span class="tdot tdot-hlf"></span>{hover.halves} half{hover.halves === 1 ? '' : 's'}</div>
              {#if hover.other > 0}
                <div><span class="tdot tdot-oth"></span>{hover.other} other</div>
              {/if}
            </div>
            <div class="tip-total mono">{hover.marathons + hover.halves + hover.other} total</div>
          </div>
        {/if}
      </div>
      <div class="legend">
        <span><span class="lg lg-mar"></span>Marathon</span>
        <span><span class="lg lg-hlf"></span>Half</span>
        <span><span class="lg lg-oth"></span>Other</span>
      </div>
    </div>
  </div>

  <!-- Race log -->
  <div class="card">
    <div class="card-header"><div class="card-title">All 53 races</div></div>
    <table class="races">
      <thead><tr><th>Year</th><th>Race</th><th>Distance</th><th>Location</th><th></th></tr></thead>
      <tbody>
        {#each [...HELAINE_RACES].reverse() as r}
          <tr class:wm={r.worldMajor} class:hl={!!r.highlight}>
            <td class="mono">{r.date.slice(0, 4)}</td>
            <td>{r.name}</td>
            <td><span class="dist-pill dist-{r.distance.toLowerCase()}">{r.distance}</span></td>
            <td>{r.location}</td>
            <td>
              {#if r.worldMajor}<span class="wm-tag">⭐ Major</span>{/if}
              {#if r.highlight}<span class="hl-tag">{r.highlight}</span>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .career { display: flex; flex-direction: column; gap: var(--gap-md); }

  .counters {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .counter {
    background: var(--surface);
    border-radius: var(--radius-sm);
    padding: 12px;
    text-align: center;
    box-shadow: var(--shadow-sm);
  }
  .counter .num {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 22px;
    letter-spacing: -0.4px;
    color: var(--purple);
  }
  .counter .lbl { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }
  .star-counter { background: linear-gradient(135deg, #FFF8E1, #FFE082); }
  .star-counter .num { color: #B8860B; }

  .next {
    margin-top: 14px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .goal-tag {
    padding: 4px 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, #FF9500, #FF3B30);
    color: white;
    font-size: 12px;
    font-weight: 700;
  }
  .goal-tag-text { font-size: 12px; color: var(--text-secondary); }
  .goal-tag-done { background: linear-gradient(135deg, #34C759, #007AFF); }

  /* Year-bars chart */
  .bars-host { position: relative; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .bars {
    display: grid;
    grid-template-columns: repeat(22, minmax(18px, 1fr));
    gap: 4px;
    height: 130px;
    align-items: end;
    min-width: 100%;
  }
  .bar-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    height: 100%;
    cursor: pointer;
    transition: transform 80ms ease;
  }
  .bar-col:hover { transform: translateY(-2px); }
  .bar-col:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 4px; }

  /* Hover tooltip */
  .tip {
    position: absolute;
    transform: translate(-50%, -100%);
    background: rgba(28, 28, 30, 0.95);
    color: white;
    border-radius: 8px;
    padding: 8px 12px;
    min-width: 140px;
    font-size: 11.5px;
    line-height: 1.4;
    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    pointer-events: none;
    z-index: 10;
    animation: tip-fade 120ms ease;
  }
  @keyframes tip-fade { from { opacity: 0; transform: translate(-50%, -95%); } }
  .tip-year {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: -0.2px;
    margin-bottom: 4px;
  }
  .tip-rows { display: flex; flex-direction: column; gap: 2px; }
  .tip-rows > div { display: inline-flex; align-items: center; gap: 6px; }
  .tdot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; }
  .tdot-mar { background: var(--purple); }
  .tdot-hlf { background: var(--blue); }
  .tdot-oth { background: var(--text-muted); }
  .tip-total {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(255,255,255,0.15);
    font-size: 11px;
    color: rgba(255,255,255,0.85);
  }
  .bars-stack {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column-reverse;
    border-radius: 4px 4px 0 0;
    overflow: hidden;
  }
  .bar { width: 100%; min-height: 0; transition: opacity 100ms; }
  .bar:hover { opacity: 0.85; }
  .bar-mar { background: var(--purple); }
  .bar-hlf { background: var(--blue); }
  .bar-oth { background: var(--text-muted); }
  .year { font-size: 9px; color: var(--text-tertiary); font-family: var(--font-mono); }

  .legend {
    display: flex;
    gap: 12px;
    margin-top: 10px;
    font-size: 10px;
    color: var(--text-tertiary);
  }
  .legend > span { display: inline-flex; align-items: center; gap: 4px; }
  .lg { width: 10px; height: 10px; display: inline-block; border-radius: 2px; }
  .lg-mar { background: var(--purple); }
  .lg-hlf { background: var(--blue); }
  .lg-oth { background: var(--text-muted); }

  /* Race log */
  .races { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .races th {
    text-align: left;
    padding: 8px 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--separator-soft);
    background: var(--surface-2);
    position: sticky;
    top: 0;
  }
  .races td { padding: 7px 12px; border-bottom: 1px solid var(--separator-soft); }
  .races tr.wm td { background: rgba(255, 184, 0, 0.05); }

  .dist-pill {
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    background: var(--surface-2);
    color: var(--text-secondary);
  }
  .dist-marathon { background: rgba(88, 86, 214, 0.14); color: var(--purple); }
  .dist-half     { background: rgba(0, 122, 255, 0.12); color: var(--blue); }
  .dist-mixed    { background: rgba(255, 149, 0, 0.14); color: var(--orange); }
  .dist-5k       { background: rgba(52, 199, 89, 0.14); color: #1F9D4F; }

  .wm-tag {
    padding: 1px 7px;
    border-radius: 999px;
    background: linear-gradient(135deg, #FFB800, #FF9500);
    color: white;
    font-size: 10px;
    font-weight: 700;
  }
  .hl-tag {
    margin-left: 4px;
    padding: 1px 7px;
    border-radius: 999px;
    background: rgba(255, 149, 0, 0.14);
    color: var(--orange);
    font-size: 10px;
    font-weight: 700;
  }

  @media (max-width: 700px) {
    .counters { grid-template-columns: repeat(2, 1fr); }
    /* Keep all 22 years in one row but allow horizontal scroll. */
    .bars { grid-template-columns: repeat(22, 28px); min-width: max-content; }
    .races th, .races td { padding: 6px 8px; font-size: 11.5px; }
  }
  @media (max-width: 540px) {
    .races th, .races td { padding: 5px 6px; font-size: 11px; }
    .dist-pill { padding: 1px 5px; font-size: 9px; }
  }
</style>
