import { describe, it, expect } from 'vitest';
import finisherHtml from './fixtures/mika-2025-finisher.html?raw';
import preHtml from './fixtures/mika-2026-pre.html?raw';
import midHtml from './fixtures/mika-2026-midrace.html?raw';
import searchHtml from './fixtures/mika-2026-search.html?raw';
import {
  parseMikaDetail, parseIdpFromSearch, splitLabelToMiles, hmsToSec, localClockToEpoch,
} from '../lib/tracking/mika';
import { CURRENT_RACE, waveStart, waveOffsetMin } from '../lib/races';
import { DEFAULT_GOALS, DEFAULT_PROFILES } from '../lib/runners';

// Fixtures: structure captured live from results.chicagomarathon.com on
// race morning 2026 (pre-race page + search) and the 2025 results archive
// (finisher page). Mid-race page = the 2026 template with splits filled in.
const FIXTURES: Record<string, string> = {
  'mika-2025-finisher.html': finisherHtml,
  'mika-2026-pre.html': preHtml,
  'mika-2026-midrace.html': midHtml,
  'mika-2026-search.html': searchHtml,
};
const fx = (n: string) => FIXTURES[n];

const OPTS = {
  raceDate: '2026-10-11',
  tz: 'America/Chicago',
  totalMi: 26.2188,
  fallbackPaceSec: 412,
};

describe('mika helpers', () => {
  it('maps split labels to course miles', () => {
    expect(splitLabelToMiles('05K', 26.2188)).toBeCloseTo(3.107, 2);
    expect(splitLabelToMiles('40K', 26.2188)).toBeCloseTo(24.855, 2);
    expect(splitLabelToMiles('HALF', 26.2188)).toBeCloseTo(13.109, 2);
    expect(splitLabelToMiles('Mile 25.2', 26.2188)).toBe(25.2);
    expect(splitLabelToMiles('Finish', 26.2188)).toBe(26.2188);
    expect(splitLabelToMiles('Start', 26.2188)).toBeNull();
  });
  it('parses times and rejects placeholders', () => {
    expect(hmsToSec('04:33:11')).toBe(16391);
    expect(hmsToSec('28:00')).toBe(1680);
    expect(hmsToSec('–')).toBeNull();
    expect(hmsToSec('00:00')).toBeNull();
  });
  it('anchors a CT wall-clock start to the right instant (CDT = UTC-5)', () => {
    const ms = localClockToEpoch('2026-10-11', '07:37:12', 'America/Chicago')!;
    expect(new Date(ms).toISOString()).toBe('2026-10-11T12:37:12.000Z');
  });
  it('extracts idp from a bib search page', () => {
    expect(parseIdpFromSearch(fx('mika-2026-search.html'))).toBe('2EFG96382DE1C0');
    expect(parseIdpFromSearch('<p>No results</p>')).toBeNull();
  });
});

