// ============================================================
// runners.js — Runner state, goals, non-linear predictions
// ============================================================
import { MILE_PACE_FACTORS, CHECKPOINTS, ELEVATION } from './course.js';

export const TOTAL_MI = 13.1;
export const RACE_START = new Date('2026-05-16T07:00:00');

// ── Default registry ─────────────────────────────────────
const DEFAULT_REGISTRY = [
  { id:'gf',  name:'Catherine Blizzard', trackId:'RMGBEVSK', emoji:'💙', color:'#007AFF', fixed:true },
  { id:'mom', name:'Helaine Blizzard',   trackId:'RRM2PLD3', emoji:'⚡', color:'#5856D6', fixed:true },
];

export function loadRegistry() {
  try { const s=localStorage.getItem('blizzard_registry2'); if(s) return JSON.parse(s); } catch{}
  return structuredClone(DEFAULT_REGISTRY);
}
export function saveRegistry(reg) {
  localStorage.setItem('blizzard_registry2', JSON.stringify(reg));
}

// ── Per-runner goals (persisted separately) ──────────────
export const DEFAULT_GOALS = {
  gf: {
    goalTime:       90*60,        // 1:30:00 target finish
    goalLabel:      'Sub-90',
    mile5kPace:     6*60+40,      // 6:40/mi target at 5K
    mile10kPace:    6*60+45,      // slightly slower at 10K
    mile15kPace:    6*60+50,
    mileFinishPace: 6*60+30,      // kick at finish
    // custom split goals [mi, targetElapsedSec]
    splitGoals: [
      { label:'5K',    mi:3.1,  targetSec: 20*60+45 },
      { label:'10K',   mi:6.2,  targetSec: 41*60+55 },
      { label:'15K',   mi:9.3,  targetSec: 63*60+30 },
      { label:'Finish',mi:13.1, targetSec: 90*60    },
    ],
    scenarios: [
      { key:'dream',  label:'Dream Day',    emoji:'🌟', color:'#34C759', flatPace:6*60+10, desc:'Everything clicks, negative split' },
      { key:'goal',   label:'Sub-90 Goal',  emoji:'🎯', color:'#007AFF', flatPace:null,    desc:'Elevation-adjusted ~6:52/mi flat eq.' },
      { key:'good',   label:'Strong Day',   emoji:'💪', color:'#5856D6', flatPace:7*60+0,  desc:'Solid race, slight fade late' },
      { key:'tough',  label:'Tough Day',    emoji:'😅', color:'#FF9500', flatPace:7*60+30, desc:'Warm/crowded, conservative finish' },
      { key:'runwalk',label:'Run/Walk',     emoji:'🚶', color:'#FF3B30', flatPace:8*60+30, desc:'Backup plan, guaranteed finish' },
    ],
  },
  mom: {
    goalTime:       130*60,       // 2:10:00
    goalLabel:      'Sub-2:10',
    mile5kPace:     10*60+0,
    mile10kPace:    10*60+15,
    mile15kPace:    10*60+30,
    mileFinishPace: 9*60+45,
    splitGoals: [
      { label:'5K',    mi:3.1,  targetSec: 31*60+0  },
      { label:'10K',   mi:6.2,  targetSec: 63*60+0  },
      { label:'15K',   mi:9.3,  targetSec: 96*60+0  },
      { label:'Finish',mi:13.1, targetSec: 130*60   },
    ],
    scenarios: [
      { key:'dream',  label:'Best Day',     emoji:'🌟', color:'#34C759', flatPace:9*60+30,  desc:'Everything goes right' },
      { key:'goal',   label:'Sub-2:10',     emoji:'🎯', color:'#5856D6', flatPace:null,     desc:'Goal pace, elevation-adjusted' },
      { key:'good',   label:'Strong Day',   emoji:'💪', color:'#007AFF', flatPace:10*60+30, desc:'Comfortable steady effort' },
      { key:'tough',  label:'Tough Day',    emoji:'😅', color:'#FF9500', flatPace:11*60+30, desc:'Slower second half' },
      { key:'runwalk',label:'Run/Walk',     emoji:'🚶', color:'#FF3B30', flatPace:13*60+0,  desc:'Easy finish' },
    ],
  },
};

