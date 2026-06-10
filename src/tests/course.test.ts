import { describe, it, expect } from 'vitest';
import {
  COURSE, CHECKPOINTS, SPECTATOR_SPOTS, MILE_MARKERS,
  ELEVATION_PROFILE, TOTAL_GAIN_FT,
  pointAtMile, distanceMeters, nearestOnCourse,
  COURSE_BOUNDS,
} from '../lib/course';
import { TOTAL_MI } from '../lib/time';

describe('GPX-derived course', () => {
  it('parses many trackpoints', () => {
    expect(COURSE.length).toBeGreaterThan(150);
  });

  it('starts in Grant Park', () => {
    const start = COURSE[0];
    expect(start.lat).toBeGreaterThan(41.87);
    expect(start.lat).toBeLessThan(41.89);
    expect(start.lng).toBeGreaterThan(-87.63);
    expect(start.lng).toBeLessThan(-87.61);
    expect(start.mi).toBe(0);
  });

  it('finishes back in Grant Park (loop course)', () => {
    const end = COURSE[COURSE.length - 1];
    expect(end.lat).toBeGreaterThan(41.86);
    expect(end.lat).toBeLessThan(41.88);
    expect(end.lng).toBeGreaterThan(-87.63);
    expect(end.lng).toBeLessThan(-87.61);
    expect(end.mi).toBeCloseTo(TOTAL_MI, 1);
  });

  it('reaches Lakeview in the north and Bronzeville in the south', () => {
    // North turnaround ~ Addison/Sheridan (lat ~41.95); south end ~ 35th St (lat ~41.83).
    expect(COURSE_BOUNDS.north).toBeGreaterThan(41.93);
    expect(COURSE_BOUNDS.south).toBeLessThan(41.84);
  });

  it('miles are strictly monotonic non-decreasing', () => {
    for (let i = 1; i < COURSE.length; i++) {
      expect(COURSE[i].mi).toBeGreaterThanOrEqual(COURSE[i - 1].mi - 1e-6);
    }
  });

  it('has no nonsense lat/lng jumps (no teleports)', () => {
    let worst = 0;
    for (let i = 1; i < COURSE.length; i++) {
      const d = distanceMeters(
        COURSE[i - 1].lat, COURSE[i - 1].lng,
        COURSE[i].lat, COURSE[i].lng,
      );
      if (d > worst) worst = d;
    }
    expect(worst).toBeLessThan(2415); // 1.5 mi
  });

  it('exports the flat-course elevation gain headline', () => {
    // Chicago is the flattest Major — anything between 150 and 400ft is sane.
    expect(TOTAL_GAIN_FT).toBeGreaterThan(150);
    expect(TOTAL_GAIN_FT).toBeLessThan(400);
  });
});

describe('checkpoints', () => {
  it('produces marathon 5K mats, half, and finish', () => {
    expect(CHECKPOINTS.map(c => c.label)).toEqual([
      'Start', '5K', '10K', '15K', '20K', 'Half', '25K', '30K', '35K', '40K', 'Finish',
    ]);
  });
  it('checkpoint coords lie on the course polyline (within 100m)', () => {
    for (const cp of CHECKPOINTS) {
      const { meters } = nearestOnCourse(cp.lat, cp.lng);
      expect(meters).toBeLessThan(100);
    }
  });
});

describe('spectator spots', () => {
  it('all spots are within the Chicago bounding box of the course', () => {
    for (const s of SPECTATOR_SPOTS) {
      expect(s.lat).toBeGreaterThanOrEqual(COURSE_BOUNDS.south - 0.01);
      expect(s.lat).toBeLessThanOrEqual(COURSE_BOUNDS.north + 0.01);
    }
  });
  it('halfway cheer zone sits at mile 13.1 (Greektown)', () => {
    const m = SPECTATOR_SPOTS.find(s => s.official === 'Bank of America');
    expect(m).toBeDefined();
    expect(m?.mi).toBeCloseTo(13.1, 1);
  });
  it('Mount Roosevelt spot is just before the finish', () => {
    const mr = SPECTATOR_SPOTS.find(s => /Roosevelt/.test(s.name));
    expect(mr).toBeDefined();
    expect(mr!.mi).toBeGreaterThan(25.5);
    expect(mr!.mi).toBeLessThan(TOTAL_MI);
  });
  it('Chinatown spot lands at mile ~21.4', () => {
    const c = SPECTATOR_SPOTS.find(s => /Chinatown/.test(s.name));
    expect(c).toBeDefined();
    expect(c!.mi).toBeCloseTo(21.35, 1);
  });
});

describe('pointAtMile', () => {
  it('clamps to [0, total]', () => {
    expect(pointAtMile(-5).mi).toBe(0);
    expect(pointAtMile(99).mi).toBeCloseTo(TOTAL_MI, 4);
  });
  it('returns roughly start at 0, finish at total', () => {
    const start = pointAtMile(0);
    const finish = pointAtMile(TOTAL_MI);
    expect(start.lat).toBeCloseTo(COURSE[0].lat, 4);
    expect(finish.lat).toBeCloseTo(COURSE[COURSE.length - 1].lat, 4);
  });
  it('interpolates monotonically', () => {
    const a = pointAtMile(3);
    const b = pointAtMile(5);
    const c = pointAtMile(10);
    expect(a.mi).toBe(3);
    expect(b.mi).toBe(5);
    expect(c.mi).toBe(10);
  });
});

describe('mile markers + elevation', () => {
  it('one marker per integer mile + finish', () => {
    expect(MILE_MARKERS.length).toBeGreaterThanOrEqual(27);
    expect(MILE_MARKERS[0].mi).toBe(0);
  });
  it('elevation profile is dense', () => {
    expect(ELEVATION_PROFILE.length).toBeGreaterThan(200);
  });
});

describe('distanceMeters', () => {
  it('zero for identical points', () => {
    expect(distanceMeters(41.88, -87.63, 41.88, -87.63)).toBe(0);
  });
  it('reasonable scale: 1 deg lat ~ 111 km', () => {
    const d = distanceMeters(41, -87, 42, -87);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});
