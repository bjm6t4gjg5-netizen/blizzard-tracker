// ============================================================
// check-live.ts — print exactly what the app sees for each runner,
// using the app's real parser + the results relay.
//
//   RELAY=https://blizzard-results.<you>.workers.dev npx vite-node scripts/check-live.ts
//
// Re-run any time on race day; output changes as they cross mats.
// ============================================================
import { CURRENT_RACE } from '../src/lib/races';
import { DEFAULT_GOALS } from '../src/lib/runners';
import { fetchMikaRunner } from '../src/lib/tracking/mika';

const relay = process.env.RELAY;
if (!relay) { console.error('Set RELAY=https://blizzard-results.<you>.workers.dev'); process.exit(1); }
// The client reads the relay from localStorage.resultsProxy in the browser.
(globalThis as any).localStorage = {
  getItem: (k: string) => (k === 'resultsProxy' ? relay : null),
  setItem: () => {},
};

const t = CURRENT_RACE.tracking;
if (t.type !== 'mika') { console.error('Current race is not a mika race'); process.exit(1); }

const fmt = (s: number | null) => s == null ? '—'
  : `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

for (const [id, bib] of Object.entries(CURRENT_RACE.bibs)) {
  const goal = DEFAULT_GOALS[id]?.goalSec ?? 14400;
  const r = await fetchMikaRunner(t.base, t.event, bib, {
    raceDate: CURRENT_RACE.date, tz: CURRENT_RACE.tz, totalMi: CURRENT_RACE.distanceMi,
    fallbackPaceSec: goal / CURRENT_RACE.distanceMi,
  });
  console.log(`\n── ${id} · bib ${bib} ─────────────────────────`);
  if (!r) { console.log('  ✗ no data (relay down or bib not found)'); continue; }
  console.log(`  name       ${r.name}`);
  console.log(`  status     ${r.status}${r.estimated ? ' (position estimated between mats)' : ''}`);
  console.log(`  started    ${r.startEpochMs ? new Date(r.startEpochMs).toLocaleTimeString('en-US', { timeZone: CURRENT_RACE.tz }) + ' CT' : '—'}`);
  console.log(`  elapsed    ${fmt(r.elapsedSec)}`);
  console.log(`  distance   ${r.distMi == null ? '—' : r.distMi.toFixed(2) + ' mi'}`);
  console.log(`  last mat   ${r.lastSplit ?? '—'}`);
  console.log(`  pred. fin  ${fmt(r.predictedFinishSec)} (official)`);
  console.log(`  finish     ${fmt(r.finishSec)}`);
  const reached = r.rows.filter(x => x.sec != null);
  console.log(`  splits     ${reached.length ? reached.map(x => `${x.label} ${fmt(x.sec)}`).join(' · ') : 'none yet'} (${r.rows.length} mats on course)`);
}
