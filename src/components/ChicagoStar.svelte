<script lang="ts">
  /** The six-pointed red star from the Chicago flag. Pure SVG, scales with font-size. */
  export let size = 16;
  export let color = 'var(--chi-red, #E4002B)';
  export let title = '';
  // Six-pointed star: outer radius 1, inner radius ~0.42 (flag proportions).
  const pts = Array.from({ length: 12 }, (_, i) => {
    const r = i % 2 === 0 ? 1 : 0.42;
    const a = (Math.PI / 6) * i - Math.PI / 2;
    return `${(r * Math.cos(a)).toFixed(4)},${(r * Math.sin(a)).toFixed(4)}`;
  }).join(' ');
</script>

<svg class="chi-star" width={size} height={size} viewBox="-1 -1 2 2" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
  {#if title}<title>{title}</title>{/if}
  <polygon points={pts} fill={color} />
</svg>

<style>
  .chi-star { display: inline-block; vertical-align: middle; flex-shrink: 0; }
</style>
