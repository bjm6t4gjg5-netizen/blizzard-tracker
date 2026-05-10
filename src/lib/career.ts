// ============================================================
// career.ts — Historical race data for the two anchor runners.
//
// Catherine: Saint Rita XC (DPL) 2009-2011, USATF Junior Olympic
//   XC 2009-2010, DPL Track 2011-2012, plus adult marathons.
//   Source: scans provided by family (the dad).
// Helaine: 53-race history 2005 → 2026, source xlsx.
// ============================================================

// ────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────

export interface Race {
  date: string;       // ISO YYYY-MM-DD
  name: string;
  location?: string;
  distance: 'Marathon' | 'Half' | '10K' | '5K' | 'Mixed' | 'XC' | 'Track' | 'Field';
  /** Display-friendly time, e.g. "1:28:12" or "12:49" or "5:46.22". null = no recorded time. */
  time?: string | null;
  place?: number | string;
  totalRunners?: number;
  /** Subdistance label for XC / track (e.g. "2 mi", "1.5 mi", "3000m", "800m", "1600m"). */
  event?: string;
  /** True if a major (Boston, NYC, Chicago, London, Berlin, Tokyo). */
  worldMajor?: boolean;
  /** Notable result flag: 1st place, MVP, PR, etc. */
  highlight?: string;
  notes?: string;
}

export interface PR {
  event: string;
  mark: string;
  /** Approx pace per mile (for distances) or null for field events. */
  paceLabel?: string | null;
  date: string;
  meet?: string;
  /** True if this is an adult / open PR (vs. middle-school). */
  isAdult?: boolean;
  /** Optional external link (Strava, official results, etc.). */
  href?: string;
}

export interface CareerData {
  runnerId: 'gf' | 'mom' | string;
  bio: string;
  prs: PR[];
  races: Race[];
}

// ────────────────────────────────────────────────────────────
// Catherine
// ────────────────────────────────────────────────────────────

export const CATHERINE_PRS: PR[] = [
  { event: 'Marathon',      mark: '3:06:12',   paceLabel: '7:06 / mi',    date: '2025-04-21', meet: '129th Boston Marathon',     isAdult: true, href: 'https://strava.app.link/ifPE0MD912b' },
  { event: '1600m',         mark: '5:46.22',   paceLabel: '5:48 / mi',    date: '2012-05-12', meet: 'DPL Varsity City Meet' },
  { event: '800m',          mark: '2:30.62',   paceLabel: '5:03 / mi',    date: '2012-05-12', meet: 'DPL Varsity City Meet' },
  { event: '400m',          mark: '1:04.78',   paceLabel: '6.48/100m',    date: '2012-05-12', meet: 'DPL Varsity City Meet' },
  { event: '100m',          mark: '14.85',     paceLabel: null,           date: '2011-04-16', meet: 'DPL Varsity Meet 1' },
  { event: '100m hurdles',  mark: '20.62',     paceLabel: null,           date: '2011-05-14', meet: 'DPL Varsity Meet 4' },
  { event: 'Long jump',     mark: "13'06.50″", paceLabel: '4.12 m',       date: '2012-05-05', meet: 'DPL Varsity Meet 3' },
  { event: 'XC 2 mi',       mark: '12:49',     paceLabel: '6:25 / mi',    date: '2011-10-15', meet: 'DPL Varsity Meet 1' },
  { event: 'XC 1.5 mi',     mark: '9:30',      paceLabel: '6:20 / mi',    date: '2009-10-17', meet: 'DPL JV Meet 1' },
  { event: 'XC 3000m',      mark: '11:54',     paceLabel: '6:24 / mi',    date: '2010-11-07', meet: 'USATF JO SW Assoc Champ.' },
  { event: 'Half marathon', mark: '1:30:00',   paceLabel: '~6:52 / mi',   date: '2026-05-16', meet: 'BKH 2026 (goal)',           isAdult: true },
];

