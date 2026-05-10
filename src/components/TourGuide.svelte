<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { TOUR_STEPS, tourState, closeTour, nextStep, prevStep } from '../lib/tour';
  import { activeTab } from '../lib/stores';

  $: step = TOUR_STEPS[$tourState.index];
  $: total = TOUR_STEPS.length;
  $: progress = $tourState.index + 1;

  // Spotlight bounding rect (in viewport coords). null = centered modal.
  let rect: { top: number; left: number; width: number; height: number } | null = null;

  // Tooltip placement
  let tipPos: { top: number; left: number; placement: 'top' | 'bottom' | 'left' | 'right' | 'center' } = {
    top: 0, left: 0, placement: 'center',
  };

  async function locate() {
    if (!step) return;
    // Switch tab if the step requires it.
    if (step.tab) activeTab.set(step.tab);
    await tick();
    // Wait one extra frame for tab-switch animation to land.
    await new Promise(r => requestAnimationFrame(() => r(null)));

    if (!step.target) {
      rect = null;
      tipPos = { top: window.innerHeight / 2, left: window.innerWidth / 2, placement: 'center' };
      return;
    }

    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) {
      // Element not present — treat like a centered notice.
      rect = null;
      tipPos = { top: window.innerHeight / 2, left: window.innerWidth / 2, placement: 'center' };
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    // Give scroll a beat to settle.
    await new Promise(r => setTimeout(r, 320));

    const r = el.getBoundingClientRect();
    const padding = 8;
    rect = {
      top: Math.max(0, r.top - padding),
      left: Math.max(0, r.left - padding),
      width: r.width + padding * 2,
      height: r.height + padding * 2,
    };
    tipPos = pickTooltipPosition(rect, step.placement ?? 'auto');
  }

  function pickTooltipPosition(
    r: { top: number; left: number; width: number; height: number },
    pref: 'top' | 'bottom' | 'left' | 'right' | 'auto',
  ): typeof tipPos {
    const TIP_W = 320;
    const TIP_H = 200;
    const GAP = 14;
    const VW = window.innerWidth;
    const VH = window.innerHeight;

    const spaces = {
      top:    r.top,
      bottom: VH - (r.top + r.height),
      left:   r.left,
      right:  VW - (r.left + r.width),
    };

    let placement: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
    if (pref !== 'auto') placement = pref;
    else placement = (Object.entries(spaces).sort(([, a], [, b]) => b - a)[0][0]) as any;

    if (placement === 'bottom' && spaces.bottom < TIP_H + GAP && spaces.top > spaces.bottom) placement = 'top';
    if (placement === 'top'    && spaces.top    < TIP_H + GAP && spaces.bottom > spaces.top) placement = 'bottom';

    let top = r.top, left = r.left;
    if (placement === 'bottom') {
      top = r.top + r.height + GAP;
      left = Math.min(VW - TIP_W - 12, Math.max(12, r.left + r.width / 2 - TIP_W / 2));
    } else if (placement === 'top') {
      top = r.top - TIP_H - GAP;
      left = Math.min(VW - TIP_W - 12, Math.max(12, r.left + r.width / 2 - TIP_W / 2));
    } else if (placement === 'right') {
      left = r.left + r.width + GAP;
      top = Math.min(VH - TIP_H - 12, Math.max(12, r.top + r.height / 2 - TIP_H / 2));
    } else if (placement === 'left') {
      left = r.left - TIP_W - GAP;
      top = Math.min(VH - TIP_H - 12, Math.max(12, r.top + r.height / 2 - TIP_H / 2));
    }
    return { top, left, placement };
  }

  // Re-locate when the step changes
  $: if ($tourState.open && step) locate();

  // Re-locate on viewport changes
  function onResize() { if ($tourState.open && step) locate(); }
  onMount(() => {
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, { passive: true });
  });
  onDestroy(() => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', onResize);
  });

  function onKey(e: KeyboardEvent) {
    if (!$tourState.open) return;
    if (e.key === 'Escape') closeTour();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
    else if (e.key === 'ArrowLeft') prevStep();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if $tourState.open && step}
  <!-- Dim overlay with a "hole" cut around the target via box-shadow -->
  {#if rect}
    <div
      class="spotlight"
      style="top: {rect.top}px; left: {rect.left}px; width: {rect.width}px; height: {rect.height}px;"
      aria-hidden="true"
    ></div>
  {:else}
    <div class="full-dim" aria-hidden="true"></div>
  {/if}

  <!-- Tooltip card -->
  <div
    class="tour-tip {tipPos.placement === 'center' ? 'tip-center' : 'tip-' + tipPos.placement}"
    style={tipPos.placement === 'center'
      ? 'top: 50%; left: 50%; transform: translate(-50%, -50%);'
      : `top: ${tipPos.top}px; left: ${tipPos.left}px;`}
    role="dialog"
    aria-modal="true"
    aria-labelledby="tour-title"
  >
    <div class="tip-head">
      <span class="step">Step {progress} of {total}</span>
      <button class="x" on:click={() => closeTour()} aria-label="Close tour">✕</button>
    </div>
    <h3 id="tour-title" class="tip-title">{step.title}</h3>
    <p class="tip-body">{step.body}</p>
    {#if step.note}<div class="tip-note">{step.note}</div>{/if}

    <div class="dots">
      {#each TOUR_STEPS as _, i}
        <span class="dot" class:active={i === $tourState.index}></span>
      {/each}
    </div>

    <div class="tip-actions">
      <button class="btn btn-ghost" on:click={() => closeTour()}>Skip tour</button>
      <div class="spacer"></div>
      {#if $tourState.index > 0}
        <button class="btn btn-soft" on:click={prevStep}>← Back</button>
      {/if}
      <button class="btn" on:click={nextStep}>
        {progress === total ? 'Finish' : 'Next →'}
      </button>
    </div>
  </div>
{/if}

<style>
  /* Spotlight: a positioned box that uses a giant outer shadow to dim
     everything else on screen. */
  .spotlight {
    position: fixed;
    border-radius: 12px;
    box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.65);
    pointer-events: none;
    z-index: 3000;
    transition:
      top 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
      left 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
      width 280ms cubic-bezier(0.2, 0.8, 0.2, 1),
      height 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .spotlight::after {
    /* A subtle inner highlight ring */
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.85);
    pointer-events: none;
  }

  .full-dim {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(2px);
    z-index: 3000;
    pointer-events: none;
  }

  .tour-tip {
    position: fixed;
    width: 320px;
    max-width: calc(100vw - 24px);
    background: var(--surface);
    color: var(--text-primary);
    border-radius: var(--radius);
    box-shadow: 0 18px 60px rgba(15, 23, 42, 0.35), 0 4px 12px rgba(15, 23, 42, 0.18);
    padding: 16px 18px;
    z-index: 3001;
    animation: tip-pop 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .tip-center {
    width: 380px;
    max-width: calc(100vw - 24px);
    padding: 22px;
  }
  @keyframes tip-pop {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
  }
  /* Re-center the centered modal at 50%/50% */
  .tip-center { animation-name: tip-pop-center; }
  @keyframes tip-pop-center {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  .tip-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .step {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-tertiary);
  }
  .x {
    width: 24px; height: 24px;
    border-radius: 50%;
    border: none;
    background: var(--surface-2);
    color: var(--text-tertiary);
    cursor: pointer;
    font-size: 11px;
  }
  .x:hover { background: var(--separator); color: var(--text-primary); }

  .tip-title {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.4px;
    margin: 4px 0 8px;
    color: var(--blue);
  }
  .tip-body {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
    margin: 0 0 12px;
  }
  .tip-note {
    background: var(--blue-soft);
    color: var(--blue);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    margin-bottom: 12px;
  }

  .dots {
    display: flex;
    gap: 4px;
    margin: 8px 0 14px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--separator);
    transition: background 100ms ease, transform 100ms ease;
  }
  .dot.active { background: var(--blue); transform: scale(1.3); }

  .tip-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tip-actions .spacer { flex: 1; }
  .btn { padding: 7px 12px; font-size: 12px; }

  /* Pointer arrow per side */
  .tip-bottom::before {
    content: '';
    position: absolute;
    top: -8px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 16px; height: 16px;
    background: var(--surface);
    border-radius: 3px;
    box-shadow: -1px -1px 2px rgba(0,0,0,0.05);
  }
  .tip-top::before {
    content: '';
    position: absolute;
    bottom: -8px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 16px; height: 16px;
    background: var(--surface);
    border-radius: 3px;
    box-shadow: 1px 1px 2px rgba(0,0,0,0.05);
  }
  .tip-right::before {
    content: '';
    position: absolute;
    left: -8px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
    width: 16px; height: 16px;
    background: var(--surface);
    border-radius: 3px;
    box-shadow: -1px 1px 2px rgba(0,0,0,0.05);
  }
  .tip-left::before {
    content: '';
    position: absolute;
    right: -8px;
    top: 50%;
    transform: translateY(-50%) rotate(45deg);
    width: 16px; height: 16px;
    background: var(--surface);
    border-radius: 3px;
    box-shadow: 1px -1px 2px rgba(0,0,0,0.05);
  }
</style>
