<script lang="ts">
  import { toast } from '../lib/stores';
  import { fly, fade } from 'svelte/transition';
</script>

{#if $toast}
  {#key $toast.id}
    <div class="toast" in:fly={{ y: 20, duration: 240 }} out:fade={{ duration: 180 }}>
      <span>⚡</span>
      <span>{$toast.text}</span>
    </div>
  {/key}
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 18px;
    background: rgba(28, 28, 30, 0.92);
    color: white;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 200;
  }
</style>
