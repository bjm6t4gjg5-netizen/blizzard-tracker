// ============================================================
// runners.js — State management for all runners
// ============================================================

import { MILE_PACE_FACTORS } from './course.js';

const TOTAL_MI = 13.1;
const RACE_START = new Date('2026-05-16T07:00:00'); // EST

// ── Default registry ──────────────────────────────────────
const DEFAULT_REGISTRY = [
  { id: 'gf',  name: 'Catherine Blizzard', trackId: 'RMGBEVSK', emoji: '⚡', color: '#0ea5e9', fixed: true },
  { id: 'mom', name: 'Helaine Blizzard',   trackId: 'RRM2PLD3', emoji: '💜', color: '#7c3aed', fixed: true },
];

export function loadRegistry() {
  try {
    const s = localStorage.getItem('blizzard_registry');
    if (s) return JSON.parse(s);
  } catch {}
  return structuredClone(DEFAULT_REGISTRY);
}

export function saveRegistry(registry) {
  localStorage.setItem('blizzard_registry', JSON.stringify(registry));
}

// ── Initial state factory ─────────────────────────────────
export function makeRunnerState(reg) {
  return {
    id:         reg.id,
    name:       reg.name,
    trackId:    reg.trackId,
    emoji:      reg.emoji,
    color:      reg.color,
    distMi:     0,
    elapsedSec: 0,
    splits:     [],   // [{ label, chipTime, pace }]
    status:     'pre', // pre | running | finished
    pct:        0,
    etaSec:     null,
    conf:       0,
    lastUpdate: null,
    // Pace history for live chart (array of { mi, paceSec })
    paceHistory: [],
  };
}

// ── ETA computation ───────────────────────────────────────
export function computeETA(state) {
  if (state.distMi < 0.5 || state.elapsedSec < 60) return;
  const currentPace = state.elapsedSec / state.distMi; // sec/mi so far
  // Project remaining miles with elevation factors
  const miDone = Math.floor(state.distMi);
  let remaining = 0;
  for (let i = miDone; i < MILE_PACE_FACTORS.length; i++) {
    const segMi = i < 13 ? 1 : 0.1;
    remaining += currentPace * MILE_PACE_FACTORS[i] * segMi;
  }
  // Partial current mile already covered
  const partialDone = (state.distMi - miDone) * currentPace;
  state.etaSec = Math.round(state.elapsedSec - partialDone + remaining + partialDone);
  // Simpler version: just project current avg pace
  state.etaSec = Math.round((state.elapsedSec / state.distMi) * TOTAL_MI);
  state.conf = Math.round(Math.min(95, (state.pct / 100) * 85 + 10));
}

// ── Field distribution (2025 BK Half) ────────────────────
export const FIELD_CDF = [
  [4800, 1], [5400, 3], [5700, 6], [6000, 11], [6300, 18],
  [6600, 26], [6900, 35], [7200, 45], [7500, 54], [7800, 62],
  [8100, 69], [8400, 75], [8700, 80], [9000, 85], [9600, 90],
  [10200, 94], [10800, 97], [11400, 99],
];

export function getPercentile(totalSec) {
  for (let i = 0; i < FIELD_CDF.length - 1; i++) {
    if (totalSec <= FIELD_CDF[i][0]) return 100 - FIELD_CDF[i][1];
    if (totalSec <= FIELD_CDF[i + 1][0]) {
      const t = (totalSec - FIELD_CDF[i][0]) / (FIELD_CDF[i + 1][0] - FIELD_CDF[i][0]);
      return Math.round(100 - (FIELD_CDF[i][1] + (FIELD_CDF[i + 1][1] - FIELD_CDF[i][1]) * t));
    }
  }
  return 1;
}

