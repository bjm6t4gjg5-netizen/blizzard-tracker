<script lang="ts">
  import { runnerSettingsFor, profiles, goalsStore, updateRunner, notify } from '../lib/stores';
  import { parseGoalTime, formatHMS, formatHMSFull } from '../lib/format';
  import { buildGoalSplits, type SplitGoal } from '../lib/runners';
  import EmojiPicker from './EmojiPicker.svelte';

  $: editingId = $runnerSettingsFor;
  $: profile = editingId ? $profiles.find(p => p.id === editingId) ?? null : null;
  $: goals = editingId ? goalsStore(editingId) : null;

  // Local form state, rehydrated whenever editingId changes.
  let name = '';
  let trackId = '';
  let emoji = '🏃';
  let color = '#007AFF';
  let ageStr = '';
  let gender: 'F' | 'M' | 'X' | '' = '';
  let goalTimeStr = '';
  let goalLabel = '';
  /** Editable per-mile checkpoint targets. Stored as string for the input,
      validated on save. */
  let splits: Array<{ label: string; mi: number; targetStr: string }> = [];

  let error = '';
  let lastEditingId: string | null = null;

  $: if (editingId !== lastEditingId) {
    lastEditingId = editingId;
    if (profile && goals) {
      const g = $goals!;
      name = profile.name;
      trackId = profile.trackId;
      emoji = profile.emoji;
      color = profile.color;
      ageStr = profile.age != null ? String(profile.age) : '';
      gender = profile.gender ?? '';
      goalTimeStr = formatHMS(g.goalSec);
      goalLabel = g.goalLabel;
      splits = g.splitGoals.map(s => ({
        label: s.label,
        mi: s.mi,
        targetStr: formatHMSFull(s.targetSec),
      }));
      error = '';
    }
  }

  function close() {
    runnerSettingsFor.set(null);
    error = '';
  }

  function resetSplits() {
    const goalSec = parseGoalTime(goalTimeStr);
    if (goalSec == null) return;
    const fresh = buildGoalSplits(goalSec);
    splits = fresh.map(s => ({ label: s.label, mi: s.mi, targetStr: formatHMSFull(s.targetSec) }));
  }

  function save() {
    try {
      if (!profile || !goals) return;

      const newGoalSec = parseGoalTime(goalTimeStr);
      if (newGoalSec == null || newGoalSec < 60 * 30 || newGoalSec > 60 * 360) {
        error = 'Goal time should be in H:MM:SS, between 30 min and 6 hours.';
        return;
      }

      // Validate every split. Each must parse and be < goal.
      const parsedSplits: SplitGoal[] = [];
      for (const s of splits) {
        const sec = parseGoalTime(s.targetStr);
        if (sec == null || sec <= 0) {
          error = `Couldn't parse target time at ${s.label}. Use H:MM:SS.`;
          return;
        }
        parsedSplits.push({ label: s.label, mi: s.mi, targetSec: sec });
      }

      // Sort by mile and verify monotonic times — can't cross mile 5 before mile 3.
      parsedSplits.sort((a, b) => a.mi - b.mi);
      for (let i = 1; i < parsedSplits.length; i++) {
        if (parsedSplits[i].targetSec <= parsedSplits[i - 1].targetSec) {
          error = `Target at ${parsedSplits[i].label} must be later than ${parsedSplits[i - 1].label}.`;
          return;
        }
      }

      // Age — bind:value on a type=number input gives Svelte a string but you
      // can't trust the runtime type, so coerce defensively. THIS is what
      // broke save in round 5.
      const ageVal = typeof ageStr === 'number' ? ageStr : String(ageStr ?? '').trim();
      let ageNum: number | undefined;
      if (ageVal !== '') {
        const n = typeof ageVal === 'number' ? ageVal : parseInt(ageVal, 10);
        if (!Number.isFinite(n) || n < 5 || n > 100) {
          error = 'Age should be a whole number between 5 and 100.';
          return;
        }
        ageNum = n;
      }

      // Persist profile fields
      const profilePatch: Partial<Parameters<typeof updateRunner>[1]> = {
        emoji: (emoji ?? '').trim().slice(0, 4) || profile.emoji,
        color,
        age: ageNum,
        gender: gender || undefined,
      };
      if (!profile.fixed) {
        profilePatch.name = name.trim() || profile.name;
        profilePatch.trackId = trackId.trim().toUpperCase() || profile.trackId;
      }
      updateRunner(profile.id, profilePatch as any);

      // Persist goals
      goals.update(g => ({
        ...g,
        goalSec: newGoalSec,
        goalLabel: goalLabel.trim() || g.goalLabel,
        goalMilePaceSec: Math.round(newGoalSec / 13.1094),
        splitGoals: parsedSplits,
      }));

      notify(`Saved ${profile.name.split(' ')[0]}'s settings`);
      close();
    } catch (e) {
      error = 'Something went wrong saving. ' + (e instanceof Error ? e.message : '');
    }
  }
</script>