describe('parseMikaDetail', () => {
  it('race morning: pre, no distance', () => {
    const p = parseMikaDetail(fx('mika-2026-pre.html'), { ...OPTS, nowMs: Date.parse('2026-10-11T10:00:00Z') });
    expect(p.status).toBe('pre');
    expect(p.distMi).toBeNull();
    expect(p.elapsedSec).toBeNull();
    expect(p.bib).toBe('15749');
    expect(p.rows).toHaveLength(17);
  });

  it('finisher (2025 archive format): finished, chip time, all splits', () => {
    const p = parseMikaDetail(fx('mika-2025-finisher.html'), OPTS);
    expect(p.status).toBe('finished');
    expect(p.elapsedSec).toBe(4 * 3600 + 33 * 60 + 11);
    expect(p.distMi).toBeCloseTo(26.2188, 3);
    expect(p.splits.map(s => s.label)).toEqual(
      ['05K', '10K', '15K', '20K', 'HALF', '25K', '30K', '35K', '40K', 'Finish']);
    expect(p.splits[0].pace).toBe('09:01 /mi');
  });

  it('mid-race: elapsed from start mat, position extrapolated past HALF', () => {
    // Crossed the start at 07:37:12 CT; now is 09:10:12 CT → 1:33:00 elapsed.
    const nowMs = Date.parse('2026-10-11T14:10:12Z');
    const p = parseMikaDetail(fx('mika-2026-midrace.html'), { ...OPTS, nowMs });
    expect(p.status).toBe('running');
    expect(p.elapsedSec).toBe(93 * 60);
    expect(p.lastSplit).toBeNull();
    // HALF at 1:29:40; 3:20 later at ~6:51/mi → ~13.6 mi.
    expect(p.distMi!).toBeGreaterThan(13.4);
    expect(p.distMi!).toBeLessThan(13.8);
    expect(p.estimated).toBe(true);
    expect(p.predictedFinishSec).toBe(2 * 3600 + 59 * 60 + 30);
  });

  it('LIVE BUG: future mats pre-filled as "estimated" (incl. Finish) are not crossings', () => {
    // Exact row shapes captured from Catherine's page at ~8:10 CT race day.
    const row = (cls: string, label: string, t: string) =>
      `<tr class="${cls}" > <th class="desc" >${label}</th> <td class="time_day">x</td> <td class="time">${t}</td> <td class="diff">-</td> <td class="min_mile right opt colgroup-splits colgroup-splits-imperial">06:58</td> </tr>`;
    const html = `<div class="detail-box box-other"><table><tbody><tr class=" f-starttime_net"><th class="desc">Start Time</th><td class="f-starttime_net last">07:41:57</td></tr></tbody></table></div>
<div class="detail-box box-totals"><table><tbody><tr><th class="desc">Finish Time</th><td class="f-time_finish_netto last">&ndash;</td></tr></tbody></table></div>
<div class="detail-box box-state"><table><tbody><tr><th class="desc">Race Status</th><td class="f-__race_status last">Started</td></tr><tr><th class="desc">Last Split</th><td class="f-__last_split_name last">05K</td></tr><tr><th class="desc">Pred. Finish</th><td class="f-__estimated_finish last">03:02:25</td></tr></tbody></table></div>
<div class="detail-box box-splits"><table><thead><tr><th>Split</th></tr></thead><tbody>
${row(' f-time_05 highlight', '05K', '00:21:37')}
${row('list-highlight f-time_10 estimated text-muted', '10K <strong>*</strong>', '00:43:14')}
${row(' f-time_52 estimated text-muted', 'HALF <strong>*</strong>', '01:31:13')}
${row(' f-time_finish_netto estimated text-muted', 'Finish <strong>*</strong>', '03:02:25')}
</tbody></table></div>`;
    const nowMs = Date.parse('2026-10-11T13:10:00Z'); // 8:10 CT, 28:03 elapsed
    const p = parseMikaDetail(html, { ...OPTS, nowMs });
    expect(p.status).toBe('running');
    expect(p.elapsedSec).toBe(28 * 60 + 3);
    expect(p.splits.map(s => s.label)).toEqual(['05K']);
    expect(p.rows.find(r => r.label === 'Finish')!.sec).toBeNull();
    expect(p.distMi!).toBeGreaterThan(3.1);
    expect(p.distMi!).toBeLessThan(6.2);
    expect(p.predictedFinishSec).toBe(3 * 3600 + 2 * 60 + 25);
  });

  it('never projects past the next timing mat', () => {
    // Two hours after HALF with no new split → capped just before 25K.
    const nowMs = Date.parse('2026-10-11T16:10:12Z');
    const p = parseMikaDetail(fx('mika-2026-midrace.html'), { ...OPTS, nowMs });
    expect(p.distMi!).toBeLessThan(25 * 0.621371);
    expect(p.distMi!).toBeGreaterThan(15.4);
  });

  it('live 2026 morning page: "not started" status + &ndash; entities read as empty', () => {
    // Exactly what the relay returned for both bibs at ~6:00 CT on race day.
    const html = fx('mika-2026-pre.html')
      .replace(/(<td class="f-__race_status last">)<span class="text-muted">–<\/span>/, '$1not started')
      .replace(/<span class="text-muted">–<\/span>/g, '&ndash;');
    const p = parseMikaDetail(html, { ...OPTS, nowMs: Date.parse('2026-10-11T11:00:00Z') });
    expect(p.status).toBe('pre');
    expect(p.lastSplit).toBeNull();
    expect(p.startEpochMs).toBeNull();
    expect(p.rows.every(r => r.sec === null)).toBe(true);
  });

  it('started but before the first mat: falls back to goal pace', () => {
    const html = fx('mika-2026-pre.html').replace(
      /(<td class="f-starttime_net last">)<span class="text-muted">–<\/span>/, '$107:37:12');
    const nowMs = Date.parse('2026-10-11T12:47:12Z'); // 10 min after start
    const p = parseMikaDetail(html, { ...OPTS, nowMs });
    expect(p.status).toBe('running');
    expect(p.elapsedSec).toBe(600);
    expect(p.distMi!).toBeCloseTo(600 / 412, 2);
  });
});

