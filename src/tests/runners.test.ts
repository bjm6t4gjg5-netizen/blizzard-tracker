import { describe, it, expect } from 'vitest';
import {
  buildPaceProfile, flatPaceForGoal, buildGoalSplits,
  computeEta, makeRunnerState, applySnapshot,
  DEFAULT_PROFILES, DEFAULT_GOALS,
} from '../lib/runners';
import { TOTAL_MI } from '../lib/time';

describe('buildPaceProfile', () => {
  it('starts at 0 and ends at TOTAL_MI', () => {
    const p = buildPaceProfile(420);
    expect(p[0]).toEqual({ mi: 0, sec: 0 });
    expect(p[p.length - 1].mi).toBeCloseTo(TOTAL_MI, 2);
  });
  it('faster flat pace yields shorter total time', () => {
    const fast = buildPaceProfile(360); // 6:00/mi
    const slow = buildPaceProfile(540); // 9:00/mi
    const ft = fast[fast.length - 1].sec;
    const st = slow[slow.length - 1].sec;
    expect(ft).toBeLessThan(st);
    expect(ft).toBeGreaterThan(13.0 * 360 - 60);
  });
  it('cumulative time strictly increasing', () => {
    const p = buildPaceProfile(420);
    for (let i = 1; i < p.length; i++) {
      expect(p[i].sec).toBeGreaterThan(p[i - 1].sec);
    }
  });
});

describe('flatPaceForGoal', () => {
  it('Sub-90 needs ~6:50/mi flat-equivalent', () => {
    const p = flatPaceForGoal(90 * 60);
    expect(p).toBeGreaterThan(390);
    expect(p).toBeLessThan(425);
  });
  it('Sub-2:10 needs ~9:55/mi flat-equivalent', () => {
    const p = flatPaceForGoal(130 * 60);
    expect(p).toBeGreaterThan(580);
    expect(p).toBeLessThan(605);
  });
  it('total time of computed profile lands within 5sec of the goal', () => {
    for (const goalSec of [4800, 5400, 6300, 7200, 9000]) {
      const flat = flatPaceForGoal(goalSec);
      const total = buildPaceProfile(flat).at(-1)!.sec;
      expect(Math.abs(total - goalSec)).toBeLessThan(5);
    }
  });
});

describe('buildGoalSplits', () => {
  it('Sub-90 splits land where Catherine plans (mile 3 + finish)', () => {
    const splits = buildGoalSplits(90 * 60);
    const mile3 = splits.find(s => s.label === 'Mile 3')!;
    const finish = splits.find(s => s.label === 'Finish')!;
    expect(mile3.targetSec).toBeGreaterThan(19 * 60);
    expect(mile3.targetSec).toBeLessThan(22 * 60);
    expect(finish.targetSec).toBe(90 * 60);
  });
  it('returns the requested split miles in order', () => {
    const splits = buildGoalSplits(90 * 60);
    expect(splits.map(s => s.mi)).toEqual([1, 3, 5, 7, 10, expect.closeTo(13.1, 1)]);
  });
});

describe('computeEta', () => {
  it('null when distance too small', () => {
    const s = makeRunnerState(DEFAULT_PROFILES[0]);
    s.distMi = 0.2;
    s.elapsedSec = 90;
    const r = computeEta(s);
    expect(r.etaSec).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it('finished returns elapsedSec', () => {
    const s = makeRunnerState(DEFAULT_PROFILES[0]);
    s.status = 'finished';
    s.distMi = 13.1;
    s.elapsedSec = 5400;
    const r = computeEta(s);
    expect(r.etaSec).toBe(5400);
    expect(r.confidence).toBe(100);
  });

  it('mid-race ETA is sane: 6:50 pace at mile 6 → ~90min finish', () => {
    const s = makeRunnerState(DEFAULT_PROFILES[0]);
    s.distMi = 6.214; // 10K
    s.elapsedSec = 6.214 * 410; // ~6:50/mi
    s.status = 'running';
    const r = computeEta(s);
    expect(r.etaSec).toBeGreaterThan(85 * 60);
    expect(r.etaSec).toBeLessThan(95 * 60);
    expect(r.confidence).toBeGreaterThan(40);
  });

  it('confidence rises with progress', () => {
    const s1 = makeRunnerState(DEFAULT_PROFILES[0]);
    s1.distMi = 2; s1.elapsedSec = 13 * 60; s1.status = 'running';
    const s2 = makeRunnerState(DEFAULT_PROFILES[0]);
    s2.distMi = 10; s2.elapsedSec = 65 * 60; s2.status = 'running';
    expect(computeEta(s2).confidence).toBeGreaterThan(computeEta(s1).confidence);
  });
});

describe('applySnapshot', () => {
  it('appends to paceHistory only on real progress', () => {
    const profile = DEFAULT_PROFILES[0];
    let s = makeRunnerState(profile);
    s = applySnapshot(s, {
      status: 'running', distMi: 1, elapsedSec: 360,
      splits: [], fetchedAt: 1, source: 'test',
    });
    expect(s.paceHistory).toHaveLength(1);
    // Same data — should not duplicate
    s = applySnapshot(s, {
      status: 'running', distMi: 1, elapsedSec: 360,
      splits: [], fetchedAt: 2, source: 'test',
    });
    expect(s.paceHistory).toHaveLength(1);
    // Real progress
    s = applySnapshot(s, {
      status: 'running', distMi: 2.5, elapsedSec: 900,
      splits: [], fetchedAt: 3, source: 'test',
    });
    expect(s.paceHistory).toHaveLength(2);
  });

  it("'unknown' status doesn't blow away a known status", () => {
    const profile = DEFAULT_PROFILES[0];
    let s = makeRunnerState(profile);
    s = applySnapshot(s, {
      status: 'running', distMi: 5, elapsedSec: 1800,
      splits: [], fetchedAt: 1, source: 'test',
    });
    s = applySnapshot(s, {
      status: 'unknown', distMi: 5, elapsedSec: 1800,
      splits: [], fetchedAt: 2, source: 'test',
    });
    expect(s.status).toBe('running');
  });
});
