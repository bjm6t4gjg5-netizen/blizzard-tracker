<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Chart, registerables } from 'chart.js';
  import type { Race } from '../lib/career';

  Chart.register(...registerables);

  export let races: ReadonlyArray<Race>;
  export let height = '180px';

  let canvas: HTMLCanvasElement;
  let chart: Chart | null = null;

  /** Reduce races to a per-year breakdown. */
  function aggregate(rs: ReadonlyArray<Race>) {
    const map = new Map<number, { marathons: number; halves: number; other: number }>();
    let yMin = Infinity, yMax = -Infinity;
    for (const r of rs) {
      const y = +r.date.slice(0, 4);
      if (!Number.isFinite(y)) continue;
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
      if (!map.has(y)) map.set(y, { marathons: 0, halves: 0, other: 0 });
      const b = map.get(y)!;
      if (r.distance === 'Marathon') b.marathons++;
      else if (r.distance === 'Half') b.halves++;
      else b.other++;
    }
    if (!Number.isFinite(yMin)) return { years: [], data: [] };
    const years: number[] = [];
    const data: { marathons: number; halves: number; other: number; total: number }[] = [];
    for (let y = yMin; y <= yMax; y++) {
      const b = map.get(y) ?? { marathons: 0, halves: 0, other: 0 };
      years.push(y);
      data.push({ ...b, total: b.marathons + b.halves + b.other });
    }
    return { years, data };
  }

  /**
   * Custom plugin: draw the total count above each bar so the numbers don't
   * require a hover. Chart.js doesn't ship data-labels by default and adding
   * chartjs-plugin-datalabels would balloon the bundle, so this is just ~15
   * lines of canvas.
   */
  const totalsLabelPlugin = {
    id: 'totalsLabel',
    afterDatasetsDraw(c: any) {
      const meta0 = c.getDatasetMeta(0);
      const meta1 = c.getDatasetMeta(1);
      const meta2 = c.getDatasetMeta(2);
      if (!meta0?.data) return;
      const ctx = c.ctx;
      ctx.save();
      ctx.font = '600 10px -apple-system, "SF Pro Text", system-ui, sans-serif';
      ctx.fillStyle = getComputedStyle(c.canvas).getPropertyValue('--text-secondary') || '#3A3A3C';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (let i = 0; i < meta0.data.length; i++) {
        const total =
          (c.data.datasets[0].data[i] || 0) +
          (c.data.datasets[1].data[i] || 0) +
          (c.data.datasets[2]?.data[i] || 0);
        if (total === 0) continue;
        // Pick the topmost bar segment for the label anchor
        const topMeta = (meta2?.data?.[i]?.y && c.data.datasets[2].data[i] > 0) ? meta2.data[i]
                       : (meta1?.data?.[i]?.y && c.data.datasets[1].data[i] > 0) ? meta1.data[i]
                       : meta0.data[i];
        const x = topMeta.x;
        const y = topMeta.y - 4;
        ctx.fillText(String(total), x, y);
      }
      ctx.restore();
    },
  };

  function build() {
    if (!canvas) return;
    chart?.destroy();
    const { years, data } = aggregate(races);

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [
          {
            label: 'Marathon',
            data: data.map(d => d.marathons),
            backgroundColor: '#5856D6',
            borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 } as any,
            borderSkipped: false,
            stack: 'all',
          },
          {
            label: 'Half',
            data: data.map(d => d.halves),
            backgroundColor: '#0A84FF',
            borderRadius: 0,
            borderSkipped: false,
            stack: 'all',
          },
          {
            label: 'Other',
            data: data.map(d => d.other),
            backgroundColor: '#A1A1A6',
            borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 } as any,
            borderSkipped: false,
            stack: 'all',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 10 }, color: '#3A3A3C' },
          },
          tooltip: {
            callbacks: {
              title: (items) => `${items[0].label}`,
              label: (ctx) => {
                const v = ctx.parsed.y ?? 0;
                if (v === 0) return null as any;
                return ` ${ctx.dataset.label}: ${v}`;
              },
              footer: (items) => {
                const total = items.reduce((s, i) => s + (i.parsed.y ?? 0), 0);
                return `Total: ${total}`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { font: { size: 10 }, color: '#6E6E73', maxRotation: 0, autoSkip: false },
            grid: { display: false },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 10 }, color: '#A1A1A6' },
            grid: { color: 'rgba(0,0,0,0.04)' },
          },
        },
      },
      plugins: [totalsLabelPlugin],
    });
  }

  onMount(build);
  $: if (chart && races) { chart.destroy(); build(); }
  onDestroy(() => chart?.destroy());
</script>

<div class="host" style="height: {height}">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .host { position: relative; width: 100%; }
</style>
