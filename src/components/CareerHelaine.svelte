<script lang="ts">
  import { HELAINE_RACES, HELAINE_SUMMARY, HELAINE_PRS } from '../lib/career';
  import SixStar from './SixStar.svelte';
  import YearBarChart from './YearBarChart.svelte';
  import MarathonRoster from './MarathonRoster.svelte';

  const marathonPR = HELAINE_PRS.find(p => p.event === 'Marathon')?.mark ?? null;
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

  <!-- Marathon roster — every marathon with chip time, newest-first -->
  <MarathonRoster races={HELAINE_RACES} prTime={marathonPR} />

  <!-- Races per year — Chart.js stacked bars with totals labelled above each year -->
  <div class="card">
    <div class="card-header"><div class="card-title">Races per year · {HELAINE_SUMMARY.firstYear}–today</div></div>
    <div class="card-pad">
      <YearBarChart races={HELAINE_RACES} height="200px" />
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
    .races th, .races td { padding: 6px 8px; font-size: 11.5px; }
  }
  @media (max-width: 540px) {
    .races th, .races td { padding: 5px 6px; font-size: 11px; }
    .dist-pill { padding: 1px 5px; font-size: 9px; }
  }
</style>
