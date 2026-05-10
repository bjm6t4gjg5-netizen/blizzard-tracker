<script lang="ts">
  import { profiles, addRunner, removeRunner, settingsOpen, notify } from '../lib/stores';

  let newName = '';
  let newTrackId = '';
  let newEmoji = '🏃';
  let newColor = '#5856D6';
  let formError = '';
  let busy = false;

  function close() {
    settingsOpen.set(false);
    formError = '';
  }

  async function submit() {
    if (busy) return;
    busy = true;
    const res = addRunner({
      name: newName,
      trackId: newTrackId,
      emoji: newEmoji,
      color: newColor,
    });
    busy = false;
    if (!res.ok) {
      formError = res.error ?? 'Could not add runner';
      return;
    }
    formError = '';
    notify(`Added ${newName.split(' ')[0]} 🎉`);
    newName = '';
    newTrackId = '';
    newEmoji = '🏃';
    newColor = '#5856D6';
  }

  function remove(id: string, name: string) {
    if (!confirm(`Remove ${name} from the tracker?`)) return;
    if (removeRunner(id)) notify(`Removed ${name.split(' ')[0]}`);
  }
</script>

{#if $settingsOpen}
  <div class="overlay" on:click={(e) => e.target === e.currentTarget && close()} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rm-title">
      <button class="x" on:click={close} aria-label="Close">✕</button>
      <div id="rm-title" class="title">Manage runners</div>
      <p class="lede">Catherine and Helaine are anchored. Add anyone with an RTRT tracker ID for the BKH 2026 event.</p>

      <div class="list">
        {#each $profiles as p (p.id)}
          <div class="row" style="--pc: {p.color}">
            <span class="dot"></span>
            <div class="col">
              <div class="r-name">{p.emoji} {p.name}</div>
              <div class="r-id mono">{p.trackId}{p.fixed ? ' · anchored' : ''}</div>
            </div>
            {#if !p.fixed}
              <button class="rm" on:click={() => remove(p.id, p.name)} title="Remove">✕</button>
            {/if}
          </div>
        {/each}
      </div>

      <div class="add-block">
        <div class="add-title">+ Add a runner</div>
        <div class="grid">
          <div class="form-group g-2">
            <label class="form-label" for="rm-name">Full name</label>
            <input id="rm-name" class="form-input" bind:value={newName} placeholder="Alex Blizzard" />
          </div>
          <div class="form-group g-2">
            <label class="form-label" for="rm-tid">RTRT tracker ID</label>
            <input
              id="rm-tid"
              class="form-input mono"
              bind:value={newTrackId}
              placeholder="RMGBEVSK"
              style="text-transform: uppercase"
              autocomplete="off"
            />
          </div>
          <div class="form-group">
            <label class="form-label" for="rm-emoji">Emoji</label>
            <input id="rm-emoji" class="form-input" bind:value={newEmoji} placeholder="🏃" maxlength="2" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rm-color">Color</label>
            <input id="rm-color" class="form-input color" type="color" bind:value={newColor} />
          </div>
        </div>
        {#if formError}<div class="err">{formError}</div>{/if}
        <div class="actions">
          <button class="btn" on:click={submit} disabled={busy}>{busy ? 'Adding…' : '+ Add runner'}</button>
          <button class="btn btn-ghost" on:click={close}>Done</button>
        </div>
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
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .sheet {
    position: relative;
    width: 460px;
    max-width: 100%;
    max-height: 88vh;
    overflow-y: auto;
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: 22px;
    box-shadow: var(--shadow-lg);
  }
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
  .title { font-size: 18px; font-weight: 700; letter-spacing: -0.4px; }
  .lede { font-size: 12px; color: var(--text-tertiary); margin: 4px 0 14px; }

  .list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 18px; }
  .row {
    --pc: var(--blue);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    border-left: 3px solid var(--pc);
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--pc); }
  .col { flex: 1; min-width: 0; }
  .r-name { font-weight: 600; font-size: 14px; }
  .r-id { font-size: 11px; color: var(--text-tertiary); }
  .rm {
    width: 26px; height: 26px;
    border: 1px solid var(--separator);
    background: white;
    border-radius: 50%;
    color: var(--text-tertiary);
    cursor: pointer;
  }
  .rm:hover { background: rgba(255, 59, 48, 0.10); color: var(--red); border-color: rgba(255, 59, 48, 0.3); }

  .add-block {
    border-top: 1px solid var(--separator-soft);
    padding-top: 14px;
  }
  .add-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-tertiary);
    margin-bottom: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .g-2 { grid-column: span 2; }
  .color { padding: 2px; height: 38px; }
  .err { font-size: 12px; color: var(--red); margin: 4px 0 8px; }
  .actions { display: flex; gap: 8px; margin-top: 8px; }
  .actions .btn { flex: 1; }
</style>
