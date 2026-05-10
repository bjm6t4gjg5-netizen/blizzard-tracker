<script lang="ts">
  import { runnerSettingsFor, profiles, goalsStore, updateRunner, notify } from '../lib/stores';
  import { parseGoalTime, formatHMS, formatHMSFull } from '../lib/format';
  import { buildGoalSplits, ageFromDob, type SplitGoal } from '../lib/runners';
  import { RACE_START } from '../lib/time';
  import EmojiPicker from './EmojiPicker.svelte';

  $: editingId = $runnerSettingsFor;
  $: profile = editingId ? $profiles.find(p => p.id === editingId) ?? null : null;
  $: goals = editingId ? goalsStore(editingId) : null;

  // Local form state, rehydrated whenever editingId changes.
  let name = '';
  let trackId = '';
  let emoji = '🏃';
  let color = '#007AFF';
  let dob = '';
  let gender: 'F' | 'M' | '' = '';
  let heightFt = '';
  let heightInRem = '';
  let weightLbStr = '';
  let wave: number | '' = '';
  let corral = '';
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
      dob = profile.dob ?? '';
      gender = (profile.gender as 'F' | 'M' | undefined) ?? '';
      if (profile.heightIn != null) {
        heightFt = String(Math.floor(profile.heightIn / 12));
        heightInRem = String(profile.heightIn % 12);
      } else { heightFt = ''; heightInRem = ''; }
      weightLbStr = profile.weightLb != null ? String(profile.weightLb) : '';
      wave = profile.wave ?? '';
      corral = profile.corral ?? '';
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

  // Live-compute the runner's age on race day from the DOB picker, so the
  // user sees "Age 28 on race day" while they're editing.
  $: ageOnRace = ageFromDob(dob, RACE_START);

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

      // DOB validation
      let dobOut: string | undefined;
      if (dob.trim()) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
          error = 'Date of birth must be YYYY-MM-DD.';
          return;
        }
        const computed = ageFromDob(dob.trim(), RACE_START);
        if (computed == null || computed < 5 || computed > 110) {
          error = `Date of birth doesn't make sense (computed age ${computed ?? '?'}).`;
          return;
        }
        dobOut = dob.trim();
      }

      // Height — combine feet + inches
      let heightOut: number | undefined;
      const ftN = heightFt.trim() ? parseInt(heightFt.trim(), 10) : 0;
      const inN = heightInRem.trim() ? parseInt(heightInRem.trim(), 10) : 0;
      if (heightFt.trim() || heightInRem.trim()) {
        if (!Number.isFinite(ftN) || !Number.isFinite(inN) || ftN < 0 || ftN > 8 || inN < 0 || inN > 11) {
          error = 'Height must be 0–8 ft and 0–11 in.';
          return;
        }
        heightOut = ftN * 12 + inN;
        if (heightOut < 30 || heightOut > 96) {
          error = 'Height seems off — should be roughly 2.5 to 8 feet total.';
          return;
        }
      }

      // Weight
      let weightOut: number | undefined;
      if (weightLbStr.trim()) {
        const wN = parseFloat(weightLbStr.trim());
        if (!Number.isFinite(wN) || wN < 40 || wN > 500) {
          error = 'Weight should be 40–500 lb.';
          return;
        }
        weightOut = Math.round(wN);
      }

      // Wave + corral validation
      let waveOut: 1 | 2 | 3 | 4 | undefined;
      if (wave !== '' && wave != null) {
        const w = Number(wave);
        if (![1, 2, 3, 4].includes(w)) {
          error = 'Wave must be 1, 2, 3, or 4.';
          return;
        }
        waveOut = w as 1 | 2 | 3 | 4;
      }
      const corralOut = corral.trim().toUpperCase().slice(0, 1) || undefined;
      if (corralOut && !/^[A-Z]$/.test(corralOut)) {
        error = 'Corral must be a single letter (A–Z).';
        return;
      }

      // Persist profile fields
      const profilePatch: Partial<Parameters<typeof updateRunner>[1]> = {
        emoji: (emoji ?? '').trim().slice(0, 4) || profile.emoji,
        color,
        dob: dobOut,
        gender: gender || undefined,
        heightIn: heightOut,
        weightLb: weightOut,
        wave: waveOut,
        corral: corralOut,
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
            <label class="form-label" for="rs-dob">Date of birth</label>
            <input id="rs-dob" class="form-input" type="date" bind:value={dob} />
            {#if ageOnRace != null}
              <div class="form-hint mono">Age {ageOnRace} on race day · May 16, 2026</div>
            {/if}
          </div>
          <div class="form-group">
            <label class="form-label" for="rs-gender">Gender</label>
            <select id="rs-gender" class="form-input" bind:value={gender}>
              <option value="">—</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </div>
        </div>

        <div class="grid">
          <div class="form-group g-2">
            <label class="form-label" for="rs-ht-ft">Height</label>
            <div class="ht-row" id="rs-ht-ft">
              <input class="form-input ht" type="number" min="0" max="8" bind:value={heightFt} placeholder="5" />
              <span class="ht-unit">ft</span>
              <input class="form-input ht" type="number" min="0" max="11" bind:value={heightInRem} placeholder="5" />
              <span class="ht-unit">in</span>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="rs-weight">Weight (lb)</label>
            <input id="rs-weight" class="form-input" type="number" min="40" max="500" bind:value={weightLbStr} placeholder="125" />
          </div>
        </div>
      </div>

      <div class="section">
        <div class="sec-title">Start wave</div>
        <p class="sec-sub">Each wave goes off at a different time. Pick the wave + corral from the runner's RBC bib confirmation. Wave 1 = 7:00 AM, Wave 2 = 7:25 AM, Wave 3 = 7:50 AM, Wave 4 = 8:15 AM. Calendar export and arrival ETAs use this.</p>
        <div class="grid">
          <div class="form-group">
            <label class="form-label" for="rs-wave">Wave</label>
            <select id="rs-wave" class="form-input" bind:value={wave}>
              <option value="">—</option>
              <option value={1}>1 · 7:00 AM</option>
              <option value={2}>2 · 7:25 AM</option>
              <option value={3}>3 · 7:50 AM</option>
              <option value={4}>4 · 8:15 AM</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="rs-corral">Corral</label>
            <select id="rs-corral" class="form-input" bind:value={corral}>
              <option value="">—</option>
              {#each ['A','B','C','D','E','F'] as c}<option value={c}>{c}</option>{/each}
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
  .sec-sub {
    font-size: 11.5px;
    color: var(--text-tertiary);
    line-height: 1.5;
    margin: 0 0 10px;
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
  .form-hint {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }
  .ht-row { display: flex; align-items: center; gap: 6px; }
  .ht { max-width: 70px; }
  .ht-unit { font-size: 13px; color: var(--text-tertiary); font-weight: 600; }

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