describe('race registry', () => {
  it('Chicago 2026 waves resolve to 7:35 / 8:00 / 8:35 CT', () => {
    expect(waveStart(CURRENT_RACE, 1).toISOString()).toBe('2026-10-11T12:35:00.000Z');
    expect(waveStart(CURRENT_RACE, 2).toISOString()).toBe('2026-10-11T13:00:00.000Z');
    expect(waveStart(CURRENT_RACE, 3).toISOString()).toBe('2026-10-11T13:35:00.000Z');
    expect(waveOffsetMin(CURRENT_RACE, 1)).toBe(5);
    expect(waveOffsetMin(CURRENT_RACE, 3)).toBe(65);
  });
  it('anchored runners carry their Chicago bibs', () => {
    expect(DEFAULT_PROFILES.find(p => p.id === 'gf')!.trackId).toBe('15749');
    expect(DEFAULT_PROFILES.find(p => p.id === 'mom')!.trackId).toBe('36364');
  });
  it('goal splits are increasing and end exactly on the goal (both PRs)', () => {
    for (const id of ['gf', 'mom']) {
      const g = DEFAULT_GOALS[id];
      const secs = g.splitGoals!.map(s => s.targetSec);
      for (let i = 1; i < secs.length; i++) expect(secs[i]).toBeGreaterThan(secs[i - 1]);
      expect(secs.at(-1)).toBe(g.goalSec);
    }
    expect(DEFAULT_GOALS.gf.goalSec).toBeLessThan(3 * 3600);
    expect(DEFAULT_GOALS.mom.goalSec).toBeLessThan(3 * 3600 + 40 * 60 + 41);
  });
});

import { applySnapshot, makeRunnerState } from '../lib/runners';
describe('recovery from a false finish', () => {
  it('finished → running snapshot restores live elapsed and trims bogus trace', () => {
    const s0 = makeRunnerState(DEFAULT_PROFILES[0]);
    const bad = { ...s0, status: 'finished' as const, distMi: 26.2188, elapsedSec: 10945,
      paceHistory: [{ mi: 3.107, elapsedSec: 1297 }, { mi: 26.2188, elapsedSec: 10945 }] };
    const fixed = applySnapshot(bad, { status: 'running', distMi: 4.0, elapsedSec: 1700, splits: [],
      fetchedAt: 0, source: 'mika·est', anchor: { mi: 3.107, elapsedSec: 1297 } });
    expect(fixed.status).toBe('running');
    expect(fixed.elapsedSec).toBe(1700);
    expect(fixed.distMi).toBeCloseTo(4.0);
    expect(fixed.paceHistory.map(h => h.mi)).toEqual([3.107]);
  });
});
