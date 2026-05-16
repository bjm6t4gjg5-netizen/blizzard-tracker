import { describe, it, expect } from 'vitest';
import { parseSplitsResponse } from '../lib/rtrt';
import { TOTAL_MI } from '../lib/time';

// Fixtures are abridged from real api.rtrt.me responses captured live on
// race morning (May 16, 2026) from the 2026 RBC Brooklyn Half tracker.

const PRE_RACE: any = {
  error: { type: 'no_results', msg: 'No splits found' },
  info: {
    loc: {
      RMGBEVSK: {
        pending: { halfmarathon: { countdown: '872', wavestart: '1778929260' } },
        course: 'halfmarathon',
        wavestart: '1778929260',
      },
      RRM2PLD3: {
        pending: { halfmarathon: { countdown: '872', wavestart: '1778929260' } },
        course: 'halfmarathon',
        wavestart: '1778929260',
      },
    },
  },
};

const RUNNING: any = {
  list: [
    { pid: 'RMGBEVSK', label: '5K',  time: '00:20:55', etime: '00:20:55', pace: '06:45 /mi', dist: '3.1',  units: 'mi' },
    { pid: 'RMGBEVSK', label: '10K', time: '00:42:18', etime: '00:42:18', pace: '06:48 /mi', dist: '6.2',  units: 'mi' },
    { pid: 'RRM2PLD3', label: '5K',  time: '00:25:30', etime: '00:25:30', pace: '08:14 /mi', dist: '3.1',  units: 'mi' },
  ],
  info: {},
};

const FINISHED: any = {
  list: [
    { pid: 'RMGBEVSK', label: '5K',     time: '00:20:30', etime: '00:20:30', pace: '06:35 /mi', dist: '3.1',   units: 'mi' },
    { pid: 'RMGBEVSK', label: '10K',    time: '00:41:15', etime: '00:41:15', pace: '06:38 /mi', dist: '6.2',   units: 'mi' },
    { pid: 'RMGBEVSK', label: 'Finish', time: '01:28:12', etime: '01:28:12', pace: '06:44 /mi', dist: '13.10', units: 'mi' },
  ],
  info: {},
};

// Real on-course response captured race morning: Catherine has crossed
// START but hasn't hit the 5K mat yet. Helaine's wave still pending.
const ON_COURSE_BEFORE_5K: any = {
  list: [
    {
      time: '00:00:00.00', point: 'START', label: 'START',
      pid: 'RMGBEVSK', bib: '2784', name: 'Catherine Blizzard',
      epochTime: '1778929371.00', startTime: '7:02:51 am',
      isStart: '1', course: 'halfmarathon',
    },
  ],
  info: {
    loc: {
      RMGBEVSK: {
        pace: '06:45 min/mile',
        paceAvg: '06:45 min/mile',
        emiles: '0.316',
        mph: '8.89',
        lpn: 'START',
        npn: '5K',
        course: 'halfmarathon',
        wavestart: '1778929208.55',
      },
      RRM2PLD3: {
        pending: { halfmarathon: { countdown: '0', wavestart: '1778929208.55' } },
        course: 'halfmarathon',
        wavestart: '1778929208.55',
      },
    },
  },
};

const NOISE: any = { info: {} };

describe('parseSplitsResponse', () => {
  it('detects pre-race from no_results + pending wavestart', () => {
    const p = parseSplitsResponse(PRE_RACE, 'RMGBEVSK');
    expect(p.status).toBe('pre');
    expect(p.distMi).toBeNull();
    expect(p.elapsedSec).toBeNull();
    expect(p.splits).toHaveLength(0);
  });

  it('detects an active runner from a list of splits', () => {
    const p = parseSplitsResponse(RUNNING, 'RMGBEVSK');
    expect(p.status).toBe('running');
    expect(p.distMi).toBeCloseTo(6.2, 1);
    expect(p.elapsedSec).toBe(42 * 60 + 18);
  });

  it('only counts splits belonging to the requested pid', () => {
    // Catherine and Helaine both in the list — Helaine's 5K mustn't affect Catherine.
    const p = parseSplitsResponse(RUNNING, 'RMGBEVSK');
    expect(p.splits.every(s => /5K|10K/.test(s.label))).toBe(true);
    expect(p.splits.length).toBe(2); // not 3
  });

  it('extracts the 5K split row with pace', () => {
    const p = parseSplitsResponse(RUNNING, 'RMGBEVSK');
    const fivek = p.splits.find(s => s.label === '5K');
    expect(fivek?.chipTime).toBe('00:20:55');
    expect(fivek?.pace).toContain('6:45');
  });

  it('detects FINISHED when a Finish row is present', () => {
    const p = parseSplitsResponse(FINISHED, 'RMGBEVSK');
    expect(p.status).toBe('finished');
    expect(p.distMi).toBeCloseTo(TOTAL_MI, 2);
    expect(p.elapsedSec).toBe(1 * 3600 + 28 * 60 + 12);
  });

  it('returns unknown / null on an empty payload', () => {
    const p = parseSplitsResponse(NOISE, 'RMGBEVSK');
    expect(p.status).toBe('unknown');
    expect(p.distMi).toBeNull();
    expect(p.elapsedSec).toBeNull();
  });

  it('rejects HH:MM:SS values above 6 hours as wall-clock noise', () => {
    const data: any = { list: [{ pid: 'X', label: '10K', time: '14:32:55', dist: '6.2', units: 'mi' }] };
    const p = parseSplitsResponse(data, 'X');
    expect(p.elapsedSec).toBeNull();
  });

  // ── Real-world live API shape ─────────────────────────────────────────
  // When a runner is ON course but hasn't hit the next checkpoint yet,
  // RTRT carries the live position in info.loc[pid] (emiles, pace,
  // wavestart) and `list` contains only a START row with time "00:00:00.00".

  it('reads live emiles when only START has been crossed (Catherine)', () => {
    // Pin "now" 30s after she crossed her START mat.
    const nowSec = 1778929371 + 30;
    const p = parseSplitsResponse(ON_COURSE_BEFORE_5K, 'RMGBEVSK', nowSec);
    expect(p.status).toBe('running');
    expect(p.distMi).toBeCloseTo(0.316, 2);
    expect(p.elapsedSec).toBe(30);
  });

  it('hides the START crossing from user-visible splits', () => {
    const nowSec = 1778929371 + 30;
    const p = parseSplitsResponse(ON_COURSE_BEFORE_5K, 'RMGBEVSK', nowSec);
    expect(p.splits.find(s => /start/i.test(s.label))).toBeUndefined();
  });

  it('keeps a pending runner on pre even when sibling is live (Helaine)', () => {
    const nowSec = 1778929371 + 30;
    const p = parseSplitsResponse(ON_COURSE_BEFORE_5K, 'RRM2PLD3', nowSec);
    expect(p.status).toBe('pre');
    expect(p.distMi).toBeNull();
    expect(p.elapsedSec).toBeNull();
  });

  it('tolerates fractional-second time formats like 00:00:00.00', () => {
    const data: any = {
      list: [{ pid: 'X', label: 'START', point: 'START', time: '00:00:00.00', epochTime: '1000' }],
      info: { loc: { X: { emiles: '0.5', wavestart: '1000', course: 'halfmarathon' } } },
    };
    const p = parseSplitsResponse(data, 'X', 1060);
    expect(p.status).toBe('running');
    expect(p.distMi).toBeCloseTo(0.5, 2);
    expect(p.elapsedSec).toBe(60);
  });
});
