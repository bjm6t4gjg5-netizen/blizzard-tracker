// ============================================================
// course.ts — Geometry derived from the real RBC Brooklyn Half GPX.
//
// Single source of truth: src/lib/course.gpx (Garmin Connect trace
// of the 2025 race). The 2026 route is identical per the NYRR map:
// Brooklyn Museum start → Grand Army Plaza loop → Prospect Park
// north + south sections → Ocean Pkwy southbound → Surf Ave →
// W 10th St → Riegelmann Boardwalk finish.
//
// Every other course-related export below is computed from the
// parsed track. Hand-coded points are gone.
// ============================================================
import gpxText from './course.gpx?raw';
import { TOTAL_MI } from './time';

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

export interface CoursePoint {
  /** Latitude (deg). */
  lat: number;
  /** Longitude (deg). */
  lng: number;
  /** Cumulative distance from start, miles. */
  mi: number;
  /** Elevation, meters. */
  eleM: number;
  /** Elevation, feet. */
  eleFt: number;
}

/** Haversine distance in meters between two lat/lng points. */
export function distanceMeters(
  aLat: number, aLng: number, bLat: number, bLng: number,
): number {
  const R = 6_371_008.8; // mean Earth radius, m
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const dφ = ((bLat - aLat) * Math.PI) / 180;
  const dλ = ((bLng - aLng) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Parse a GPX file into raw lat/lng/ele tuples (no distance computed yet). */
function parseGpxTrackpoints(gpx: string): Array<{ lat: number; lng: number; ele: number }> {
  const out: Array<{ lat: number; lng: number; ele: number }> = [];
  // Non-DOM regex parse: works identically in browser, Node, and jsdom.
  const re = /<trkpt[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(gpx))) {
    const lat = +m[1];
    const lng = +m[2];
    const eleMatch = m[3].match(/<ele>([-\d.]+)<\/ele>/);
    const ele = eleMatch ? +eleMatch[1] : 0;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      out.push({ lat, lng, ele });
    }
  }
  return out;
}

/** Build the course: assign cumulative miles, scale to TOTAL_MI exactly. */
function buildCourse(): CoursePoint[] {
  const raw = parseGpxTrackpoints(gpxText);
  if (raw.length < 2) {
    throw new Error(`course.gpx: only ${raw.length} trackpoint(s) parsed`);
  }
  // 1. Cumulative distance
  const cumMeters = [0];
  for (let i = 1; i < raw.length; i++) {
    cumMeters.push(
      cumMeters[i - 1] +
        distanceMeters(raw[i - 1].lat, raw[i - 1].lng, raw[i].lat, raw[i].lng),
    );
  }
  // 2. Garmin track length is typically ~1% off official 13.1094 mi due to GPS noise.
  //    Linearly scale so the final point sits exactly at TOTAL_MI — this keeps mile
  //    markers honest while preserving the shape of the polyline.
  const trackMiles = cumMeters[cumMeters.length - 1] / METERS_PER_MILE;
  const scale = TOTAL_MI / trackMiles;

  return raw.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    mi: (cumMeters[i] / METERS_PER_MILE) * scale,
    eleM: p.ele,
    eleFt: p.ele / METERS_PER_FOOT,
  }));
}

export const COURSE: readonly CoursePoint[] = buildCourse();

/** Plain [[lat, lng], ...] for Leaflet. */
export const COURSE_LATLNGS: ReadonlyArray<[number, number]> = COURSE.map(p => [p.lat, p.lng]);

/** Course bounding box for fitting the map. */
export const COURSE_BOUNDS = (() => {
  let n = -90, s = 90, e = -180, w = 180;
  for (const p of COURSE) {
    if (p.lat > n) n = p.lat;
    if (p.lat < s) s = p.lat;
    if (p.lng > e) e = p.lng;
    if (p.lng < w) w = p.lng;
  }
  return { north: n, south: s, east: e, west: w };
})();

/** Course centroid (used for initial map view). */
export const COURSE_CENTER: [number, number] = [
  (COURSE_BOUNDS.north + COURSE_BOUNDS.south) / 2,
  (COURSE_BOUNDS.east + COURSE_BOUNDS.west) / 2,
];