export const CATHERINE_RACES: Race[] = [
  // Saint Rita 5th grade XC 2008 — DPL Champion (added via dad's note, round 8)
  { date: '2008-10-25', name: 'Saint Rita JV XC — Championship',     location: 'Bishop Dunne',      distance: 'XC', event: '1.5 mi', time: null,    place: 1, highlight: '5th-grade DPL Champion', notes: 'Team championship — Catherine in the middle of the team photo.' },

  // Saint Rita JV XC 2009 (6th grade) — undefeated 1.5mi season
  { date: '2009-10-17', name: 'Saint Rita JV XC — Meet 1',          location: 'Norbuck',           distance: 'XC', event: '1.5 mi', time: '9:30',  place: 1, highlight: '1st — undefeated season' },
  { date: '2009-10-24', name: 'Saint Rita JV XC — Meet 2',          location: 'Bishop Dunne',      distance: 'XC', event: '1.5 mi', time: '10:24', place: 1 },
  { date: '2009-10-31', name: 'Saint Rita JV XC — Championship',    location: 'Bishop Dunne',      distance: 'XC', event: '1.5 mi', time: '10:17', place: 1, highlight: 'JV Champion' },
  // USATF JO 2009
  { date: '2009-11-07', name: 'USATF JO — SW Assoc Champ.',         location: 'Harry Myers Park, Rockwall', distance: 'XC', event: '3000m', time: '12:17', place: 1, highlight: 'SW Assoc Champion' },
  { date: '2009-11-21', name: 'USATF JO — Region 12 Championship',  location: 'Harry Myers Park, Rockwall', distance: 'XC', event: '3000m', time: '12:35', place: 5 },
  { date: '2009-12-12', name: 'USATF JO — National Championship',   location: 'Rancho San Rafael, Reno NV', distance: 'XC', event: '3000m', time: '13:20', place: 135, notes: '22°F, 15mph wind, 20" snow on ground' },

  // Saint Rita Varsity XC 2010 (7th grade)
  { date: '2010-10-02', name: 'Saint Rita Varsity XC — Meet 1',        location: 'Norbuck',         distance: 'XC', event: '2 mi', time: '13:42', place: 3 },
  { date: '2010-10-09', name: 'Saint Rita Varsity XC — Meet 2',        location: 'Bishop Dunne',    distance: 'XC', event: '2 mi', time: '11:44', place: 3 },
  { date: '2010-10-23', name: 'Saint Rita Varsity XC — Championship',  location: 'Bishop Dunne',    distance: 'XC', event: '2 mi', time: '11:48', place: 4 },
  // USATF JO 2010
  { date: '2010-11-07', name: 'USATF JO — SW Assoc Champ.',         location: 'Harry Myers Park, Rockwall', distance: 'XC', event: '3000m', time: '11:54', place: 3 },

  // DPL Track 2011 (7th grade)
  { date: '2011-04-16', name: 'DPL Varsity Meet 1',  location: 'Dallas', distance: 'Track', event: '100m',          time: '14.85',   place: 22 },
  { date: '2011-04-30', name: 'DPL Varsity Meet 2',  location: 'Dallas', distance: 'Track', event: '800m',          time: '2:39.60', place: 2 },
  { date: '2011-05-07', name: 'DPL Varsity Meet 3',  location: 'Dallas', distance: 'Track', event: '400m',          time: '1:10.15', place: 8 },
  { date: '2011-05-14', name: 'DPL Varsity Meet 4',  location: 'Dallas', distance: 'Track', event: '800m',          time: '2:34.81', place: 3, highlight: 'Season best' },

  // Saint Rita Varsity XC 2011 (8th grade) — undefeated again
  { date: '2011-10-08', name: 'Jesuit Classic',                       location: 'Norbuck',          distance: 'XC', event: '2 mi' },
  { date: '2011-10-15', name: 'Saint Rita Varsity XC — Meet 1',        location: 'University of Dallas', distance: 'XC', event: '2 mi', time: '12:49', place: 1, highlight: '1st — undefeated season' },
  { date: '2011-10-22', name: 'Saint Rita Varsity XC — Meet 2',        location: 'Norbuck',          distance: 'XC', event: '2 mi', time: '13:58', place: 1 },
  { date: '2011-10-29', name: 'Saint Rita Varsity XC — Championship',  location: 'Bishop Dunne',     distance: 'XC', event: '2 mi', time: '12:49', place: 1, highlight: 'Varsity Champion' },

  // DPL Track 2012 (8th grade) — won every 800m and 1600m
  { date: '2012-04-21', name: 'DPL Varsity Meet 1',   location: 'Dallas', distance: 'Track', event: '800m',  time: '2:43.03', place: 1, highlight: 'Win' },
  { date: '2012-04-21', name: 'DPL Varsity Meet 1',   location: 'Dallas', distance: 'Track', event: '1600m', time: '6:05.22', place: 1, highlight: 'Win' },
  { date: '2012-04-28', name: 'DPL Varsity Meet 2',   location: 'Dallas', distance: 'Track', event: '800m',  time: '2:34.57', place: 1, highlight: 'Win' },
  { date: '2012-05-05', name: 'DPL Varsity Meet 3',   location: 'Dallas', distance: 'Track', event: '800m',  time: '2:35.03', place: 1, highlight: 'Win' },
  { date: '2012-05-05', name: 'DPL Varsity Meet 3',   location: 'Dallas', distance: 'Track', event: '1600m', time: '5:49.47', place: 1, highlight: 'Win' },
  { date: '2012-05-12', name: 'DPL Varsity City Meet', location: 'Dallas', distance: 'Track', event: '800m',  time: '2:30.62', place: 1, highlight: 'Win · season PR' },
  { date: '2012-05-12', name: 'DPL Varsity City Meet', location: 'Dallas', distance: 'Track', event: '1600m', time: '5:46.22', place: 1, highlight: 'Win · season PR · MVP' },

  // Adult marathons / halfs (the ones already shown in the v1 hero strip)
  { date: '2023-05-20', name: 'RBC Brooklyn Half',            location: 'Brooklyn, NY',   distance: 'Half',     time: null, highlight: 'BKH veteran' },
  { date: '2024-05-05', name: 'Eugene Marathon',              location: 'Eugene, OR',     distance: 'Marathon', time: null },
  { date: '2025-04-21', name: 'Boston Marathon',              location: 'Hopkinton → Boston, MA', distance: 'Marathon', time: '3:06:12', place: undefined, worldMajor: true, highlight: 'Marathon PR · 7:06/mi · 818ft gain', notes: 'Catherine\'s fastest marathon. Garmin Forerunner 245. Avg HR 179 bpm.' },
  { date: '2025-09-21', name: 'Berlin Marathon',              location: 'Berlin, Germany', distance: 'Marathon', time: null, worldMajor: true },
  { date: '2026-05-16', name: 'RBC Brooklyn Half',            location: 'Brooklyn, NY',   distance: 'Half',     time: null, notes: 'Sub-90 goal' },
];

