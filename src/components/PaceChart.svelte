<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import { TOTAL_MI } from '../lib/time';
  import {
    type RunnerGoals, type RunnerState, type Scenario,
    buildPaceProfile, flatPaceForGoal,
  } from '../lib/runners';

  Chart.register(...registerables);

  export let goals: RunnerGoals;
  export let state: RunnerState;
  export let height = '260px';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  // Pre-race: scenarios run from mile 0 (full race plans).
  // Mid-race: scenarios FORK from the runner's current position so each
  // line reads as "from now, what does each pace strategy look like to the
  // finish?". This is what makes the chart useful for in-flight pace
  // management — a coach can see exactly how much room remains for each
  // plan from the runner's current spot.
  $: midRace = state.distMi > 0.1 && state.elapsedSec > 30 && state.status !== 'finished';
  $: finished = state.status === 'finished';

  function timeAtMile(profile: { mi: number; sec: number }[], mi: number): number {
    for (let i = 0; i < profile.length - 1; i++) {
      if (profile[i + 1].mi >= mi) {
        const span = profile[i + 1].mi - profile[i].mi || 1e-9;
        const t = (mi - profile[i].mi) / span;
        return profile[i].sec + (profile[i + 1].sec - profile[i].sec) * t;
      }
    }
    return profile[profile.length - 1]?.sec ?? 0;
  }

  function scenarioFlat(s: Scenario, g: RunnerGoals): number {
    return s.flatPaceSec ?? flatPaceForGoal(g.goalSec);
  }

  /** Build a scenario as a chart dataset, optionally projecting from (fromMi, fromSec). */
  function scenarioDataset(s: Scenario, g: RunnerGoals, fromMi: number, fromSec: number) {
    const flat = scenarioFlat(s, g);
    const profile = buildPaceProfile(flat);
    let pts: { x: number; y: number }[];

    if (fromMi <= 0.05) {
      pts = profile.map(p => ({ x: +p.mi.toFixed(3), y: +(p.sec / 60).toFixed(2) }));
    } else {
      const tAt = timeAtMile(profile, fromMi);
      pts = profile
        .filter(p => p.mi >= fromMi)
        .map(p => ({ x: +p.mi.toFixed(3), y: +((fromSec + (p.sec - tAt)) / 60).toFixed(2) }));
      // Anchor the line to the actual current point
      if (pts.length === 0 || pts[0].x > fromMi + 0.02) {
        pts.unshift({ x: +fromMi.toFixed(3), y: +(fromSec / 60).toFixed(2) });
      } else {
        pts[0] = { x: +fromMi.toFixed(3), y: +(fromSec / 60).toFixed(2) };
      }
    }

    // Hide the extreme scenarios by default — six lines on one chart is
    // visual mush. The legend lets you click any of them back on.
    const hiddenByDefault = new Set(['dream', 'tough', 'runwalk']);
    // ALL predictions are dashed. Only the actual race trace is solid, so
    // the runner's real progress visually pops away from the noise of plans.
    // The goal uses long dashes; alternatives use a short dash.
    const dash: number[] = s.key === 'goal' ? [10, 4] : [4, 4];
    return {
      label: `${s.emoji} ${s.label}`,
      data: pts,
      borderColor: s.color,
      borderWidth: s.key === 'goal' ? 2.5 : 1.8,
      borderDash: dash,
      backgroundColor: 'transparent',
      pointRadius: 0,
      tension: 0.18,
      hidden: hiddenByDefault.has(s.key),
    };
  }

  function actualDataset() {
    if (state.paceHistory.length === 0 && state.elapsedSec <= 0) return null;
    const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
    for (const h of state.paceHistory) {
      pts.push({ x: +h.mi.toFixed(3), y: +(h.elapsedSec / 60).toFixed(2) });
    }
    // Always anchor the last point at the *latest* known position from state,
    // since paceHistory may lag a single pending update.
    if (state.distMi > 0) {
      const last = pts[pts.length - 1];
      if (last.x !== +state.distMi.toFixed(3)) {
        pts.push({ x: +state.distMi.toFixed(3), y: +(state.elapsedSec / 60).toFixed(2) });
      }
    }
    // The ONLY solid line on the chart — instantly distinguishable from the
    // dashed prediction set. Slightly darker brand shade so it doesn't
    // visually merge with the goal scenario line of the same hue.
    return {
      label: '📍 Actual',
      data: pts,
      borderColor: state.profile.color,
      backgroundColor: state.profile.color,
      borderWidth: 4.5,
      borderDash: [],          // explicit: solid
      pointRadius: pts.map((_, i) => (i === pts.length - 1 ? 8 : 0)),
      pointHoverRadius: 9,
      pointBackgroundColor: '#fff',
      pointBorderColor: state.profile.color,
      pointBorderWidth: 3,
      tension: 0.2,
      // High z-order so the solid trace draws over the dashed scenarios.
      order: -1,
    };
  }

  function goalSplitsDataset() {
    return {
      label: '🎯 Goal splits',
      data: goals.splitGoals.map(g => ({ x: g.mi, y: +(g.targetSec / 60).toFixed(2) })),
      borderColor: '#FF9500',
      backgroundColor: '#FF9500',
      pointRadius: 6,
      pointStyle: 'crossRot',
      borderWidth: 0,
      showLine: false,
    };
  }

  function nowLineDataset() {
    if (!midRace) return null;
    // Vertical line at the current mile, drawn as a thin secondary plot.
    return {
      label: 'Now',
      data: [
        { x: state.distMi, y: 0 },
        { x: state.distMi, y: 250 }, // tall enough that the chart will clip
      ],
      borderColor: 'rgba(28, 28, 30, 0.35)',
      borderWidth: 1.5,
      borderDash: [3, 3],
      pointRadius: 0,
      backgroundColor: 'transparent',
      fill: false,
      showLine: true,
      tension: 0,
    };
  }

  $: datasets = (() => {
    const ds: any[] = [];
    const fromMi  = midRace ? state.distMi : 0;
    const fromSec = midRace ? state.elapsedSec : 0;
    for (const s of goals.scenarios) ds.push(scenarioDataset(s, goals, fromMi, fromSec));
    ds.push(goalSplitsDataset());
    const actual = actualDataset();
    if (actual) ds.push(actual);
    const now = nowLineDataset();
    if (now) ds.push(now);
    return ds;
  })();

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 10, boxHeight: 10, font: { size: 10 }, color: '#3A3A3C',
              filter: (item) => item.text !== 'Now',
            },
          },
          tooltip: {
            mode: 'nearest',
            intersect: false,
            filter: (ctx) => ctx.dataset.label !== 'Now',
            callbacks: {
              title: (items) => `Mile ${(items[0].parsed.x ?? 0).toFixed(2)}`,
              label: (ctx) => {
                const minutes = ctx.parsed.y ?? 0;
                const m = Math.floor(minutes);
                const s = Math.round((minutes - m) * 60);
                return `${ctx.dataset.label}: ${m}:${String(s).padStart(2, '0')}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: TOTAL_MI,
            title: { display: true, text: 'Mile', color: '#A1A1A6', font: { size: 11 } },
            ticks: { color: '#A1A1A6', font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            beginAtZero: true,
            // Y auto-scales from the visible datasets only. With dream/tough/
            // runwalk hidden by default, the range tightens to ~0–95 min for
            // Catherine and ~0–135 for Helaine, making line differences pop.
            title: { display: true, text: 'Elapsed (min)', color: '#A1A1A6', font: { size: 11 } },
            ticks: { color: '#A1A1A6', font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });
  });

  $: if (chart) {
    chart.data.datasets = datasets;
    chart.update('none');
  }

  onDestroy(() => {
    chart?.destroy();
    chart = null;
  });
</script>

<div class="wrap">
  <div class="hint">
    {#if finished}
      <span class="hint-pill hint-pill-finished">🏆 Finished — actual race plotted vs original goal</span>
    {:else if midRace}
      <span class="hint-pill hint-pill-mid">📍 Mile {state.distMi.toFixed(2)} · scenarios projecting from current pace</span>
    {:else}
      <span class="hint-pill">Pre-race — full pace plans for each scenario</span>
    {/if}
  </div>
  <div class="chart-host" style="height: {height}">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 8px; }
  .hint {
    display: flex;
    justify-content: flex-end;
  }
  .hint-pill {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-tertiary);
    background: var(--surface-2);
  }
  .hint-pill-mid { background: rgba(0, 122, 255, 0.10); color: var(--blue); }
  .hint-pill-finished { background: rgba(52, 199, 89, 0.14); color: #1F9D4F; }
  .chart-host { position: relative; width: 100%; }

  @media (max-width: 540px) {
    .hint { justify-content: flex-start; }
    .hint-pill { font-size: 10px; }
  }
</style>