/**
 * Total elevation gain in feet — sum of positive deltas along the GPX trace.
 *
 * Note: the official NYRR figure for the Brooklyn Half is 246ft. GPS traces
 * tend to under-count gain because Garmin smooths sub-meter wobble, so this
 * value is typically lower than the official one. We expose both: the computed
 * trace gain (for charts), and the official figure (for headline display).
 */
export const TRACE_GAIN_FT = (() => {
  let gain = 0;
  for (let i = 1; i < COURSE.length; i++) {
    const d = COURSE[i].eleFt - COURSE[i - 1].eleFt;
    if (d > 0) gain += d;
  }
  return Math.round(gain);
})();

/** Official NYRR-published total gain. */
export const TOTAL_GAIN_FT = 246;

// ────────────────────────────────────────────────────────────
// Lookup helpers
// ────────────────────────────────────────────────────────────

/** Linearly interpolate a course point at the given distance from start. */
export function pointAtMile(mi: number): CoursePoint {
  const target = Math.max(0, Math.min(mi, TOTAL_MI));
  if (target <= 0) return COURSE[0];
  if (target >= TOTAL_MI) return COURSE[COURSE.length - 1];
  // Binary search
  let lo = 0;
  let hi = COURSE.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (COURSE[mid].mi <= target) lo = mid;
    else hi = mid;
  }
  const a = COURSE[lo];
  const b = COURSE[hi];
  const span = b.mi - a.mi || 1e-9;
  const t = (target - a.mi) / span;
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    mi: target,
    eleM: a.eleM + (b.eleM - a.eleM) * t,
    eleFt: a.eleFt + (b.eleFt - a.eleFt) * t,
  };
}

/**
 * Project an arbitrary lat/lng onto the course polyline, returning the closest
 * interpolated point + cumulative miles. Performs proper segment projection so
 * a query halfway down a 1.5-mile-long Ocean Pkwy segment returns the exact
 * mid-segment point, not the closer endpoint.
 *
 * Useful for snapping a noisy GPS reading to the route.
 */