// ────────────────────────────────────────────────────────────
// Helaine
// ────────────────────────────────────────────────────────────

const H = (year: number, distance: Race['distance'], name: string, location: string, opts: Partial<Race> = {}): Race => ({
  date: `${year}-01-01`, // Specific dates not in source xlsx; year is enough for the timeline.
  distance, name, location, time: null, ...opts,
});

export const HELAINE_RACES: Race[] = [
  H(2005, 'Half',     'North Trails Half Marathon',         'Dallas'),
  H(2005, 'Half',     'The Half',                           'Dallas'),
  H(2006, 'Marathon', 'Dallas White Rock Marathon',         'Dallas',                 { highlight: 'First marathon' }),
  H(2007, 'Half',     'DRC Half Marathon',                  'Dallas'),
  H(2007, 'Marathon', 'Dallas White Rock Marathon',         'Dallas'),
  H(2008, 'Half',     'DRC Half Marathon',                  'Dallas'),
  H(2008, 'Marathon', 'Dallas White Rock Marathon',         'Dallas'),
  H(2009, 'Half',     'DRC Half Marathon',                  'Dallas'),
  H(2009, 'Marathon', 'Metro PCS Dallas Marathon',          'Dallas'),
  H(2010, 'Half',     'DRC Half Marathon',                  'Dallas'),
  H(2010, 'Marathon', 'Metro PCS Dallas Marathon',          'Dallas'),
  H(2011, 'Marathon', 'Boston Marathon',                    'Boston, MA',             { worldMajor: true, highlight: 'First World Major' }),
  H(2012, 'Half',     'Rock N Roll Half Marathon',          'Dallas'),
  H(2012, 'Marathon', 'Metro PCS Dallas Marathon',          'Dallas'),
  H(2013, 'Half',     'Rock N Roll Half Marathon',          'Dallas'),
  H(2013, 'Marathon', 'Big Sur Marathon',                   'Carmel, CA'),
  H(2013, 'Half',     'The Half',                           'Dallas'),
  H(2013, 'Marathon', 'New York Marathon',                  'New York, NY',           { worldMajor: true }),
  H(2013, 'Marathon', 'Metro PCS Dallas Marathon',          'Dallas'),
  H(2014, 'Half',     'Rock N Roll Half Marathon',          'Dallas'),
  H(2014, 'Half',     'Plano Balloon Festival Half',        'Plano, TX'),
  H(2014, 'Marathon', 'Chicago Marathon',                   'Chicago, IL',            { worldMajor: true }),
  H(2014, 'Marathon', 'New York Marathon',                  'New York, NY',           { worldMajor: true }),
  H(2014, 'Marathon', 'Metro PCS Dallas Marathon',          'Dallas'),
  H(2015, 'Half',     'Dallas Half Marathon',               'Dallas'),
  H(2016, 'Marathon', 'OKC Memorial Marathon',              'Oklahoma City, OK'),
  H(2016, 'Marathon', 'Mount Desert Island Marathon',       'Mount Desert Island, ME'),
  H(2016, 'Half',     'BMW Dallas Half Marathon',           'Dallas'),
  H(2017, 'Half',     'BMW Dallas Half Marathon',           'Dallas'),
  H(2017, 'Half',     'Trinity River Levee Half Marathon',  'Dallas'),
  H(2017, 'Marathon', 'Marine Corps Marathon',              'Washington, DC'),
  H(2018, 'Marathon', 'OKC Memorial Marathon',              'Oklahoma City, OK'),
  H(2018, 'Marathon', 'Marine Corps Marathon',              'Washington, DC'),
  H(2018, 'Half',     'BMW Dallas Half Marathon',           'Dallas'),
  H(2019, 'Marathon', 'London Marathon',                    'London, UK',             { worldMajor: true }),
  H(2019, 'Half',     'BMW Dallas Half Marathon',           'Dallas'),
  H(2020, 'Half',     'BMW Dallas Half Marathon (virtual)', 'Dallas'),
  H(2020, '5K',       'BMW Dallas 5K (virtual)',            'Dallas'),
  H(2020, 'Marathon', 'Boston Marathon',                    'Boston, MA',             { worldMajor: true }),
  H(2021, 'Marathon', 'Boston Marathon',                    'Boston, MA',             { worldMajor: true }),
  H(2022, 'Half',     'Charleston Half Marathon',           'Charleston, SC'),
  H(2022, 'Marathon', 'New York Marathon',                  'New York, NY',           { worldMajor: true }),
  H(2022, 'Half',     'Unplugged Half Marathon',            'Burlington, VT'),
  H(2022, 'Half',     'BMW Dallas Half Marathon (virtual)', 'Dallas'),
  H(2023, 'Mixed',    'Too Cold to Handle (Half/10/5)',     'Dallas'),
  H(2023, 'Half',     'Brooklyn Half Marathon',             'Brooklyn, NY',           { highlight: 'Brooklyn course veteran' }),
  H(2023, 'Half',     'BMW Dallas Half Marathon',           'Dallas'),
  H(2024, 'Marathon', 'Eugene Marathon',                    'Eugene, OR'),
  H(2024, 'Half',     'BMW Dallas Half Marathon',           'Dallas'),
  H(2025, 'Marathon', 'Boston Marathon',                    'Boston, MA',             { worldMajor: true }),
  H(2025, 'Marathon', 'Berlin Marathon',                    'Berlin, Germany',        { worldMajor: true, highlight: '5th World Major star' }),
  H(2025, 'Half',     'BMW Dallas Half Marathon',           'Dallas'),
  H(2025, 'Mixed',    'Too Hot to Handle (Half/10/5)',      'Dallas'),
];

