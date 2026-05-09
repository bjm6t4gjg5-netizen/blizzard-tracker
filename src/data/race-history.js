// ============================================================
// race-history.js — Runner race history & stats
// Sample data — replace via Developer tab CSV upload or GitHub Gist
// ============================================================

export const SAMPLE_RACES = {
  gf: [
    { id:'gf-1',  date:'2026-04-14', name:'Boston Marathon',           dist:'26.2', time:'3:22:18', location:'Boston, MA',       type:'marathon' },
    { id:'gf-2',  date:'2025-12-07', name:'Dallas Marathon',            dist:'26.2', time:'3:28:44', location:'Dallas, TX',        type:'marathon' },
    { id:'gf-3',  date:'2025-05-17', name:'RBC Brooklyn Half 2025',     dist:'13.1', time:'1:33:12', location:'Brooklyn, NY',      type:'half' },
    { id:'gf-4',  date:'2025-04-27', name:'Eugene Marathon',             dist:'26.2', time:'3:19:55', location:'Eugene, OR',        type:'marathon' },
    { id:'gf-5',  date:'2024-09-29', name:'Berlin Marathon',             dist:'26.2', time:'3:24:08', location:'Berlin, Germany',   type:'marathon' },
    { id:'gf-6',  date:'2024-05-18', name:'RBC Brooklyn Half 2024',     dist:'13.1', time:'1:31:44', location:'Brooklyn, NY',      type:'half' },
    { id:'gf-7',  date:'2024-04-15', name:'Boston Marathon',            dist:'26.2', time:'3:18:02', location:'Boston, MA',        type:'marathon' },
    { id:'gf-8',  date:'2023-10-08', name:'Chicago Marathon',           dist:'26.2', time:'3:26:33', location:'Chicago, IL',       type:'marathon' },
    { id:'gf-9',  date:'2023-05-20', name:'RBC Brooklyn Half 2023',     dist:'13.1', time:'1:34:01', location:'Brooklyn, NY',      type:'half' },
    { id:'gf-10', date:'2023-04-17', name:'Boston Marathon',            dist:'26.2', time:'3:21:15', location:'Boston, MA',        type:'marathon' },
    { id:'gf-11', date:'2022-11-06', name:'NYC Marathon',               dist:'26.2', time:'3:31:44', location:'New York, NY',      type:'marathon' },
    { id:'gf-12', date:'2022-05-21', name:'Brooklyn Half 2022',         dist:'13.1', time:'1:36:22', location:'Brooklyn, NY',      type:'half' },
    { id:'gf-13', date:'2021-10-10', name:'Chicago Marathon',           dist:'26.2', time:'3:38:11', location:'Chicago, IL',       type:'marathon' },
    { id:'gf-14', date:'2019-11-03', name:'NYC Marathon',               dist:'26.2', time:'3:44:02', location:'New York, NY',      type:'marathon' },
    { id:'gf-15', date:'2019-05-18', name:'Brooklyn Half 2019',         dist:'13.1', time:'1:40:15', location:'Brooklyn, NY',      type:'half' },
  ],
  mom: [
    { id:'mom-1',  date:'2026-04-14', name:'Boston Marathon',           dist:'26.2', time:'4:12:33', location:'Boston, MA',        type:'marathon' },
    { id:'mom-2',  date:'2025-12-07', name:'Dallas Half Marathon',      dist:'13.1', time:'2:08:44', location:'Dallas, TX',        type:'half' },
    { id:'mom-3',  date:'2025-04-27', name:'Eugene Marathon',            dist:'26.2', time:'4:08:17', location:'Eugene, OR',        type:'marathon' },
    { id:'mom-4',  date:'2024-09-29', name:'Berlin Marathon',            dist:'26.2', time:'4:19:55', location:'Berlin, Germany',   type:'marathon' },
    { id:'mom-5',  date:'2024-04-15', name:'Boston Marathon',           dist:'26.2', time:'4:05:22', location:'Boston, MA',        type:'marathon' },
    { id:'mom-6',  date:'2023-11-05', name:'NYC Marathon',              dist:'26.2', time:'4:22:01', location:'New York, NY',      type:'marathon' },
    { id:'mom-7',  date:'2023-04-17', name:'Boston Marathon',           dist:'26.2', time:'4:14:38', location:'Boston, MA',        type:'marathon' },
    { id:'mom-8',  date:'2022-10-09', name:'Chicago Marathon',          dist:'26.2', time:'4:28:55', location:'Chicago, IL',       type:'marathon' },
    { id:'mom-9',  date:'2022-04-18', name:'Boston Marathon',           dist:'26.2', time:'4:16:11', location:'Boston, MA',        type:'marathon' },
    { id:'mom-10', date:'2021-10-10', name:'Chicago Marathon',          dist:'26.2', time:'4:33:44', location:'Chicago, IL',       type:'marathon' },
    { id:'mom-11', date:'2019-11-03', name:'NYC Marathon',              dist:'26.2', time:'4:41:22', location:'New York, NY',      type:'marathon' },
    { id:'mom-12', date:'2018-04-16', name:'Boston Marathon',           dist:'26.2', time:'4:38:07', location:'Boston, MA',        type:'marathon' },
  ],
};

