<script lang="ts">
  import { tryUnlock } from '../lib/devMode';
  import { notify } from '../lib/stores';

  export let open = false;

  let password = '';
  let error = '';
  let busy = false;

  async function submit() {
    if (busy) return;
    busy = true;
    error = '';
    const ok = await tryUnlock(password);
    busy = false;
    if (ok) {
      open = false;
      password = '';
      notify('🛠 Developer mode unlocked');
    } else {
      error = 'Wrong password.';
    }
  }

  function close() {
    open = false;
    password = '';
    error = '';
  }
</script>

{#if open}
  <div class="overlay" on:click={(e) => e.target === e.currentTarget && close()} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="dev-modal-title">
      <button class="x" on:click={close} aria-label="Close">✕</button>
      <div id="dev-modal-title" class="title">🛠 Developer access</div>
      <p class="lede">Enter the password to unlock race-position simulation tools.</p>
      <div class="form-group">
        <label class="form-label" for="dev-pw">Password</label>
        <input
          id="dev-pw"
          class="form-input"
          type="password"
          placeholder="••••••••••"
          autocomplete="off"
          bind:value={password}
          on:keydown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      {#if error}<div class="err">{error}</div>{/if}
      <div class="actions">
        <button class="btn" disabled={busy} on:click={submit}>{busy ? 'Checking…' : 'Unlock'}</button>
        <button class="btn btn-ghost" on:click={close}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(4px);
    /* Above Leaflet popups (z-index ~700) and any sticky map controls. */
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fade 200ms ease;
  }
  .sheet {
    position: relative;
    width: 360px;
    max-width: 100%;
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: 22px;
    box-shadow: var(--shadow-lg);
    animation: pop 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop  { from { opacity: 0; transform: translateY(8px) scale(0.97); } }
  .x {
    position: absolute;
    top: 12px; right: 12px;
    width: 28px; height: 28px;
    border-radius: 50%;
    border: none;
    background: var(--surface-2);
    color: var(--text-tertiary);
    font-size: 13px;
    cursor: pointer;
  }
  .x:hover { background: var(--separator); color: var(--text-primary); }
  .title { font-size: 17px; font-weight: 700; letter-spacing: -0.4px; }
  .lede { font-size: 12px; color: var(--text-tertiary); margin: 4px 0 14px; }
  .err { font-size: 12px; color: var(--red); margin-bottom: 8px; }
  .actions { display: flex; gap: 8px; }
  .actions .btn { flex: 1; }
</style>
