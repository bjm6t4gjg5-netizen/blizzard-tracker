<script lang="ts">
  import { profiles, runnerState } from '../lib/stores';
  import { formatHMS } from '../lib/format';
  import VenmoButton from './VenmoButton.svelte';

  // Pull each finish time from their state store. Snapshot read — we
  // re-evaluate every time $profiles changes; for race-day this is plenty.
  function snapshot(profs: typeof $profiles) {
    return profs.map(p => {
      const store = runnerState(p.id);
      let elapsed = 0;
      const unsub = store.subscribe(s => (elapsed = s.elapsedSec));
      unsub();
      return { profile: p, elapsedSec: elapsed };
    });
  }
  $: rows = snapshot($profiles);
</script>

<div class="post">
  <div class="banner">
    <div class="confetti" aria-hidden="true">
      {#each Array(20) as _, i}
        <span class="conf c-{i % 6}" style="left: {(i * 7 + 3) % 100}%; animation-delay: {(i * 0.3).toFixed(2)}s"></span>
      {/each}
    </div>

    <div class="eyebrow">⚡ Race day · October 11, 2026 ⚡</div>
    <h1 class="title">Thank you for watching.</h1>
    <p class="sub">Catherine and Helaine left it all on Michigan Avenue. Here's how it played out.</p>

    <div class="results">
      {#each rows as r}
        <div class="result-card" style="--pc: {r.profile.color}">
          <div class="result-name">{r.profile.emoji} {r.profile.name}</div>
          <div class="result-time mono">{formatHMS(r.elapsedSec) || '—'}</div>
          <div class="result-label">finish time</div>
        </div>
      {/each}
    </div>

    <div class="cheers">
      <VenmoButton variant="primary" label="🍺 Buy them a celebration beer" />
    </div>
  </div>

  <div class="next">
    <div class="next-eyebrow">🏆 World Marathon Majors</div>
    <h2 class="next-title">26.2 miles. Mother and daughter. Done.</h2>
    <p class="next-sub">Bank of America Chicago Marathon · Grant Park · October 11, 2026</p>

    <p class="next-note">Brooklyn in the spring, Chicago in the fall — what a year for Team Blizzard. Relive past races anytime in the <strong>Old Races</strong> tab. Next start line: TBD. ⚡</p>
  </div>
</div>

<style>
  .post { display: flex; flex-direction: column; gap: var(--gap-md); }

  .banner {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
    color: white;
    padding: 36px 28px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    text-align: center;
  }
  .eyebrow {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    opacity: 0.85;
  }
  .title {
    font-size: 38px;
    font-weight: 800;
    letter-spacing: -1.2px;
    margin: 10px 0 6px;
    line-height: 1.05;
  }
  .sub {
    font-size: 14px;
    opacity: 0.85;
    margin: 0 0 22px;
  }
  .results {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 22px;
  }
  .result-card {
    --pc: var(--blue);
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: var(--radius);
    padding: 16px 12px;
    backdrop-filter: blur(6px);
  }
  .result-name { font-weight: 700; font-size: 16px; }
  .result-time {
    font-weight: 800;
    font-size: 28px;
    letter-spacing: -0.6px;
    margin: 6px 0 2px;
  }
  .result-label { font-size: 11px; opacity: 0.8; }

  .cheers { display: flex; justify-content: center; }

  /* Confetti */
  .confetti { position: absolute; inset: 0; pointer-events: none; }
  .conf {
    position: absolute;
    top: -10px;
    width: 8px; height: 14px;
    border-radius: 2px;
    opacity: 0;
    animation: confetti-fall 3.5s ease-in infinite;
  }
  .c-0 { background: #FFD60A; }
  .c-1 { background: #FF3B30; }
  .c-2 { background: #34C759; }
  .c-3 { background: #FFFFFF; }
  .c-4 { background: #FF9500; }
  .c-5 { background: #5AC8FA; }
  @keyframes confetti-fall {
    0%   { transform: translateY(0) rotate(0); opacity: 0; }
    10%  { opacity: 1; }
    100% { transform: translateY(420px) rotate(540deg); opacity: 0; }
  }

  /* ─── Chicago card ─── */
  .next {
    background: var(--surface);
    border: 1px solid var(--separator-soft);
    border-radius: var(--radius);
    padding: 28px;
    box-shadow: var(--shadow-sm);
    text-align: center;
  }
  .next-eyebrow {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--orange);
  }
  .next-title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.8px;
    margin: 8px 0 4px;
    color: var(--text-primary);
  }
  .next-sub {
    font-size: 13px;
    color: var(--text-tertiary);
    margin: 0 0 22px;
  }
  .cd {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 18px;
  }
  .cd-unit {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 64px;
    background: linear-gradient(180deg, var(--surface), var(--surface-2));
    border: 1px solid var(--separator-soft);
    border-radius: var(--radius-sm);
    padding: 10px 8px;
  }
  .cd-num {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    font-size: 32px;
    color: var(--text-primary);
    letter-spacing: -1px;
    line-height: 1;
  }
  .cd-lbl {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }
  .cd-sep {
    font-family: var(--font-mono);
    font-weight: 800;
    font-size: 24px;
    color: var(--text-muted);
    line-height: 1;
  }
  .next-note { font-size: 12px; color: var(--text-tertiary); margin: 0; }

  @media (max-width: 540px) {
    .banner { padding: 24px 18px; }
    .title  { font-size: 28px; }
    .result-time { font-size: 22px; }
    .next   { padding: 22px 16px; }
    .next-title { font-size: 22px; }
    .cd-num { font-size: 24px; }
    .cd-unit { min-width: 50px; padding: 8px 6px; }
  }
</style>