export const HELAINE_PRS: PR[] = [
  { event: 'Marathon',      mark: '—',     paceLabel: null, date: '2025-09-21', meet: 'Berlin Marathon (most recent)', isAdult: true },
  { event: 'Half marathon', mark: '2:10:00', paceLabel: '~9:55 / mi', date: '2026-05-16', meet: 'BKH 2026 (goal)',  isAdult: true },
];

// ────────────────────────────────────────────────────────────
// Computed roll-ups
// ────────────────────────────────────────────────────────────

export interface CareerSummary {
  totalRaces: number;
  marathons: number;
  halves: number;
  worldMajors: WorldMajorStar[];
  /** Number of unique world-major *races* completed (1 per major), 0..6. */
  starCount: number;
  firstYear: number;
  /** Number of times the runner placed 1st. */
  wins: number;
}

export type WorldMajorCity = 'Boston' | 'New York' | 'Chicago' | 'Berlin' | 'London' | 'Tokyo';

export interface WorldMajorStar {
  city: WorldMajorCity;
  finishes: number;
  years: number[];
  /** Color for the visual. */
  color: string;
}

const WM_DEFINITIONS: { city: WorldMajorCity; matches: RegExp; color: string }[] = [
  { city: 'Boston',   matches: /Boston/i,        color: '#FFB800' },
  { city: 'New York', matches: /New York/i,      color: '#FF3B30' },
  { city: 'Chicago',  matches: /Chicago/i,       color: '#34C759' },
  { city: 'Berlin',   matches: /Berlin/i,        color: '#5856D6' },
  { city: 'London',   matches: /London/i,        color: '#FF2D55' },
  { city: 'Tokyo',    matches: /Tokyo/i,         color: '#007AFF' },
];

