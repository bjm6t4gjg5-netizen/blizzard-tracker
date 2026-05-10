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

  it('starts near Brooklyn Museum', () => {
    const start = COURSE[0];
    expect(start.lat).toBeGreaterThan(40.66);
    expect(start.lat).toBeLessThan(40.68);
    expect(start.lng).toBeGreaterThan(-73.97);
    expect(start.lng).toBeLessThan(-73.95);
    expect(start.mi).toBe(0);
  });

  it('finishes near Coney Island Boardwalk', () => {
    const end = COURSE[COURSE.length - 1];
    expect(end.lat).toBeLessThan(40.58);
    expect(end.lng).toBeLessThan(-73.97);
    expect(end.mi).toBeCloseTo(TOTAL_MI, 1);
  });

  it('miles are strictly monotonic non-decreasing', () => {
    for (let i = 1; i < COURSE.length; i++) {
      expect(COURSE[i].mi).toBeGreaterThanOrEqual(COURSE[i - 1].mi - 1e-6);
    }
  });

  it('has no nonsense lat/lng jumps (no 1.7mi teleport like the original)', () => {
    // Garmin auto-prunes points on long straights (Ocean Pkwy), so we tolerate
    // up to 1.5mi between adjacent points but never 1.7+ which was the v1 bug.
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

  it('exports the official 246ft elevation gain headline', () => {
    expect(TOTAL_GAIN_FT).toBe(246);
  });
});

describe('checkpoints', () => {
  it('produces start, 5K, 10K, 15K, 10mi, 20K, finish', () => {
    expect(CHECKPOINTS.map(c => c.label)).toEqual(['Start', '5K', '10K', '15K', '10mi', '20K', 'Finish']);
  });
  it('checkpoint coords lie on the course polyline (within 100m)', () => {
    for (const cp of CHECKPOINTS) {
      const { meters } = nearestOnCourse(cp.lat, cp.lng);
      expect(meters).toBeLessThan(100);
    }
  });
});

describe('spectator spots', () => {
  it('all spots are within Brooklyn bounding box of the course', () => {
    for (const s of SPECTATOR_SPOTS) {
      expect(s.lat).toBeGreaterThanOrEqual(COURSE_BOUNDS.south - 0.01);
      expect(s.lat).toBeLessThanOrEqual(COURSE_BOUNDS.north + 0.01);
    }
  });
  it('Machate Circle is flagged as the NYRR cheer zone at mile 7', () => {
    const m = SPECTATOR_SPOTS.find(s => s.name === 'Machate Circle');
    expect(m).toBeDefined();
    expect(m?.official).toBe('NYRR');
    expect(m?.mi).toBeCloseTo(7.0, 1);
  });
  it('New Balance cheer zone is at mile 11', () => {
    const nb = SPECTATOR_SPOTS.find(s => s.official === 'New Balance');
    expect(nb).toBeDefined();
    expect(nb?.mi).toBeCloseTo(11.0, 1);
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
    expect(MILE_MARKERS.length).toBeGreaterThanOrEqual(14);
    expect(MILE_MARKERS[0].mi).toBe(0);
  });
  it('elevation profile is dense', () => {
    expect(ELEVATION_PROFILE.length).toBeGreaterThan(100);
  });
});

describe('distanceMeters', () => {
  it('zero for identical points', () => {
    expect(distanceMeters(40.67, -73.96, 40.67, -73.96)).toBe(0);
  });
  it('reasonable scale: 1 deg lat ~ 111 km', () => {
    const d = distanceMeters(40, -73, 41, -73);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});
