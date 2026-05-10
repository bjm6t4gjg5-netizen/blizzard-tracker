<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import { get } from 'svelte/store';
  import { ELEVATION_PROFILE, TOTAL_GAIN_FT } from '../lib/course';
  import { TOTAL_MI } from '../lib/time';
  import { profiles, runnerState } from '../lib/stores';

  Chart.register(...registerables);

  export let height = '150px';
  /** Whether to overlay each runner's current position on the elevation line. */
  export let showRunners = true;

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;
  /** Live subscriptions to each runner's state store — we trigger a no-anim
      chart.update() whenever a runner moves so their dot tracks in real time. */
  let stateUnsubs: Array<() => void> = [];
  let profilesUnsub: (() => void) | null = null;

  /** Linear-interpolate elevation at an arbitrary mile. */
  function elevationAtMile(mi: number): number {
    if (mi <= 0) return ELEVATION_PROFILE[0]?.ft ?? 0;
    if (mi >= TOTAL_MI) return ELEVATION_PROFILE[ELEVATION_PROFILE.length - 1]?.ft ?? 0;
    for (let i = 0; i < ELEVATION_PROFILE.length - 1; i++) {
      const a = ELEVATION_PROFILE[i];
      const b = ELEVATION_PROFILE[i + 1];
      if (b.mi >= mi) {
        const span = b.mi - a.mi || 1e-9;
        const t = (mi - a.mi) / span;
        return a.ft + (b.ft - a.ft) * t;
      }
    }
    return 0;
  }

  // Chart.js plugin that paints each runner's brand-colored dot + initials
  // at their current (mile, elevation). Lives in afterDatasetsDraw so it
  // renders on top of the gradient fill.
  const runnerMarkersPlugin = {
    id: 'runnerMarkers',
    afterDatasetsDraw(c: any) {
      if (!showRunners) return;
      const ctx = c.ctx;
      const xS = c.scales.x;
      const yS = c.scales.y;
      if (!xS || !yS) return;

      // First pass: collect render data so we can detect overlap and nudge
      // labels apart if two runners are at the exact same mile.
      const placements: { x: number; y: number; profile: any; state: any }[] = [];
      for (const profile of get(profiles)) {
        const state = get(runnerState(profile.id));
        // Skip pre-race / no-data runners. We DO show finished (their dot
        // sits at the finish, useful for the "she's done" visual).
        if (state.status === 'pre' || state.status === 'unknown') continue;
        if (state.distMi < 0.05) continue;

        const mi = Math.min(state.distMi, TOTAL_MI);
        const ft = elevationAtMile(mi);
        const x = xS.getPixelForValue(mi);
        const y = yS.getPixelForValue(ft);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        placements.push({ x, y, profile, state });
      }
      if (placements.length === 0) return;

      for (const { x, y, profile, state } of placements) {
        const initials = profile.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
        const isFinished = state.status === 'finished';

        ctx.save();

        // Vertical guide tick from dot down to the x-axis — gentle, low alpha.
        ctx.strokeStyle = profile.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.moveTo(x, y + 11);
        ctx.lineTo(x, c.chartArea.bottom);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Outer white halo so the dot reads on both light and dark mode.
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.fill();

        // Main colored dot
        ctx.fillStyle = profile.color;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();

        // Inner stroke for separation
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Initials
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 9px -apple-system, "SF Pro Text", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials, x, y + 0.5);

        // Finished checkmark
        if (isFinished) {
          ctx.fillStyle = profile.color;
          ctx.font = '700 10px -apple-system, system-ui, sans-serif';
          ctx.textBaseline = 'bottom';
          ctx.fillText('🏆', x, y - 12);
        }

        ctx.restore();
      }
    },
  };

  function build() {
    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: ELEVATION_PROFILE.map(e => e.mi),
        datasets: [
          {
            label: 'Elevation',
            data: ELEVATION_PROFILE.map(e => e.ft),
            borderColor: '#007AFF',
            backgroundColor: (ctx) => {
              const c = ctx.chart.ctx;
              const grad = c.createLinearGradient(0, 0, 0, ctx.chart.height);
              grad.addColorStop(0, 'rgba(0, 122, 255, 0.32)');
              grad.addColorStop(1, 'rgba(0, 122, 255, 0)');
              return grad;
            },
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2,
          },
        ],
      },
      plugins: [runnerMarkersPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 18 } },  // headroom for the runner dots + 🏆
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (items) => `Mile ${items[0].label}`,
              label: (ctx) => `${ctx.parsed.y} ft`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: TOTAL_MI,
            ticks: {
              stepSize: 1,
              color: '#A1A1A6',
              font: { size: 10 },
              callback: (v) => `${v}mi`,
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#A1A1A6',
              font: { size: 10 },
              callback: (v) => `${v}ft`,
            },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });
  }

  /** (Re)subscribe to runner state stores so the markers track live. */
  function resubscribeStates() {
    for (const u of stateUnsubs) u();
    stateUnsubs = [];
    for (const p of get(profiles)) {
      const store = runnerState(p.id);
      stateUnsubs.push(store.subscribe(() => chart?.update('none')));
    }
  }

  onMount(() => {
    build();
    if (showRunners) {
      resubscribeStates();
      profilesUnsub = profiles.subscribe(resubscribeStates);
    }
  });

  onDestroy(() => {
    chart?.destroy();
    chart = null;
    for (const u of stateUnsubs) u();
    stateUnsubs = [];
    profilesUnsub?.();
  });
</script>

<div class="elev-host" style="height: {height}">
  <canvas bind:this={canvas}></canvas>
  <div class="elev-stamp">+{TOTAL_GAIN_FT}ft total</div>
</div>

<style>
  .elev-host {
    position: relative;
    width: 100%;
  }
  .elev-stamp {
    position: absolute;
    top: 6px;
    right: 10px;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-tertiary);
    letter-spacing: 0.3px;
    background: color-mix(in srgb, var(--surface) 85%, transparent);
    padding: 2px 8px;
    border-radius: 999px;
    pointer-events: none;
  }
</style>
