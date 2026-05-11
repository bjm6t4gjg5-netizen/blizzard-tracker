<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fly, fade, scale } from 'svelte/transition';
  import { cannedEngine, QUICK_REPLIES, type CoachMessage } from '../lib/coach';
  import { load, save } from '../lib/storage';
  import { coachHidden } from '../lib/coachVisibility';

  /** Path to a future Coach Dan profile photo. If the file exists at this
      path, it's used as the avatar. If not, we fall back to styled "CD"
      initials. Drop `photo-coach-dan.jpeg` into public/ to swap. */
  const COACH_PHOTO = './photo-coach-dan.jpeg';

  let open = false;
  let input = '';
  let busy = false;
  let messages: CoachMessage[] = load<CoachMessage[]>('coachThread', [
    { id: 1, role: 'coach', timestamp: Date.now(), text: "Hi! I'm Coach Dan 👋 Ask me anything about race day — pacing, cheer zones, the runners' records, the weather. Tap a chip below for a starting point." },
  ]);
  let listEl: HTMLDivElement;
  let avatarFailed = false;

  function hideCoach() {
    open = false;
    coachHidden.set(true);
  }
  function showCoach() {
    coachHidden.set(false);
  }

  // Persist messages so the conversation survives reloads.
  $: save('coachThread', messages.slice(-30)); // cap history

  async function scrollToBottom() {
    await tick();
    if (listEl) listEl.scrollTop = listEl.scrollHeight;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    busy = true;
    messages = [
      ...messages,
      { id: Date.now(), role: 'user', text: trimmed, timestamp: Date.now() },
    ];
    input = '';
    await scrollToBottom();

    const reply = await cannedEngine.ask(trimmed);
    messages = [
      ...messages,
      { id: Date.now() + 1, role: 'coach', text: reply, timestamp: Date.now() },
    ];
    busy = false;
    await scrollToBottom();
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function clearThread() {
    messages = [
      { id: Date.now(), role: 'coach', timestamp: Date.now(), text: "Fresh start. What's on your mind?" },
    ];
  }

  // Render markdown-ish styling: **bold**, line breaks
  function renderText(s: string): string {
    return s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  onMount(() => {
    if (open) scrollToBottom();
  });

  $: if (open) scrollToBottom();
</script>

<!-- "Bring Coach Dan back" mini-pill when he's hidden -->
{#if $coachHidden}
  <button
    class="reopen"
    on:click={showCoach}
    aria-label="Show Coach Dan"
    title="Show Coach Dan"
    transition:scale={{ duration: 200 }}
  >
    <span>↻</span>
    <span class="reopen-label">Coach Dan</span>
  </button>
{/if}

<!-- Floating launcher button -->
{#if !open && !$coachHidden}
  <button
    class="launcher"
    on:click={() => (open = true)}
    aria-label="Open Coach Dan chat"
    transition:scale={{ duration: 200 }}
    data-tour="coach"
  >
    <span class="avatar avatar-sm">
      {#if !avatarFailed}
        <img src={COACH_PHOTO} alt="" on:error={() => (avatarFailed = true)} />
      {:else}
        <span class="initials">CD</span>
      {/if}
    </span>
    <span class="launcher-label">Coach Dan</span>
  </button>
{/if}

<!-- Chat panel -->
{#if open}
  <div class="panel" transition:fly={{ y: 20, duration: 220 }} role="dialog" aria-label="Coach Dan chat">
    <header class="panel-head">
      <span class="avatar">
        {#if !avatarFailed}
          <img src={COACH_PHOTO} alt="Coach Dan" on:error={() => (avatarFailed = true)} />
        {:else}
          <span class="initials">CD</span>
        {/if}
      </span>
      <div class="head-text">
        <div class="head-name">Coach Dan</div>
        <div class="head-status"><span class="dot"></span> Race-day assistant</div>
      </div>
      <button class="head-icon" on:click={clearThread} title="Clear conversation" aria-label="Clear">↺</button>
      <button class="head-icon" on:click={() => (open = false)} title="Minimise" aria-label="Minimise">–</button>
      <button class="head-icon head-icon-hide" on:click={hideCoach} title="Hide Coach Dan for this session" aria-label="Hide">✕</button>
    </header>

    <div class="msgs" bind:this={listEl}>
      {#each messages as m (m.id)}
        <div class="msg msg-{m.role}">
          <div class="bubble">{@html renderText(m.text)}</div>
        </div>
      {/each}
      {#if busy}
        <div class="msg msg-coach" transition:fade>
          <div class="bubble bubble-typing"><span></span><span></span><span></span></div>
        </div>
      {/if}
    </div>

    <div class="quick">
      {#each QUICK_REPLIES as q}
        <button class="chip" on:click={() => send(q.prompt)} disabled={busy}>{q.label}</button>
      {/each}
    </div>

    <div class="input-row">
      <input
        type="text"
        class="input"
        placeholder="Ask Coach Dan…"
        bind:value={input}
        on:keydown={handleKey}
        disabled={busy}
      />
      <button class="send" on:click={() => send(input)} disabled={busy || !input.trim()} aria-label="Send">
        ↑
      </button>
    </div>
  </div>
{/if}

<style>
  /* ────── Launcher ────── */
  .launcher {
    position: fixed;
    bottom: 22px;
    right: 22px;
    z-index: 1500;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 18px 8px 8px;
    border: none;
    border-radius: 999px;
    background: var(--surface);
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.18), 0 1px 4px rgba(15, 23, 42, 0.08);
    cursor: pointer;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 13px;
    transition: transform 100ms ease, box-shadow 150ms ease;
  }

  /* "Show Coach Dan" mini-pill — appears bottom-left so it doesn't steal
     the corner from any future chat-launcher position. */
  .reopen {
    position: fixed;
    bottom: 22px;
    left: 18px;
    z-index: 1500;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--separator);
    background: var(--surface);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--shadow-sm);
  }
  .reopen:hover { color: var(--blue); border-color: var(--blue); }
  .reopen-label { letter-spacing: -0.1px; }
  .launcher:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.22); }
  .launcher-label { padding-right: 4px; letter-spacing: -0.2px; }

  /* ────── Avatar ────── */
  .avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--blue), var(--purple));
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    box-shadow: inset 0 0 0 2px rgba(255,255,255,0.5);
  }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-sm { width: 32px; height: 32px; }
  .initials {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.3px;
  }
  .avatar-sm .initials { font-size: 12px; }

  /* ────── Panel ────── */
  .panel {
    position: fixed;
    bottom: 22px;
    right: 22px;
    z-index: 1500;
    width: 380px;
    max-width: calc(100vw - 24px);
    height: 540px;
    max-height: calc(100vh - 100px);
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.32), 0 4px 12px rgba(15, 23, 42, 0.10);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--separator-soft);
    background: linear-gradient(135deg, color-mix(in srgb, var(--blue) 8%, var(--surface)), var(--surface));
  }
  .head-text { flex: 1; min-width: 0; }
  .head-name { font-weight: 700; font-size: 14px; letter-spacing: -0.2px; }
  .head-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 1px;
  }
  .head-status .dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--green);
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.5; transform: scale(0.85); }
  }
  .head-icon {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: none;
    background: var(--surface-2);
    color: var(--text-tertiary);
    font-size: 13px;
    cursor: pointer;
    transition: background 100ms ease, color 100ms ease;
  }
  .head-icon:hover { background: var(--separator); color: var(--text-primary); }
  .head-icon-hide:hover { background: rgba(255, 59, 48, 0.10); color: var(--red); }

  .msgs {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;
  }
  .msg { display: flex; }
  .msg-user { justify-content: flex-end; }
  .msg-coach { justify-content: flex-start; }
  .bubble {
    max-width: 80%;
    padding: 9px 13px;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.45;
    word-wrap: break-word;
    white-space: normal;
  }
  .msg-user .bubble {
    background: var(--blue);
    color: white;
    border-bottom-right-radius: 5px;
  }
  .msg-coach .bubble {
    background: var(--surface-2);
    color: var(--text-primary);
    border-bottom-left-radius: 5px;
  }
  .msg-coach .bubble :global(strong) { color: var(--blue); }
  .bubble-typing {
    display: inline-flex;
    gap: 3px;
    padding: 12px 14px;
  }
  .bubble-typing span {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
    animation: typing 1.2s ease-in-out infinite;
  }
  .bubble-typing span:nth-child(2) { animation-delay: 0.15s; }
  .bubble-typing span:nth-child(3) { animation-delay: 0.30s; }
  @keyframes typing {
    0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
    30%           { opacity: 1;    transform: translateY(-3px); }
  }

  .quick {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 14px 0;
  }
  .chip {
    padding: 5px 10px;
    border-radius: 999px;
    border: 1px solid var(--separator);
    background: var(--surface);
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 100ms ease;
  }
  .chip:hover:not(:disabled) {
    background: var(--blue-soft);
    color: var(--blue);
    border-color: var(--blue);
  }
  .chip:disabled { opacity: 0.5; cursor: not-allowed; }

  .input-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px 14px;
    border-top: 1px solid var(--separator-soft);
  }
  .input {
    flex: 1;
    padding: 9px 14px;
    border-radius: 999px;
    border: 1px solid var(--separator);
    background: var(--surface-2);
    font-size: 13px;
    color: var(--text-primary);
    outline: none;
    transition: border-color 100ms ease, background 100ms ease;
  }
  .input:focus {
    border-color: var(--blue);
    background: var(--surface);
  }
  .send {
    width: 36px; height: 36px;
    border: none;
    border-radius: 50%;
    background: var(--blue);
    color: white;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 80ms ease, opacity 100ms ease;
  }
  .send:disabled { opacity: 0.35; cursor: not-allowed; }
  .send:hover:not(:disabled) { transform: scale(1.05); }

  /* ────── Mobile ────── */
  @media (max-width: 540px) {
    .launcher {
      bottom: 16px;
      right: 16px;
      padding: 6px 14px 6px 6px;
    }
    .launcher-label { font-size: 12px; }
    .reopen { bottom: 16px; left: 12px; }
    .panel {
      bottom: 0;
      right: 0;
      left: 0;
      width: 100%;
      max-width: 100%;
      height: 92vh;
      max-height: 92vh;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    }
    .bubble { max-width: 86%; }
  }
</style>
