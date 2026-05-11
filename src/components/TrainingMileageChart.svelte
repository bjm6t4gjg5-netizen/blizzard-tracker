<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import type { WeeklyMileage } from '../lib/trainingSample';
  Chart.register(...registerables);

  export let weeks: ReadonlyArray<WeeklyMileage>;
  export let color = '#007AFF';
  export let height = '180px';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function fmtWeek(d: string): string {
    const dt = new Date(d + 'T12:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function build() {
    chart?.destroy();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: weeks.map(w => fmtWeek(w.weekOf)),
        datasets: [
          { label: 'Easy',    data: weeks.map(w => w.easy),    backgroundColor: color + 'AA', stack: 's' },
          { label: 'Tempo',   data: weeks.map(w => w.tempo),   backgroundColor: '#FF9500',     stack: 's' },
          { label: 'Long',    data: weeks.map(w => w.long),    backgroundColor: '#34C759',     stack: 's' },
          { label: 'Workout', data: weeks.map(w => w.workout), backgroundColor: '#FF3B30',     stack: 's' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              footer: (items) => 'Total: ' + items.reduce((s, i) => s + (i.parsed.y ?? 0), 0) + ' mi',
            },
          },
        },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 } }, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, callback: (v) => `${v}mi` }, grid: { color: 'rgba(0,0,0,0.04)' } },
        },
      },
    });
  }

  onMount(build);
  $: if (chart && weeks) { chart.destroy(); build(); }
  onDestroy(() => chart?.destroy());
</script>

<div class="host" style="height: {height}">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .host { position: relative; width: 100%; }
</style>
