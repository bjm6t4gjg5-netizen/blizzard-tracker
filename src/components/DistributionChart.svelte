<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import { DISTRIBUTION_BINS } from '../lib/stats';

  Chart.register(...registerables);

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function build() {
    if (!canvas) return;
    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: DISTRIBUTION_BINS.map(b => b.label),
        datasets: [
          {
            label: 'Share of finishers',
            data: DISTRIBUTION_BINS.map(b => Math.round(b.share * 100)),
            backgroundColor: 'rgba(0, 122, 255, 0.25)',
            borderColor: 'rgba(0, 122, 255, 0.55)',
            borderWidth: 1,
            borderRadius: 6,
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
            callbacks: { label: (ctx) => `${ctx.parsed.y}% of field` },
          },
        },
        scales: {
          x: { ticks: { font: { size: 10 } } },
          y: {
            beginAtZero: true,
            ticks: { callback: (v) => `${v}%`, font: { size: 10 } },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
    });
  }

  onMount(build);
  onDestroy(() => chart?.destroy());
</script>

<div class="host">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .host { position: relative; height: 220px; }
</style>