export function loadGoals(id) {
  try {
    const s = localStorage.getItem('blizzard_goals_' + id);
    if (s) return { ...DEFAULT_GOALS[id] || DEFAULT_GOALS.gf, ...JSON.parse(s) };
  } catch {}
  return structuredClone(DEFAULT_GOALS[id] || DEFAULT_GOALS.gf);
}
export function saveGoals(id, goals) {
  localStorage.setItem('blizzard_goals_' + id, JSON.stringify(goals));
}

// ── Non-linear pace profile using Riegel fatigue + elevation ─
// Riegel: T2 = T1 * (D2/D1)^1.06
// We model pace as varying by mile based on:
//  1. Elevation grade (from ELEVATION data)
//  2. Fatigue factor (Riegel-based, increases after mile 8)
//  3. Crowd/start effect (first mile slower)
//  4. Race plan (milestone paces if set)
export function buildNonLinearProfile(goals, flatPaceSecPerMile, simPct = 100) {
  const simMi = (simPct / 100) * TOTAL_MI;
  const MILE_MARKERS = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,13.1];

  // Per-mile grade penalty from elevation data
  function gradeFactorForMile(mileStart, mileEnd) {
    const elevsInRange = ELEVATION.filter(e => e.mi >= mileStart && e.mi <= mileEnd);
    if (elevsInRange.length < 2) return 1.0;
    const rise = elevsInRange.at(-1).ft - elevsInRange[0].ft;
    const dist  = (mileEnd - mileStart) * 5280; // feet
    const grade = rise / dist; // decimal grade
    // GAP formula: each 1% grade ≈ +10-12 sec/mi uphill, -6 sec/mi downhill
    return 1 + (grade * 100 * (grade > 0 ? 0.12 : 0.06));
  }

  // Riegel fatigue factor: pace degrades ~1.06 exponent
  function fatigueFactor(mi) {
    if (mi < 1) return 1.05;  // crowd at start
    if (mi < 3) return 1.01;  // settling in
    if (mi < 8) return 1.00;  // cruise
    if (mi < 11) return 1.02; // accumulating fatigue
    if (mi < 12.5) return 1.04; // late race
    return 0.98; // finishing kick
  }

  let cum = 0;
  const pts = [{ mi: 0, sec: 0 }];

  for (let i = 0; i < MILE_PACE_FACTORS.length; i++) {
    const mStart = MILE_MARKERS[i];
    const mEnd   = MILE_MARKERS[i + 1];
    const seg    = mEnd - mStart;
    const grade  = gradeFactorForMile(mStart, mEnd);
    const fat    = fatigueFactor(mStart);
    const pace   = flatPaceSecPerMile * grade * fat;
    cum += pace * seg;
    pts.push({ mi: mEnd, sec: cum });
  }

  // Trim to simPct if simulating
  return pts.filter(p => p.mi <= simMi + 0.05);
}

// Build goal pace (binary search for flat pace that hits goalTime)
export function buildGoalProfile(goals, simPct = 100) {
  const TARGET = goals.goalTime;
  let lo = 250, hi = 800;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const tot = buildNonLinearProfile(goals, mid, 100).at(-1)?.sec || 9999;
    if (tot < TARGET) lo = mid; else hi = mid;
  }
  return buildNonLinearProfile(goals, (lo + hi) / 2, simPct);
}

// Build split-goal waypoints (for the target line on chart)
export function buildSplitGoalLine(goals) {
  return goals.splitGoals.map(sg => ({ x: sg.mi, y: sg.targetSec / 60 }));
}

// ── Runner state factory ─────────────────────────────────
export function makeRunnerState(reg) {
  return {
    id: reg.id, name: reg.name, trackId: reg.trackId,
    emoji: reg.emoji, color: reg.color,
    distMi: 0, elapsedSec: 0, splits: [], status: 'pre',
    pct: 0, etaSec: null, conf: 0, lastUpdate: null,
    paceHistory: [], // { mi, elapsedSec } — actual GPS checkpoints
  };
}

