<script lang="ts">
  /**
   * Stylised (original) lakefront skyline silhouette for the Chicago hero.
   * Decorative only: positioned absolutely by the parent.
   */
  export let color = 'currentColor';
  export let opacity = 0.12;
  // [x, width, height] blocks + a few spires. Generic towers, hand-placed.
  const blocks: Array<[number, number, number]> = [
    [0, 26, 38], [24, 18, 54], [40, 22, 46], [60, 14, 70], [72, 24, 58],
    [94, 16, 84], [108, 22, 66], [128, 30, 150], [156, 18, 92], [172, 26, 110],
    [196, 14, 76], [208, 34, 172], [240, 20, 104], [258, 24, 128], [280, 16, 88],
    [294, 28, 140], [320, 18, 96], [336, 22, 72], [356, 30, 118], [384, 16, 80],
    [398, 26, 62], [422, 20, 90], [440, 30, 56], [468, 22, 74], [488, 32, 44],
  ];
  const spires: Array<[number, number, number]> = [
    // x, base height, spire height
    [216, 172, 34], [226, 172, 34], [141, 150, 22], [305, 140, 18],
  ];
</script>

<svg class="skyline" viewBox="0 0 520 210" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" style="color:{color}; opacity:{opacity}">
  <g fill="currentColor">
    {#each blocks as [x, w, h]}
      <rect x={x} y={210 - h} width={w} height={h} rx="1" />
    {/each}
    {#each spires as [x, base, h]}
      <rect x={x} y={210 - base - h} width="2.5" height={h} />
    {/each}
  </g>
</svg>

<style>
  .skyline { display: block; width: 100%; height: 100%; pointer-events: none; }
</style>
