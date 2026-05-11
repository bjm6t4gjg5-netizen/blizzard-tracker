<script lang="ts">
  import { profiles, activeTab, settingsOpen, tabOrder } from '../lib/stores';
  import { devUnlocked } from '../lib/devMode';

  interface TabSpec { id: string; label: string; emoji: string; devOnly?: boolean; }

  /** Tabs that only appear when developer mode is unlocked. They render with
   *  a small orange dot so we know they aren't public. */
  const DEV_ONLY_TABS = new Set(['old-races', 'training']);

  function defaultIds(profs: typeof $profiles, devOn: boolean): string[] {
    const base = ['family', ...profs.map(p => p.id), 'weather', 'stats'];
    return devOn ? [...base, 'old-races', 'training'] : base;
  }

  $: orderedIds = (() => {
    const def = defaultIds($profiles, $devUnlocked);
    const stored = $tabOrder;
    const allowed = new Set(def);
    const kept = stored.filter(id => allowed.has(id));
    const missing = def.filter(id => !kept.includes(id));
    return [...kept, ...missing];
  })();

  $: tabs = orderedIds.map(id => {
    const devOnly = DEV_ONLY_TABS.has(id);
    if (id === 'family')    return { id, label: 'Family HQ', emoji: '🏠', devOnly } as TabSpec;
    if (id === 'weather')   return { id, label: 'Weather',   emoji: '🌤', devOnly } as TabSpec;
    if (id === 'stats')     return { id, label: 'Stats',     emoji: '📊', devOnly } as TabSpec;
    if (id === 'old-races') return { id, label: 'Old Races', emoji: '📁', devOnly } as TabSpec;
    if (id === 'training')  return { id, label: 'Training',  emoji: '💪', devOnly } as TabSpec;
    const p = $profiles.find(p => p.id === id);
    return { id, label: p?.name.split(' ')[0] ?? id, emoji: p?.emoji ?? '🏃', devOnly } as TabSpec;
  });

  // If the user switched off dev mode while sitting on a dev-only tab, jump
  // them back to Family HQ so they don't see a blank pane.
  $: if (!$devUnlocked && DEV_ONLY_TABS.has($activeTab)) activeTab.set('family');

  // ────────────────────────────────────────────────────────────
  // Drag-and-drop reordering.
  //
  // HTML5 native DnD is notoriously finicky — the cardinal rule is:
  // *every* potential drop target must call preventDefault() on BOTH
  // dragenter AND dragover. Skipping either kills the drop event.
  // We also suppress the click that fires after a drag (browsers
  // dispatch a synthetic click on mouseup) so dropping doesn't
  // accidentally switch the active tab to the source.
  // ────────────────────────────────────────────────────────────

  let draggingId: string | null = null;
  let dragOverId: string | null = null;
  /** Set when a drag began, cleared shortly after dragend, so the
   *  click that follows dragend doesn't fire activeTab.set(). */
  let suppressNextClick = false;

  function onDragStart(e: DragEvent, id: string) {
    draggingId = id;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', id); } catch {}
    }
  }
  function onDragEnter(e: DragEvent, id: string) {
    if (!draggingId) return;
    e.preventDefault();
    if (id !== draggingId) dragOverId = id;
  }
  function onDragOver(e: DragEvent, _id: string) {
    if (!draggingId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  }
  function onDragLeave(id: string) {
    if (dragOverId === id) dragOverId = null;
  }
  function onDrop(e: DragEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingId || draggingId === id) { reset(); return; }
    const current = orderedIds.slice();
    const fromIdx = current.indexOf(draggingId);
    const toIdx   = current.indexOf(id);
    if (fromIdx === -1 || toIdx === -1) { reset(); return; }
    current.splice(fromIdx, 1);
    current.splice(toIdx, 0, draggingId);
    tabOrder.set(current);
    suppressNextClick = true;
    setTimeout(() => { suppressNextClick = false; }, 400);
    reset();
  }
  function onDragEnd() {
    // If the user released outside any tab, dragend fires without drop.
    // Reset visuals and suppress the trailing click on the source.
    suppressNextClick = true;
    setTimeout(() => { suppressNextClick = false; }, 400);
    reset();
  }
  function reset() {
    draggingId = null;
    dragOverId = null;
  }

  function onTabClick(id: string) {
    if (suppressNextClick) return;
    activeTab.set(id);
  }

  // Touch fallback: long-press a tab on iPad/iPhone, then drag.
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let activeTouchTab: string | null = null;
  function onPointerDown(e: PointerEvent, id: string) {
    if (e.pointerType !== 'touch') return;
    pressTimer = setTimeout(() => {
      activeTouchTab = id;
      draggingId = id;
    }, 320);
  }
  function onPointerMove(e: PointerEvent) {
    if (!activeTouchTab) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const overId = target?.closest('.tab')?.getAttribute('data-tab-id') ?? null;
    if (overId && overId !== activeTouchTab) {
      const current = orderedIds.slice();
      const fromIdx = current.indexOf(activeTouchTab);
      const toIdx   = current.indexOf(overId);
      if (fromIdx !== -1 && toIdx !== -1) {
        current.splice(fromIdx, 1);
        current.splice(toIdx, 0, activeTouchTab);
        tabOrder.set(current);
      }
    }
  }
  function onPointerUp() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    activeTouchTab = null;
    reset();
  }