// ── Scenario builder ──────────────────────────────────────
export function buildPaceProfile(flatPaceSecPerMile) {
  let cum = 0;
  const pts = [{ mi: 0, sec: 0 }];
  for (let i = 0; i < MILE_PACE_FACTORS.length; i++) {
    const seg = i < 13 ? 1 : 0.1;
    cum += flatPaceSecPerMile * MILE_PACE_FACTORS[i] * seg;
    pts.push({ mi: [1,2,3,4,5,6,7,8,9,10,11,12,13,13.1][i], sec: cum });
  }
  return pts;
}

export function build90MinTarget() {
  const TARGET = 5400;
  let lo = 350, hi = 600;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const tot = buildPaceProfile(mid).at(-1).sec;
    if (tot < TARGET) lo = mid; else hi = mid;
  }
  return buildPaceProfile((lo + hi) / 2);
}

export const PROFILE_90 = build90MinTarget();

export const GF_SCENARIOS = [
  { key: 'best',   label: 'Best Day',       emoji: '🔥', color: '#059669', flatPace: 6 * 60 + 25 },
  { key: 'on90',   label: 'Sub-90 Target',  emoji: '🎯', color: '#0ea5e9', flatPace: null }, // uses PROFILE_90
  { key: 'tough',  label: 'Tough Day',      emoji: '😅', color: '#d97706', flatPace: 7 * 60 + 15 },
  { key: 'walk',   label: 'Conservative',   emoji: '🚶', color: '#7c3aed', flatPace: 7 * 60 + 50 },
];

export const MOM_SCENARIOS = [
  { key: 'best',   label: 'Best Day',    emoji: '🔥', color: '#059669', flatPace: 10 * 60 + 0  },
  { key: 'target', label: 'Target',      emoji: '🎯', color: '#7c3aed', flatPace: 11 * 60 + 30 },
  { key: 'tough',  label: 'Tough Day',   emoji: '😅', color: '#d97706', flatPace: 12 * 60 + 30 },
  { key: 'walk',   label: 'Run/Walk',    emoji: '🚶', color: '#94a3b8', flatPace: 13 * 60 + 30 },
];

export function scenarioFinishSec(s) {
  const profile = s.flatPace ? buildPaceProfile(s.flatPace) : PROFILE_90;
  return Math.round(profile.at(-1).sec);
}

// ── RTRT live fetch ───────────────────────────────────────
export async function fetchRunnerData(state) {
  const url = `https://rtrt.me/bkh2026/track/${state.trackId}`;
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxy, { cache: 'no-store' });
    const json = await res.json();
    return parseRTRT(state, json.contents || '');
  } catch {
    return false;
  }
}

function parseRTRT(state, html) {
  let changed = false;
  const tm = html.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (tm) {
    const s = +tm[1] * 3600 + +tm[2] * 60 + +tm[3];
    if (s > 0 && s < 20000) { state.elapsedSec = s; changed = true; }
  }
  const dm = html.match(/(\d+\.\d+)\s*mi/i) || html.match(/(\d+\.\d+)\s*mile/i);
  if (dm) { state.distMi = Math.min(+dm[1], TOTAL_MI); changed = true; }
  const km = html.match(/(\d+\.\d+)\s*km/i);
  if (km && !dm) { state.distMi = Math.min(+km[1] * 0.621371, TOTAL_MI); changed = true; }

  if (changed || state.distMi > 0) {
    state.status = state.distMi >= TOTAL_MI - 0.1
      ? 'finished'
      : (state.distMi > 0 || state.elapsedSec > 0) ? 'running' : 'pre';
    state.pct = (state.distMi / TOTAL_MI) * 100;
    state.lastUpdate = Date.now();
    // Track pace history
    if (state.distMi > 0) {
      state.paceHistory.push({ mi: state.distMi, paceSec: state.elapsedSec / state.distMi });
    }
    computeETA(state);
    return true;
  }
  return false;
}

// ── Time utils (used everywhere) ─────────────────────────
export function fmtHMS(sec) {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec % 3600 / 60);
  const s = Math.floor(sec % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtPace(sec, dist) {
  if (!dist || dist < 0.1) return '—';
  const t = sec / dist;
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}