{#if profile && goals}
  <div class="overlay" on:click={(e) => e.target === e.currentTarget && close()} role="presentation">
    <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="rs-title" style="--pc: {profile.color}">
      <button class="x" on:click={close} aria-label="Close">✕</button>
      <div id="rs-title" class="title">{profile.emoji} {profile.name} · Settings</div>
      <p class="lede">Age + gender drive the Stats tab age-group highlight. The mile-checkpoint table tells the coach <em>when</em> the runner should be at each spot.</p>

      <div class="section">
        <div class="sec-title">Identity</div>
        <div class="grid">
          <div class="form-group g-2">
            <label class="form-label" for="rs-name">Display name</label>
            <input id="rs-name" class="form-input" bind:value={name} disabled={profile.fixed} />
          </div>
          <div class="form-group">
            <label class="form-label" for="rs-emoji">Emoji</label>
            <EmojiPicker bind:value={emoji} />
          </div>
          <div class="form-group">
            <label class="form-label" for="rs-color">Color</label>
            <input id="rs-color" class="form-input color" type="color" bind:value={color} />
          </div>

          <div class="form-group">
            <label class="form-label" for="rs-tid">Tracker ID</label>
            <input id="rs-tid" class="form-input mono" bind:value={trackId} disabled={profile.fixed} style="text-transform: uppercase" />
          </div>
          <div class="form-group">
            <label class="form-label" for="rs-age">Age</label>
            <input id="rs-age" class="form-input" type="number" min="5" max="100" bind:value={ageStr} />
          </div>
          <div class="form-group">
            <label class="form-label" for="rs-gender">Gender</label>
            <select id="rs-gender" class="form-input" bind:value={gender}>
              <option value="">—</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
              <option value="X">Non-binary</option>
            </select>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="sec-title">Race goal</div>
        <div class="grid">
          <div class="form-group g-2">
            <label class="form-label" for="rs-goal">Goal time (H:MM:SS)</label>
            <input id="rs-goal" class="form-input mono" bind:value={goalTimeStr} placeholder="1:30:00" />
          </div>
          <div class="form-group g-1">
            <label class="form-label" for="rs-label">Goal label</label>
            <input id="rs-label" class="form-input" bind:value={goalLabel} placeholder="Sub-90" />
          </div>
        </div>
      </div>

      <div class="section">
        <div class="sec-title sec-title-row">
          <span>Target times at each mile</span>
          <button type="button" class="btn btn-sm btn-ghost" on:click={resetSplits}>↻ Recompute from goal</button>
        </div>
        <table class="splits">
          <thead>
            <tr>
              <th>Checkpoint</th>
              <th>Mile</th>
              <th>Target elapsed time</th>
            </tr>
          </thead>
          <tbody>
            {#each splits as s, i (s.label)}
              <tr>
                <td>{s.label}</td>
                <td class="mono">{s.mi.toFixed(s.mi % 1 === 0 ? 0 : 2)}</td>
                <td><input class="form-input mono split-input" bind:value={splits[i].targetStr} placeholder="0:20:30" /></td>
              </tr>
            {/each}
          </tbody>
        </table>
        <div class="hint">Times are cumulative from the start (not splits). For mile 5, type the elapsed time you want when she crosses mile 5 — e.g. <code>0:34:35</code>.</div>
      </div>

      {#if error}<div class="err">⚠ {error}</div>{/if}

      <div class="actions">
        <button class="btn" on:click={save}>Save</button>
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
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .sheet {
    --pc: var(--blue);
    position: relative;
    width: 560px;
    max-width: 100%;
    max-height: 92vh;
    overflow-y: auto;
    background: var(--surface);
    color: var(--text-primary);
    border-radius: var(--radius-lg);
    padding: 22px;
    box-shadow: var(--shadow-lg);
    border-top: 4px solid var(--pc);
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
  .title { font-size: 18px; font-weight: 700; letter-spacing: -0.4px; color: var(--pc); }
  .lede { font-size: 12px; color: var(--text-tertiary); margin: 4px 0 18px; line-height: 1.5; }

  .section { margin-bottom: 18px; }
  .sec-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-tertiary);
    margin-bottom: 8px;
  }
  .sec-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sec-title-row .btn { font-size: 10px; text-transform: none; letter-spacing: 0; }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  }
  .g-1 { grid-column: span 1; }
  .g-2 { grid-column: span 2; }
  .color { padding: 2px; height: 38px; }

  .splits { width: 100%; border-collapse: collapse; font-size: 13px; }
  .splits th {
    text-align: left;
    padding: 6px 8px;
    font-weight: 600;
    color: var(--text-tertiary);
    border-bottom: 1px solid var(--separator-soft);
    font-size: 11px;
  }
  .splits td { padding: 6px 8px; border-bottom: 1px solid var(--separator-soft); }
  .splits td:first-child { font-weight: 600; }
  .splits td:nth-child(2) { color: var(--text-tertiary); }
  .split-input { padding: 4px 8px; max-width: 110px; }
  .hint { font-size: 11px; color: var(--text-tertiary); margin-top: 8px; line-height: 1.4; }
  .hint code { background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 11px; }

  .err {
    font-size: 12px;
    color: var(--red);
    background: rgba(255, 59, 48, 0.08);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    margin: 10px 0;
  }
  .actions { display: flex; gap: 8px; margin-top: 14px; }
  .actions .btn { flex: 1; }

  @media (max-width: 600px) {
    .grid { grid-template-columns: 1fr 1fr; }
    .g-2 { grid-column: span 2; }
  }
</style>