</script>

<div
  class="tabs"
  role="tablist"
  data-tour="tabs"
  on:pointermove={onPointerMove}
  on:pointerup={onPointerUp}
  on:pointercancel={onPointerUp}
>
  {#each tabs as t, i (t.id)}
    <!-- div+role rather than <button> for reliable HTML5 DnD across
         Chrome/Safari. Keyboard activation handled below. -->
    <div
      class="tab"
      class:active={$activeTab === t.id}
      class:dragging={draggingId === t.id}
      class:drag-over={dragOverId === t.id}
      role="tab"
      tabindex="0"
      aria-selected={$activeTab === t.id}
      data-tab-id={t.id}
      data-tour={i === 1 ? 'runner-tab' : null}
      draggable="true"
      on:click={() => onTabClick(t.id)}
      on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTabClick(t.id); } }}
      on:dragstart={(e) => onDragStart(e, t.id)}
      on:dragenter={(e) => onDragEnter(e, t.id)}
      on:dragover={(e) => onDragOver(e, t.id)}
      on:dragleave={() => onDragLeave(t.id)}
      on:drop={(e) => onDrop(e, t.id)}
      on:dragend={onDragEnd}
      on:pointerdown={(e) => onPointerDown(e, t.id)}
    >
      <span class="emoji">{t.emoji}</span>
      <span class="label">{t.label}</span>
      {#if t.devOnly}
        <span class="dev-dot" title="Developer-only tab — not visible in the public app"></span>
      {/if}
    </div>
  {/each}
  <button
    class="tab tab-add"
    title="Add or remove runners"
    on:click={() => settingsOpen.set(true)}
    aria-label="Manage runners"
  >
    <span class="emoji">⊕</span>
  </button>
</div>

<style>
  .tabs {
    display: flex;
    gap: 4px;
    margin: var(--gap-md) 0;
    padding: 4px;
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    background: transparent;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    white-space: nowrap;
    transition: background 100ms ease, color 100ms ease, transform 100ms ease;
    scroll-snap-align: start;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    touch-action: pan-y;
  }
  .tab:hover { color: var(--text-primary); background: var(--surface-2); }
  .tab.active {
    background: var(--blue);
    color: white;
    box-shadow: var(--shadow-sm);
  }
  .tab.dragging {
    opacity: 0.45;
    cursor: grabbing;
    transform: scale(0.96);
  }
  .tab.drag-over {
    background: var(--blue-soft);
    color: var(--blue);
    box-shadow: inset 0 0 0 2px var(--blue);
  }
  .tab:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  .emoji { font-size: 14px; }

  /* Dev-only tab indicator — small orange dot, signalling the tab is hidden
     in the public build. */
  .dev-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--orange);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--orange) 35%, transparent);
    flex-shrink: 0;
  }
  .tab.active .dev-dot { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4); }

  .tab-add {
    margin-left: auto;
    border: 1px dashed var(--separator);
    color: var(--text-tertiary);
    padding: 6px 10px;
    cursor: pointer;
  }
  .tab-add:hover { color: var(--blue); border-color: var(--blue); background: var(--blue-soft); }

  @media (max-width: 600px) {
    .label { display: none; }
    .tab { padding: 8px 12px; }
    .emoji { font-size: 18px; }
    .tabs { padding: 3px; }
  }
</style>
