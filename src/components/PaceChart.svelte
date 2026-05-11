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

    // Default visible: Best/Dream + Goal + Tough — three contrast bands that
    // bracket the realistic outcome space. Strong + Run-Walk hide initially
    // (legend toggles them back on).
    const hiddenByDefault = new Set(['strong', 'runwalk']);
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

  /**
   * The user's editable per-mile target times form the canonical goal line —
   * a clean blue dotted line through the split anchors, no large markers.
   * Hover still works via Chart.js's nearest-point tooltip.
   */
  function goalSplitsDataset() {
    return {
      label: '🎯 Goal',
      data: goals.splitGoals
        .slice()
        .sort((a, b) => a.mi - b.mi)
        .map(g => ({ x: g.mi, y: +(g.targetSec / 60).toFixed(2) })),
      borderColor: '#007AFF',
      backgroundColor: 'transparent',
      borderWidth: 2.5,
      borderDash: [4, 5],
      pointRadius: 0,
      pointHoverRadius: 5,
      pointBackgroundColor: '#FFFFFF',
      pointBorderColor: '#007AFF',
      pointBorderWidth: 2,
      tension: 0.15,
      showLine: true,
      order: 0,
    };
  }

  $: datasets = (() => {
    const ds: any[] = [];
    const fromMi  = midRace ? state.distMi : 0;
    const fromSec = midRace ? state.elapsedSec : 0;
    // Once the race is over for this runner, predictions add noise.
    // Show only the actual line + the original goal-split markers so the
    // story becomes "here's what happened vs the goal".
    if (!finished) {
      for (const s of goals.scenarios) ds.push(scenarioDataset(s, goals, fromMi, fromSec));
    }
    ds.push(goalSplitsDataset());
    const actual = actualDataset();
    if (actual) ds.push(actual);
    return ds;
  })();

  /**
   * Vertical "now" line — drawn straight onto the canvas after the datasets.
   *
   * Why a plugin and not a dataset: the line needs to span y=0 → y=chartMax,
   * but a dataset with y=250 would force Chart.js's auto-scale to extend the
   * y-axis up to 250 even when the slowest scenario only reaches ~95. That
   * was the v3.x bug where mid-race scenarios got visually crushed into the
   * bottom third of the chart.
   */
  const nowLinePlugin = {
    id: 'nowLine',
    afterDatasetsDraw(c: any) {
      if (!midRace) return;
      const x = c.scales.x?.getPixelForValue(state.distMi);
      if (x == null || !Number.isFinite(x)) return;
      const ctx = c.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(28, 28, 30, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, c.chartArea.top);
      ctx.lineTo(x, c.chartArea.bottom);
      ctx.stroke();
      // Small "Now" label at top of the line
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(28, 28, 30, 0.6)';
      ctx.font = '600 9px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('now', x, c.chartArea.top - 2);
      ctx.restore();
    },
  };

  onMount(() => {
    chart = new Chart(canvas, {
      type: 'line',
      data: { datasets },
      plugins: [nowLinePlugin],
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
            },
          },
          tooltip: {
            mode: 'nearest',
            intersect: false,
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
            // Chart.js auto-scales y from visible datasets only, so hiding
            // Dream/Tough/Run-Walk tightens the range and amplifies the gap
            // between the lines you DO see.
            grace: '5%',     // tiny breathing room above the slowest visible line
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
