<script lang="ts">
  /**
   * Thin Chicago-flag band (white · blue · white · blue · white with four red
   * stars in the middle). Sits under the sticky header during Chicago week.
   */
  import ChicagoStar from './ChicagoStar.svelte';
  export let stars = 4;
</script>

<div class="band" aria-hidden="true">
  <div class="stripe blue"></div>
  <div class="mid">
    {#each Array(stars) as _}
      <ChicagoStar size={9} />
    {/each}
  </div>
  <div class="stripe blue"></div>
</div>

<style>
  .band {
    display: grid;
    grid-template-rows: 3px 11px 3px;
    background: #fff;
    padding: 2px 0;
  }
  .stripe.blue { background: var(--chi-blue, #41B6E6); }
  .mid {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 22px;
  }
  :global(:root[data-theme="dark"]) .band { background: #0E1A22; }
</style>
