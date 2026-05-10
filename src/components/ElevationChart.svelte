<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import { ELEVATION_PROFILE, TOTAL_GAIN_FT } from '../lib/course';

  Chart.register(...registerables);

  export let height = '130px';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  onMount(() => {
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
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
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
            max: 13.1,
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
  });

  onDestroy(() => {
    chart?.destroy();
    chart = null;
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
    background: rgba(255,255,255,0.85);
    padding: 2px 8px;
    border-radius: 999px;
    pointer-events: none;
  }
</style>