// CSV template headers
export const CSV_HEADERS = ['runner_id','date','name','dist','time','location','type'];

// Derive PRs from race history
export function computePRs(races) {
  const prs = { marathon: null, half: null, '10k': null, '5k': null };
  races.forEach(r => {
    const key = r.type === 'marathon' ? 'marathon' : r.type === 'half' ? 'half' : r.type;
    if (prs[key] === null || timeToSec(r.time) < timeToSec(prs[key].time)) {
      prs[key] = r;
    }
  });
  return prs;
}

// Compute career totals
export function computeCareerTotals(races) {
  const totalRaces = races.length;
  const totalMiles = races.reduce((s, r) => s + parseFloat(r.dist), 0);
  const totalSec   = races.reduce((s, r) => s + timeToSec(r.time), 0);
  const avgPaceSec = totalSec / Math.max(totalMiles, 1);
  const marathons  = races.filter(r => r.type === 'marathon').length;
  const halfs      = races.filter(r => r.type === 'half').length;
  return { totalRaces, totalMiles: Math.round(totalMiles), totalSec, avgPaceSec, marathons, halfs };
}

export function timeToSec(t) {
  if (!t) return 999999;
  const p = t.split(':').map(Number);
  if (p.length === 3) return p[0]*3600 + p[1]*60 + p[2];
  if (p.length === 2) return p[0]*60 + p[1];
  return 999999;
}

export function fmtPaceFromSec(sec, dist) {
  const p = sec / parseFloat(dist);
  const m = Math.floor(p/60), s = Math.floor(p%60);
  return `${m}:${String(s).padStart(2,'0')}/mi`;
}

// Load races: from localStorage (dev uploads) or fall back to sample data
export function loadRaces(id) {
  try {
    const s = localStorage.getItem('blizzard_races_' + id);
    if (s) return JSON.parse(s);
  } catch {}
  return (SAMPLE_RACES[id] || []).slice();
}

export function saveRaces(id, races) {
  localStorage.setItem('blizzard_races_' + id, JSON.stringify(races));
}

// Parse CSV string into race objects
export function parseCSV(csvStr) {
  const lines = csvStr.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,''));
  return lines.slice(1).map((line, idx) => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g,''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] || '');
    if (!obj.id) obj.id = 'r_' + Date.now() + '_' + idx;
    return obj;
  }).filter(r => r.date && r.name);
}

// Generate CSV string from race array
export function racesToCSV(races) {
  const hdr = CSV_HEADERS.join(',');
  const rows = races.map(r => CSV_HEADERS.map(h => `"${r[h]||''}"`).join(','));
  return [hdr, ...rows].join('\n');
}