// ── ETA — uses non-linear projection from current position ─
export function computeETA(state, goals) {
  if (state.distMi < 0.5 || state.elapsedSec < 60) return;
  const currentPace = state.elapsedSec / state.distMi;
  // Project remaining with elevation + fatigue adjustments
  const remaining = buildNonLinearProfile(goals, currentPace, 100)
    .filter(p => p.mi > state.distMi);
  if (!remaining.length) { state.etaSec = state.elapsedSec; return; }
  // Find elapsed at current position on the profile
  const profile = buildNonLinearProfile(goals, currentPace, 100);
  const atNow = profile.find(p => p.mi >= state.distMi)?.sec || 0;
  const atEnd = profile.at(-1)?.sec || 0;
  state.etaSec = Math.round(state.elapsedSec + (atEnd - atNow));
  state.conf   = Math.round(Math.min(95, (state.pct / 100) * 85 + 10));
}

// ── Field distribution ───────────────────────────────────
export const FIELD_CDF = [
  [4800,1],[5400,3],[5700,6],[6000,11],[6300,18],[6600,26],[6900,35],
  [7200,45],[7500,54],[7800,62],[8100,69],[8400,75],[8700,80],
  [9000,85],[9600,90],[10200,94],[10800,97],[11400,99],
];
export function getPercentile(sec) {
  for (let i = 0; i < FIELD_CDF.length - 1; i++) {
    if (sec <= FIELD_CDF[i][0]) return 100 - FIELD_CDF[i][1];
    if (sec <= FIELD_CDF[i+1][0]) {
      const t=(sec-FIELD_CDF[i][0])/(FIELD_CDF[i+1][0]-FIELD_CDF[i][0]);
      return Math.round(100-(FIELD_CDF[i][1]+(FIELD_CDF[i+1][1]-FIELD_CDF[i][1])*t));
    }
  }
  return 1;
}

// ── RTRT fetch ───────────────────────────────────────────
export async function fetchRunnerData(state) {
  const url = `https://rtrt.me/bkh2026/track/${state.trackId}`;
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxy, { cache:'no-store' });
    const json = await res.json();
    return parseRTRT(state, json.contents || '');
  } catch { return false; }
}
function parseRTRT(state, html) {
  let changed = false;
  const tm = html.match(/(\d{1,2}):(\d{2}):(\d{2})/);
  if (tm) { const s=+tm[1]*3600+ +tm[2]*60+ +tm[3]; if(s>0&&s<20000){state.elapsedSec=s;changed=true;} }
  const dm = html.match(/(\d+\.\d+)\s*mi/i)||html.match(/(\d+\.\d+)\s*mile/i);
  if (dm) { state.distMi=Math.min(+dm[1],TOTAL_MI); changed=true; }
  const km = html.match(/(\d+\.\d+)\s*km/i);
  if (km&&!dm) { state.distMi=Math.min(+km[1]*.621371,TOTAL_MI); changed=true; }
  if (changed||state.distMi>0) {
    state.status=state.distMi>=TOTAL_MI-.1?'finished':(state.distMi>0||state.elapsedSec>0)?'running':'pre';
    state.pct=(state.distMi/TOTAL_MI)*100;
    state.lastUpdate=Date.now();
    if (state.distMi>0) state.paceHistory.push({ mi:state.distMi, elapsedSec:state.elapsedSec });
    return true;
  }
  return false;
}

// ── Time utils ───────────────────────────────────────────
export function fmtHMS(sec) {
  if (!sec||sec<=0) return '—';
  const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=Math.floor(sec%60);
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
export function fmtPace(sec, dist) {
  if (!dist||dist<.1) return '—';
  const t=sec/dist,m=Math.floor(t/60),s=Math.floor(t%60);
  return `${m}:${String(s).padStart(2,'0')}`;
}
export function parsePaceStr(str) {
  const p=str.trim().split(':').map(Number);
  if (p.length===2&&!isNaN(p[0])&&!isNaN(p[1])) return p[0]*60+p[1];
  return null;
}
export function secToHMS(sec) { return fmtHMS(sec); }
export function fmtGoalTime(sec) {
  const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=Math.floor(sec%60);
  if(h>0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