export function nearestOnCourse(lat: number, lng: number): { point: CoursePoint; meters: number } {
  let best: CoursePoint = COURSE[0];
  let bestMeters = Infinity;

  // Use a local equirectangular projection (good enough at city scale).
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const toXY = (la: number, lo: number) => ({ x: lo * cosLat, y: la });
  const q = toXY(lat, lng);

  for (let i = 1; i < COURSE.length; i++) {
    const a = COURSE[i - 1];
    const b = COURSE[i];
    const pa = toXY(a.lat, a.lng);
    const pb = toXY(b.lat, b.lng);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((q.x - pa.x) * dx + (q.y - pa.y) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const interp: CoursePoint = {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
      mi:  a.mi  + (b.mi  - a.mi)  * t,
      eleM:  a.eleM  + (b.eleM  - a.eleM)  * t,
      eleFt: a.eleFt + (b.eleFt - a.eleFt) * t,
    };
    const d = distanceMeters(lat, lng, interp.lat, interp.lng);
    if (d < bestMeters) {
      bestMeters = d;
      best = interp;
    }
  }
  return { point: best, meters: bestMeters };
}

// ────────────────────────────────────────────────────────────
// Race-day landmarks
// ────────────────────────────────────────────────────────────

export interface Checkpoint {
  label: string;
  mi: number;
  lat: number;
  lng: number;
  /** True if this is a celebrated spectator zone, not just a timing mat. */
  spectator: boolean;
}

const CHECKPOINT_MILES: ReadonlyArray<{ label: string; mi: number; spectator: boolean }> = [
  { label: 'Start', mi: 0.0, spectator: true },
  { label: '5K', mi: 3.107, spectator: false },
  { label: '10K', mi: 6.214, spectator: false },
  { label: '15K', mi: 9.321, spectator: true },
  { label: '10mi', mi: 10.0, spectator: false },
  { label: '20K', mi: 12.427, spectator: false },
  { label: 'Finish', mi: TOTAL_MI, spectator: true },
];

export const CHECKPOINTS: readonly Checkpoint[] = CHECKPOINT_MILES.map(c => {
  const p = pointAtMile(c.mi);
  return { label: c.label, mi: c.mi, lat: p.lat, lng: p.lng, spectator: c.spectator };
});

export interface SpectatorSpot {
  /** Approximate mile a runner reaches this spot. */
  mi: number;
  name: string;
  /** Subway lines / how to get there. */
  transit: string;
  /** Why this spot is good. */
  note: string;
  lat: number;
  lng: number;
  /** Official cheer zone designation, if any. */
  official?: 'NYRR' | 'New Balance';
}

/**
 * Spectator spots from the 2026 NYRR official course map. Coordinates are
 * snapped to the actual course polyline via pointAtMile so pins always sit on
 * the route — no more "marker floating in a backyard" bugs.
 */
const SPECTATOR_DEFS: ReadonlyArray<Omit<SpectatorSpot, 'lat' | 'lng'>> = [
  {
    mi: 1.5,
    name: 'Grand Army Plaza',
    transit: '2/3 to Grand Army Plaza',
    note: 'Runners loop the arch — easy to spot both legs.',
  },
  {
    mi: 3.1,
    name: 'Parkside Ave park entry',
    transit: 'Q/B to Parkside Ave',
    note: '5K timing mat — first big crowd zone.',
  },
  {
    mi: 7.0,
    name: 'Machate Circle',
    transit: 'F to 15th St–Prospect Park',
    note: 'NYRR Member Cheer Zone — official party with music & signs.',
    official: 'NYRR',
  },
  {
    mi: 9.3,
    name: 'Ocean Pkwy / Church Ave',
    transit: 'Q/B to Church Ave',
    note: '15K mat — runners are settled into Ocean Pkwy rhythm.',
  },
  {
    mi: 11.0,
    name: 'Ocean Pkwy / Avenue W',
    transit: 'F to Avenue X',
    note: 'New Balance Cheer Zone — biggest mid-Ocean party.',
    official: 'New Balance',
  },
  {
    mi: 12.6,
    name: 'W 10th St / Surf Ave',
    transit: 'D/F/N/Q to Coney Island–Stillwell Ave',
    note: 'Final turn before the boardwalk — runners are flying.',
  },
  {
    mi: TOTAL_MI,
    name: 'Coney Island Boardwalk · Finish',
    transit: 'D/F/N/Q to Stillwell Ave',
    note: 'Maimonides Park finish + after-party.',
  },
];

export const SPECTATOR_SPOTS: readonly SpectatorSpot[] = SPECTATOR_DEFS.map(s => {
  const p = pointAtMile(s.mi);
  return { ...s, lat: p.lat, lng: p.lng };
});

// ────────────────────────────────────────────────────────────
// Mile markers — for charts & map overlays
// ────────────────────────────────────────────────────────────

export interface MileMarker {
  mi: number;
  lat: number;
  lng: number;
  eleFt: number;
}

export const MILE_MARKERS: readonly MileMarker[] = (() => {
  const out: MileMarker[] = [];
  for (let m = 0; m <= Math.floor(TOTAL_MI); m++) {
    const p = pointAtMile(m);
    out.push({ mi: m, lat: p.lat, lng: p.lng, eleFt: p.eleFt });
  }
  out.push({ mi: TOTAL_MI, lat: COURSE[COURSE.length - 1].lat, lng: COURSE[COURSE.length - 1].lng, eleFt: COURSE[COURSE.length - 1].eleFt });
  return out;
})();

// ────────────────────────────────────────────────────────────
// Elevation profile — sampled at 0.1mi intervals for smooth charts
// ────────────────────────────────────────────────────────────

export interface ElevationSample {
  mi: number;
  ft: number;
}

export const ELEVATION_PROFILE: readonly ElevationSample[] = (() => {
  const out: ElevationSample[] = [];
  for (let mi = 0; mi <= TOTAL_MI; mi += 0.1) {
    const p = pointAtMile(Math.min(mi, TOTAL_MI));
    out.push({ mi: +mi.toFixed(2), ft: Math.round(p.eleFt) });
  }
  return out;
})();
