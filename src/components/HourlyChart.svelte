<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import type { WeatherHour } from '../lib/weather';

  Chart.register(...registerables);

  export let hours: WeatherHour[] = [];

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  function build() {
    if (!canvas) return;
    chart?.destroy();

    const labels = hours.map(h => {
      const hr = parseInt(h.time.slice(11, 13), 10);
      return hr === 0 ? '12am' : hr < 12 ? `${hr}am` : hr === 12 ? '12pm' : `${hr - 12}pm`;
    });
    const temps = hours.map(h => h.tempF);
    const winds = hours.map(h => h.windMph);

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Temp °F',
            data: temps,
            borderColor: '#FF9500',
            backgroundColor: 'rgba(255, 149, 0, 0.18)',
            yAxisID: 'y',
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 3,
          },
          {
            label: 'Wind mph',
            data: winds,
            borderColor: '#5856D6',
            backgroundColor: 'transparent',
            yAxisID: 'y1',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: true, position: 'top', labels: { font: { size: 10 }, boxWidth: 10 } },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: { ticks: { font: { size: 10 } } },
          y:  { position: 'left',  title: { display: true, text: '°F', font: { size: 10 } }, ticks: { font: { size: 10 } } },
          y1: { position: 'right', title: { display: true, text: 'mph', font: { size: 10 } }, grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });
  }

  onMount(build);
  $: if (chart && hours) { chart.destroy(); build(); }
  onDestroy(() => chart?.destroy());
</script>

<div class="host">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .host { position: relative; height: 180px; }
</style>
