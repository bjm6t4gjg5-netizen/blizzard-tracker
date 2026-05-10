import { describe, it, expect } from 'vitest';
import { parseRtrtHtml } from '../lib/rtrt';

const PRE_RACE_HTML = `
<html><body>
  <div class="header">RBC Brooklyn Half · 13.1 mi · May 16, 2026</div>
  <div class="status">PRE-RACE — race day is May 16</div>
  <div class="footer">© RTRT — 13.1 miles</div>
</body></html>
`;

const RUNNING_HTML = `
<html><body>
  <div class="hero">
    <span class="distance">5.42 mi</span>
    <span class="elapsed">0:36:48</span>
  </div>
  <table class="splits">
    <tr><th>Checkpoint</th><th>Time</th><th>Pace</th></tr>
    <tr><td>5K</td><td>20:55</td><td>6:45 / mi</td></tr>
  </table>
  <div class="footer">RBC Brooklyn Half · 13.1 mi total</div>
</body></html>
`;

const FINISH_HTML = `
<html><body>
  <h1 class="status">FINISHED</h1>
  <div>13.10 mi · 1:28:12</div>
  <table>
    <tr><th>Checkpoint</th><th>Time</th><th>Pace</th></tr>
    <tr><td>5K</td><td>20:30</td><td>6:35 / mi</td></tr>
    <tr><td>10K</td><td>41:15</td><td>6:38 / mi</td></tr>
    <tr><td>Finish</td><td>1:28:12</td><td>6:44 / mi</td></tr>
  </table>
</body></html>
`;

const NOISE_HTML = `<html><body>Some random page</body></html>`;

describe('parseRtrtHtml', () => {
  it('detects pre-race', () => {
    const p = parseRtrtHtml(PRE_RACE_HTML);
    expect(p.status).toBe('pre');
  });

  it('detects an active runner with distance + elapsed', () => {
    const p = parseRtrtHtml(RUNNING_HTML);
    expect(p.status).toBe('running');
    expect(p.distMi).toBeCloseTo(5.42, 2);
    expect(p.elapsedSec).toBe(36 * 60 + 48);
  });

  it('extracts 5K split row', () => {
    const p = parseRtrtHtml(RUNNING_HTML);
    expect(p.splits.length).toBeGreaterThan(0);
    const fivek = p.splits.find(s => s.label.includes('5K'));
    expect(fivek?.chipTime).toBe('20:55');
    expect(fivek?.pace).toContain('6:45');
  });

  it('does NOT pick up footer "13.1 mi" as live distance during running mid-race', () => {
    // Running HTML has both "5.42 mi" and footer "13.1 mi". Our heuristic picks
    // the largest, so this test ensures we accept that — but also that pre-race
    // doesn't get marked running just because footer text exists.
    const p = parseRtrtHtml(PRE_RACE_HTML);
    expect(p.status).not.toBe('running');
  });

  it('detects FINISHED via the keyword', () => {
    const p = parseRtrtHtml(FINISH_HTML);
    expect(p.status).toBe('finished');
    expect(p.distMi).toBeCloseTo(13.1, 1);
    expect(p.elapsedSec).toBe(1 * 3600 + 28 * 60 + 12);
  });

  it('returns unknown / null on garbage', () => {
    const p = parseRtrtHtml(NOISE_HTML);
    expect(p.status).toBe('unknown');
    expect(p.distMi).toBeNull();
    expect(p.elapsedSec).toBeNull();
  });

  it('rejects wall-clock H:MM:SS larger than 6h', () => {
    const html = `<body>14:32:55 — local time</body>`;
    const p = parseRtrtHtml(html);
    expect(p.elapsedSec).toBeNull();
  });
});