export function summarize(races: Race[]): CareerSummary {
  const wm: Record<WorldMajorCity, WorldMajorStar> = {} as any;
  for (const def of WM_DEFINITIONS) {
    wm[def.city] = { city: def.city, finishes: 0, years: [], color: def.color };
  }

  let firstYear = Infinity;
  let marathons = 0;
  let halves = 0;
  let wins = 0;

  for (const r of races) {
    const yr = +r.date.slice(0, 4);
    if (Number.isFinite(yr)) firstYear = Math.min(firstYear, yr);
    if (r.distance === 'Marathon') marathons++;
    if (r.distance === 'Half') halves++;
    if (r.place === 1) wins++;
    if (r.worldMajor) {
      for (const def of WM_DEFINITIONS) {
        if (def.matches.test(r.name) || def.matches.test(r.location ?? '')) {
          wm[def.city].finishes += 1;
          wm[def.city].years.push(yr);
        }
      }
    }
  }

  const stars = WM_DEFINITIONS.map(d => wm[d.city]);
  return {
    totalRaces: races.length,
    marathons,
    halves,
    worldMajors: stars,
    starCount: stars.filter(s => s.finishes > 0).length,
    firstYear: Number.isFinite(firstYear) ? firstYear : new Date().getFullYear(),
    wins,
  };
}

export const CATHERINE_SUMMARY = summarize(CATHERINE_RACES);
export const HELAINE_SUMMARY   = summarize(HELAINE_RACES);

export function careerFor(runnerId: string): CareerData | null {
  if (runnerId === 'gf')  return { runnerId, bio: 'Saint Rita Spartan (2009-2012). Undefeated XC champion 6th and 8th grade. DPL Varsity City Meet MVP 2012. Adult marathoner: Boston, Berlin, two Brooklyn Halves and counting.', prs: CATHERINE_PRS, races: CATHERINE_RACES };
  if (runnerId === 'mom') return { runnerId, bio: '53 races since 2005. 19 marathons. 5 of 6 World Marathon Major stars (Boston ×3, NYC ×3, Chicago, London, Berlin). Tokyo remains.', prs: HELAINE_PRS, races: HELAINE_RACES };
  return null;
}
