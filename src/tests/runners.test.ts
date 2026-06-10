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
    expect(ft).toBeGreaterThan(26.0 * 360 - 60);
  });
  it('cumulative time strictly increasing', () => {
    const p = buildPaceProfile(420);
    for (let i = 1; i < p.length; i++) {
      expect(p[i].sec).toBeGreaterThan(p[i - 1].sec);
    }
  });
});

describe('flatPaceForGoal', () => {
  it('Sub-3:05 needs ~6:55–7:05/mi flat-equivalent', () => {
    const p = flatPaceForGoal(185 * 60);
    expect(p).toBeGreaterThan(395);
    expect(p).toBeLessThan(430);
  });
  it('Sub-4:00 needs ~9:00/mi flat-equivalent', () => {
    const p = flatPaceForGoal(240 * 60);
    expect(p).toBeGreaterThan(515);
    expect(p).toBeLessThan(555);
  });
  it('total time of computed profile lands within 5sec of the goal', () => {
    for (const goalSec of [11_100, 12_600, 14_400, 16_200, 18_000]) {
      const flat = flatPaceForGoal(goalSec);
      const total = buildPaceProfile(flat).at(-1)!.sec;
      expect(Math.abs(total - goalSec)).toBeLessThan(5);
    }
  });
});

describe('buildGoalSplits', () => {
  it('Sub-3:05 splits land where Catherine plans (mile 5 + finish)', () => {
    const splits = buildGoalSplits(185 * 60);
    const mile5 = splits.find(s => s.label === 'Mile 5')!;
    const finish = splits.find(s => s.label === 'Finish')!;
    expect(mile5.targetSec).toBeGreaterThan(33 * 60);
    expect(mile5.targetSec).toBeLessThan(38 * 60);
    expect(finish.targetSec).toBe(185 * 60);
  });
  it('returns the requested split miles in order', () => {
    const splits = buildGoalSplits(185 * 60);
    expect(splits.map(s => s.mi)).toEqual([
      1, 5, 10, expect.closeTo(13.1, 1), 18, 22, expect.closeTo(26.2, 1),
    ]);
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
    s.distMi = 26.22;
    s.elapsedSec = 11_100;
    const r = computeEta(s);
    expect(r.etaSec).toBe(11_100);
    expect(r.confidence).toBe(100);
  });

  it('mid-race ETA is sane: 7:05 pace at mile 10 → ~3:00–3:15 finish', () => {
    const s = makeRunnerState(DEFAULT_PROFILES[0]);
    s.distMi = 10;
    s.elapsedSec = 10 * 425; // ~7:05/mi
    s.status = 'running';
    const r = computeEta(s);
    expect(r.etaSec).toBeGreaterThan(178 * 60);
    expect(r.etaSec).toBeLessThan(196 * 60);
    expect(r.confidence).toBeGreaterThan(40);
  });

  it('confidence rises with progress', () => {
    const s1 = makeRunnerState(DEFAULT_PROFILES[0]);
    s1.distMi = 2; s1.elapsedSec = 14 * 60; s1.status = 'running';
    const s2 = makeRunnerState(DEFAULT_PROFILES[0]);
    s2.distMi = 20; s2.elapsedSec = 142 * 60; s2.status = 'running';
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
