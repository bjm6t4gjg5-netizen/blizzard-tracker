<script lang="ts">
  import type { WorldMajorStar } from '../lib/career';

  export let stars: WorldMajorStar[];
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let title = '6-Star Marathon Major tracker';
</script>

<div class="six-star {size}">
  <div class="title">{title}</div>
  <div class="stars">
    {#each stars as s}
      <div class="star" class:done={s.finishes > 0} style="--c: {s.color}" title="{s.city}: {s.finishes > 0 ? `${s.finishes}× (${s.years.join(', ')})` : 'not yet'}">
        <div class="medal">
          {#if s.finishes > 0}
            <span class="check">⭐</span>
          {:else}
            <span class="lock">🔒</span>
          {/if}
        </div>
        <div class="city">{s.city}</div>
        {#if s.finishes > 0}
          <div class="count">{s.finishes}×</div>
        {:else}
          <div class="count subtle">—</div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .six-star { display: flex; flex-direction: column; gap: 8px; }
  .title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); }
  .stars {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
  }
  .star {
    --c: var(--blue);
    background: var(--surface-2);
    border-radius: var(--radius-sm);
    padding: 10px 6px;
    text-align: center;
    border: 1px dashed var(--separator);
    opacity: 0.55;
    transition: transform 100ms ease, opacity 100ms ease, border-color 100ms ease;
  }
  .star:hover { transform: translateY(-2px); }
  .star.done {
    opacity: 1;
    border: 1px solid var(--c);
    background: color-mix(in srgb, var(--c) 8%, white);
    box-shadow: 0 1px 2px rgba(15,23,42,0.04);
  }
  .medal {
    width: 36px; height: 36px;
    margin: 0 auto 6px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: white;
    border: 2px solid var(--c);
    font-size: 16px;
  }
  .star:not(.done) .medal { border-color: var(--separator); background: var(--surface-2); }
  .star:not(.done) .medal .lock { opacity: 0.4; font-size: 14px; }
  .city { font-size: 12px; font-weight: 600; }
  .count { font-size: 11px; color: var(--c); font-family: var(--font-mono); font-weight: 700; }
  .count.subtle { color: var(--text-muted); font-weight: 400; }

  /* Sizes */
  .sm .stars { gap: 4px; }
  .sm .star  { padding: 6px 2px; }
  .sm .medal { width: 26px; height: 26px; font-size: 12px; }
  .sm .city  { font-size: 10px; }
  .sm .count { font-size: 9px; }

  .lg .medal { width: 48px; height: 48px; font-size: 22px; }
  .lg .city  { font-size: 13px; }
  .lg .count { font-size: 13px; }

  @media (max-width: 600px) {
    .stars { grid-template-columns: repeat(3, 1fr); }
  }
</style>
