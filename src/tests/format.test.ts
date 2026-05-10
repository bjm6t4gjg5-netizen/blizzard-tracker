import { describe, it, expect } from 'vitest';
import {
  formatHMS, formatHMSFull, formatPace, formatPacePerMile,
  parsePace, parseGoalTime,
} from '../lib/format';

describe('formatHMS', () => {
  it('returns em-dash for null/zero/invalid', () => {
    expect(formatHMS(null)).toBe('—');
    expect(formatHMS(undefined)).toBe('—');
    expect(formatHMS(0)).toBe('—');
    expect(formatHMS(-5)).toBe('—');
    expect(formatHMS(NaN)).toBe('—');
  });
  it('omits hour when under one', () => {
    expect(formatHMS(45)).toBe('0:45');
    expect(formatHMS(60)).toBe('1:00');
    expect(formatHMS(3599)).toBe('59:59');
  });
  it('shows H:MM:SS when ≥1h', () => {
    expect(formatHMS(3600)).toBe('1:00:00');
    expect(formatHMS(5400)).toBe('1:30:00');
    expect(formatHMS(7800)).toBe('2:10:00');
  });
});

describe('formatHMSFull', () => {
  it('always shows hour place', () => {
    expect(formatHMSFull(45)).toBe('0:00:45');
    expect(formatHMSFull(5400)).toBe('1:30:00');
    expect(formatHMSFull(0)).toBe('—:—:—');
  });
});

describe('formatPace', () => {
  it('handles edge cases', () => {
    expect(formatPace(0, 0)).toBe('—');
    expect(formatPace(360, 0)).toBe('—');
    expect(formatPace(360, 0.04)).toBe('—'); // too short
  });
  it('computes mins per mile', () => {
    expect(formatPace(360, 1)).toBe('6:00');
    expect(formatPace(420, 1)).toBe('7:00');
    expect(formatPace(5400, 13.1)).toBe('6:52'); // sub-90 pace
  });
});

describe('formatPacePerMile', () => {
  it('formats raw seconds', () => {
    expect(formatPacePerMile(360)).toBe('6:00');
    expect(formatPacePerMile(395)).toBe('6:35');
    expect(formatPacePerMile(0)).toBe('—');
    expect(formatPacePerMile(-1)).toBe('—');
  });
});

describe('parsePace', () => {
  it('parses M:SS', () => {
    expect(parsePace('6:30')).toBe(390);
    expect(parsePace('10:00')).toBe(600);
    expect(parsePace('  7:15  ')).toBe(435);
  });
  it('rejects invalid', () => {
    expect(parsePace('6')).toBeNull();
    expect(parsePace('6:60')).toBeNull(); // seconds ≥60
    expect(parsePace('foo')).toBeNull();
    expect(parsePace('')).toBeNull();
    // @ts-expect-error
    expect(parsePace(null)).toBeNull();
  });
});

describe('parseGoalTime', () => {
  it('handles three forms', () => {
    expect(parseGoalTime('1:30:00')).toBe(5400);
    expect(parseGoalTime('90:00')).toBe(5400);
    expect(parseGoalTime('90')).toBe(5400);
    expect(parseGoalTime('2:10:00')).toBe(7800);
  });
  it('rejects garbage', () => {
    expect(parseGoalTime('1:bad:00')).toBeNull();
    expect(parseGoalTime('-5')).toBeNull();
    expect(parseGoalTime('')).toBeNull();
  });
});
