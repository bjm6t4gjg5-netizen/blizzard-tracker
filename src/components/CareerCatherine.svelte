<script lang="ts">
  import { CATHERINE_PRS, CATHERINE_RACES, CATHERINE_SUMMARY } from '../lib/career';
  import SixStar from './SixStar.svelte';

  $: byYear = (() => {
    const map = new Map<number, typeof CATHERINE_RACES>();
    for (const r of CATHERINE_RACES) {
      const y = +r.date.slice(0, 4);
      if (!map.has(y)) map.set(y, [] as any);
      (map.get(y) as any).push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  })();

  // The dad's MVP photo, if dropped into public/. Falls back to a styled card.
  const mvpPhoto = './photo-mvp-2012.jpeg';
  let mvpPhotoLoaded = true;
</script>

<div class="career">
  <!-- MVP banner -->
  <div class="mvp">
    <div class="mvp-photo">
      <img
        src={mvpPhoto}
        alt="Catherine with her 2012 DPL City Meet MVP plaque"
        on:error={() => (mvpPhotoLoaded = false)}
        class:hidden={!mvpPhotoLoaded}
      />
      {#if !mvpPhotoLoaded}
        <div class="mvp-fallback">
          <span class="trophy">🏆</span>
          <span class="hint">Drop <code>photo-mvp-2012.jpeg</code> into <code>public/</code></span>
        </div>
      {/if}
    </div>
    <div class="mvp-text">
      <div class="mvp-eyebrow">💛 Spring 2012 · 8th grade</div>
      <h3 class="mvp-title">DPL Varsity City Meet — Female MVP</h3>
      <p class="mvp-sub">
        Saint Rita Spartans. Won every 800m and every 1600m she ran that season — culminating
        in season-best PRs of <b class="mono">2:30.62</b> and <b class="mono">5:46.22</b> at City. Long jump 13′06.50″.
      </p>
    </div>
  </div>

  <!-- Headline counters -->
  <div class="counters">
    <div class="counter"><div class="num">3:06:12</div><div class="lbl">Marathon PR · Boston 2025</div></div>
    <div class="counter"><div class="num">5:46</div><div class="lbl">1600m PR · 8th grade</div></div>
    <div class="counter"><div class="num">{CATHERINE_SUMMARY.wins}</div><div class="lbl">1st-place finishes</div></div>
    <div class="counter"><div class="num">2× 🏆</div><div class="lbl">XC Champion seasons</div></div>
  </div>

  <!-- World Major tracker (same component Helaine uses) -->
  {#if CATHERINE_SUMMARY.starCount > 0}
    <div class="card">
      <div class="card-header"><div class="card-title">Abbott World Marathon Majors</div></div>
      <div class="card-pad">
        <SixStar stars={CATHERINE_SUMMARY.worldMajors} size="lg" title="" />
        <div class="majors-next">
          <span class="goal-tag">🎯 {6 - CATHERINE_SUMMARY.starCount} to go</span>
          <span class="goal-tag-text">{CATHERINE_SUMMARY.starCount} of 6 majors done. {CATHERINE_SUMMARY.starCount === 1 ? 'Just getting started' : 'Building toward the 6-Star'}.</span>
        </div>
      </div>
    </div>
  {/if}

  <!-- PR table -->
  <div class="card">
    <div class="card-header"><div class="card-title">Personal records</div></div>
    <table class="prs">
      <thead>
        <tr><th>Event</th><th>Mark</th><th>Pace</th><th>Year</th><th>Meet</th></tr>
      </thead>
      <tbody>
        {#each CATHERINE_PRS as pr}
          <tr class:adult={pr.isAdult}>
            <td>{pr.event}</td>
            <td class="mono mark">{pr.mark}</td>
            <td class="mono">{pr.paceLabel ?? '—'}</td>
            <td class="mono">{pr.date.slice(0, 4)}</td>
            <td>
              {#if pr.href}
                <a href={pr.href} target="_blank" rel="noopener noreferrer">{pr.meet ?? '—'} ↗</a>
              {:else}
                {pr.meet ?? '—'}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Year-by-year timeline -->
  <div class="card">
    <div class="card-header"><div class="card-title">Race log · 2009 → today</div></div>
    <div class="timeline">
      {#each byYear as [year, races]}
        <div class="year-block">
          <div class="year-label">{year}</div>
          <div class="year-races">
            {#each races as r}
              <div class="race" class:hl={!!r.highlight}>
                <div class="race-name">
                  {r.name}
                  {#if r.highlight}<span class="hl-tag">{r.highlight}</span>{/if}
                </div>
                <div class="race-meta">
                  <span class="dist">{r.event ?? r.distance}</span>
                  {#if r.location}<span class="loc">· {r.location}</span>{/if}
                  {#if r.time}<span class="time mono">· {r.time}</span>{/if}
                  {#if r.place}<span class="place">· {typeof r.place === 'number' ? `${r.place}${ordinal(r.place)}` : r.place}</span>{/if}
                </div>
                {#if r.notes}<div class="notes">{r.notes}</div>{/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<script context="module" lang="ts">
  function ordinal(n: number): string {
    if (n % 100 >= 11 && n % 100 <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }
</script>

<style>
  .career { display: flex; flex-direction: column; gap: var(--gap-md); }

  .mvp {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: var(--gap-md);
    background: linear-gradient(135deg, #FFF7E6 0%, #FFE9B3 100%);
    border-radius: var(--radius);
    padding: 18px;
    border: 1px solid rgba(255, 184, 0, 0.35);
    box-shadow: var(--shadow-sm);
  }
  .mvp-photo {
    aspect-ratio: 4 / 5;
    border-radius: 10px;
    overflow: hidden;
    background: white;
    box-shadow: var(--shadow);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mvp-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .mvp-photo img.hidden { display: none; }
  .mvp-fallback {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    color: var(--text-tertiary);
    text-align: center;
  }
  .mvp-fallback .trophy { font-size: 56px; }
  .mvp-fallback .hint { font-size: 11px; }
  .mvp-fallback code { background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 4px; font-size: 10.5px; }

  .mvp-eyebrow {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #B8860B;
  }
  .mvp-title { font-size: 22px; font-weight: 800; letter-spacing: -0.6px; margin: 4px 0 8px; }
  .mvp-sub { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0; }

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
    font-size: 20px;
    letter-spacing: -0.4px;
    color: var(--blue);
  }
  .counter .lbl { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }

  .prs {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .prs th {
    text-align: left;
    padding: 8px 12px;
    font-weight: 600;
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--separator-soft);
  }
  .prs td { padding: 8px 12px; border-bottom: 1px solid var(--separator-soft); }
  .prs tr:last-child td { border-bottom: none; }
  .prs .mark { font-weight: 700; color: var(--blue); }
  .prs tr.adult td { background: var(--blue-soft); }
  .prs a { color: var(--blue); }

  .majors-next {
    margin-top: 14px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .goal-tag {
    padding: 4px 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, var(--blue), var(--purple));
    color: white;
    font-size: 12px;
    font-weight: 700;
  }
  .goal-tag-text { font-size: 12px; color: var(--text-secondary); }

  .timeline { padding: 0 14px 14px; }
  .year-block {
    display: grid;
    grid-template-columns: 60px 1fr;
    gap: var(--gap-md);
    padding: 14px 0;
    border-bottom: 1px solid var(--separator-soft);
  }
  .year-block:last-child { border-bottom: none; }
  .year-label {
    font-family: var(--font-mono);
    font-weight: 800;
    font-size: 22px;
    color: var(--text-tertiary);
    letter-spacing: -0.5px;
    align-self: start;
  }
  .year-races { display: flex; flex-direction: column; gap: 8px; }
  .race {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    border-left: 3px solid var(--separator);
  }
  .race.hl {
    background: rgba(255, 149, 0, 0.08);
    border-left-color: var(--orange);
  }
  .race-name { font-weight: 600; font-size: 13px; }
  .hl-tag {
    margin-left: 6px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--orange);
    color: white;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .race-meta { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }
  .race-meta .place { color: var(--text-secondary); font-weight: 600; }
  .notes { font-size: 11px; color: var(--text-muted); margin-top: 2px; font-style: italic; }

  @media (max-width: 700px) {
    .mvp { grid-template-columns: 1fr; }
    .counters { grid-template-columns: repeat(2, 1fr); }
    .year-block { grid-template-columns: 50px 1fr; }
  }
  @media (max-width: 540px) {
    .mvp { padding: 14px; }
    .mvp-title { font-size: 18px; }
    .mvp-sub { font-size: 12px; }
    .counter .num { font-size: 17px; }
    .counter .lbl { font-size: 10px; }
    .prs th, .prs td { padding: 6px 8px; font-size: 12px; }
    /* Hide the "Meet" column on phones — too cramped to read alongside */
    .prs th:nth-child(5), .prs td:nth-child(5) { display: none; }
    .year-block { grid-template-columns: 40px 1fr; gap: 8px; }
    .year-label { font-size: 17px; }
    .race-name { font-size: 12px; }
  }
</style>
