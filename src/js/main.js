// ============================================================
// main.js — Blizzard Tracker
// ============================================================
import '../css/main.css';
import { COURSE, COURSE_LATLNGS, CHECKPOINTS, ELEVATION, MILE_PACE_FACTORS,
         SPECTATOR_SPOTS } from '../data/course.js';
import { loadRegistry, saveRegistry, makeRunnerState, computeETA,
         getPercentile, buildPaceProfile, PROFILE_90,
         GF_SCENARIOS, MOM_SCENARIOS, scenarioFinishSec,
         fetchRunnerData, fmtHMS, fmtPace, FIELD_CDF } from '../data/runners.js';
import { fetchWeather, getRaceDayHours, getCurrentHourIndex,
         extractHourData, getWeatherIcon, analyzeRaceImpact } from '../data/weather.js';

const L = window.L;
const Chart = window.Chart;
const TOTAL_MI = 13.1;
const RACE_START = new Date('2026-05-16T07:00:00');

// ── State ────────────────────────────────────────────────
let REG = loadRegistry();
const STATE = {};
REG.forEach(r => { STATE[r.id] = makeRunnerState(r); });

let fullMap = null, mapInited = false;
const miniMaps = {};   // id → leaflet map
const markers  = {};   // id → leaflet marker (full map)
const miniMarkers = {}; // id → leaflet marker (mini map)
let wxLoaded = false, wxData = null;
const charts = {};
let lastRefresh = null;

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildTabs();
  buildPanes();
  renderAll();
  initCharts();
  renderPctScenarios();
  initSimulators();
  startAutoRefresh();
  doRefresh();
  setInterval(updateClock, 1000);
  setInterval(updateRefreshLabel, 5000);
  updateClock();
  requestNotificationPermission();
});

// ═══════════════════════════════════════════════════════════
// TABS — drag-and-drop
// ═══════════════════════════════════════════════════════════
const FIXED_TABS = ['gf','mom','family','map','weather','stats'];
let tabOrder = (() => {
  try { return JSON.parse(localStorage.getItem('blizzard_tab_order')) || [...FIXED_TABS]; }
  catch { return [...FIXED_TABS]; }
})();
const saveTabOrder = () => localStorage.setItem('blizzard_tab_order', JSON.stringify(tabOrder));

function buildTabs() {
  const bar = document.getElementById('tab-bar');
  bar.innerHTML = '';
  const toRender = tabOrder.filter(id =>
    FIXED_TABS.includes(id) || REG.find(r => r.id === id)
  );
  REG.filter(r => !r.fixed && !tabOrder.includes(r.id))
     .forEach(r => toRender.push(r.id));
  toRender.forEach(id => bar.appendChild(makeTab(id)));
  const add = document.createElement('div');
  add.className = 'tab-add-btn'; add.textContent = '⊕'; add.title = 'Manage runners';
  add.onclick = openSettings; bar.appendChild(add);
  setupDragDrop();
}

const TAB_META = {
  gf:      '⚡ Catherine', mom: '💜 Helaine', family: '🏠 Family HQ',
  map:     '🗺 Live Map',  weather: '🌤 Weather', stats: '📊 Stats',
};
function makeTab(id) {
  const r = REG.find(r => r.id === id);
  const label = TAB_META[id] || `${r?.emoji||'🏃'} ${r?.name?.split(' ')[0]||id}`;
  const el = document.createElement('div');
  el.className = 'tab'; el.id = 'tab-' + id;
  el.draggable = true; el.setAttribute('data-tab-id', id);
  el.innerHTML = label;
  if (r && !r.fixed) {
    const x = document.createElement('span');
    x.className = 'tab-x'; x.textContent = '✕';
    x.onclick = e => { e.stopPropagation(); removeRunner(id); };
    el.appendChild(x);
  }
  el.addEventListener('click', () => showTab(id));
  return el;
}

function setupDragDrop() {
  const bar = document.getElementById('tab-bar');
  let dragging = null;
  bar.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('dragstart', e => {
      dragging = tab; tab.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    tab.addEventListener('dragend', () => {
      tab.classList.remove('dragging');
      bar.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
      tabOrder = [...bar.querySelectorAll('.tab')].map(t => t.getAttribute('data-tab-id'));
      saveTabOrder();
    });
    tab.addEventListener('dragover', e => {
      e.preventDefault();
      if (tab !== dragging) {
        tab.classList.add('drag-over');
        const mid = tab.getBoundingClientRect().left + tab.getBoundingClientRect().width / 2;
        bar.insertBefore(dragging, e.clientX < mid ? tab : tab.nextSibling);
      }
    });
    tab.addEventListener('dragleave', () => tab.classList.remove('drag-over'));
  });
}

function showTab(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + id)?.classList.add('active');
  document.getElementById('pane-' + id)?.classList.add('active');
  if (id === 'map' && !mapInited) initFullMap();
  if (id === 'weather' && !wxLoaded) loadWeather();
  // Invalidate mini-maps when their pane becomes visible
  setTimeout(() => {
    if (miniMaps[id]) miniMaps[id].invalidateSize();
    if (id === 'map' && fullMap) fullMap.invalidateSize();
  }, 50);
}

// ═══════════════════════════════════════════════════════════
// PANES — dynamic runner panes
// ═══════════════════════════════════════════════════════════
function buildPanes() {
  const main = document.querySelector('main');
  REG.filter(r => !r.fixed).forEach(r => {
    if (!document.getElementById('pane-' + r.id)) {
      main.insertBefore(makeDynPane(r), document.getElementById('pane-family'));
    }
  });
}

function makeDynPane(r) {
  const el = document.createElement('div');
  el.className = 'pane'; el.id = 'pane-' + r.id;
  const init = r.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  el.innerHTML = runnerPaneHTML(r.id, r.name, init, r.trackId, r.emoji, r.color, r.color);
  STATE[r.id] = makeRunnerState(r);
  return el;
}

function runnerPaneHTML(id, name, initials, trackId, emoji, color, color2) {
  return `
<div class="grid-2" style="align-items:start">
  <div>
    <div class="runner-header-card">
      <div class="runner-top-bar">
        <div class="avatar" style="background:${color}18;color:${color};border:1.5px solid ${color}35">${initials}</div>
        <div><div class="runner-name">${name}</div><div class="runner-sub">Tracker · ${trackId}</div></div>
        <div id="${id}-pill" class="status-badge status-pre"><span class="status-dot"></span>Pre-race</div>
      </div>
      <div class="stats-row">
        <div class="stat-cell"><div class="stat-label">Distance</div><div class="stat-num" id="${id}-dist" style="color:${color}">—</div><div class="stat-unit">of 13.1 mi</div></div>
        <div class="stat-cell"><div class="stat-label">Elapsed</div><div class="stat-num" id="${id}-elapsed" style="color:${color}">—</div><div class="stat-unit">HH:MM:SS</div></div>
        <div class="stat-cell"><div class="stat-label">Avg Pace</div><div class="stat-num" id="${id}-pace" style="color:${color}">—</div><div class="stat-unit">min/mi</div></div>
      </div>
      <div class="progress-section">
        <div class="progress-labels"><span>Brooklyn Museum</span><span id="${id}-pct-lbl">0%</span></div>
        <div class="progress-track"><div class="progress-fill" id="${id}-bar" style="background:${color};width:0%"></div></div>
        <div class="cp-row" id="${id}-cps"></div>
      </div>
      <div class="splits-section">
        <div class="splits-label">Checkpoint Splits</div>
        <table class="splits-table">
          <colgroup><col class="col-cp"><col class="col-time"><col class="col-pace"></colgroup>
          <thead><tr><th>Checkpoint</th><th>Clock Time</th><th>Pace</th></tr></thead>
          <tbody id="${id}-splits"><tr><td class="split-empty" colspan="3">Race starts May 16 — splits populate live</td></tr></tbody>
        </table>
      </div>
    </div>
    <!-- Mini map on runner card -->
    <div class="mini-map-wrap gap-md">
      <div class="card-header"><div class="card-title">📍 Live Position</div></div>
      <div id="mini-map-${id}" class="mini-map"></div>
    </div>
  </div>
  <div>
    <div id="${id}-on-track" class="on-track-banner on-track-neutral gap-md" style="display:none"></div>
    <div class="eta-card gap-md">
      <div class="eta-inner">
        <div class="eta-icon">${emoji}</div>
        <div>
          <div class="eta-label" style="color:${color}">Predicted Finish</div>
          <div class="eta-time" id="${id}-eta" style="color:${color}">—:—:—</div>
          <div class="eta-sub" id="${id}-eta-sub">Waiting for live data…</div>
        </div>
        <div class="eta-right">
          <div class="eta-conf" id="${id}-conf" style="color:${color}">—</div>
          <div class="eta-conf-label">% confidence</div>
        </div>
      </div>
    </div>
    <div class="card gap-md">
      <div class="card-header"><div class="card-title">📍 Arrival at spectator spots</div></div>
      <div id="${id}-eta-spots" class="eta-spots-row">
        <div style="padding:12px 14px;font-size:12px;color:var(--text-tertiary)">Available once race starts</div>
      </div>
    </div>
    <div class="section-title" style="margin-top:4px">Scenarios</div>
    <div class="sc-grid gap-md" id="${id}-sc-grid"></div>
    <button class="cheer-btn gap-md" id="cheer-btn-${id}" onclick="sendCheer('${id}')">
      <span>📣</span> Send Cheer to ${name.split(' ')[0]}
    </button>
    <div class="card gap-md">
      <div class="card-header">
        <div class="card-title">Pace on course · scenarios${id==='gf'?' vs sub-90 goal':''}</div>
        <button class="btn btn-sm btn-ghost" style="margin-left:auto" onclick="charts['${id}-pace']?.resetZoom()">Reset zoom</button>
      </div>
      <div class="chart-wrap">
        <div id="${id}-pace-legend" class="chart-legend"></div>
        <div style="position:relative;height:240px"><canvas id="${id}-pace-chart"></canvas></div>
      </div>
      <div id="${id}-sc-badges" class="badge-row"></div>
    </div>
    <!-- Simulator on runner page -->
    ${simHTML(id, color)}
  </div>
</div>
<div id="upd-${id}" style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:6px;font-family:var(--font-mono)">—</div>`;
}

function simHTML(id, color) {
  return `
<div class="sim-section gap-md">
  <div class="sim-title">
    🎮 Race Simulator
    <span style="font-size:10px;font-weight:400;color:var(--text-muted)">Drag to simulate · locks to live position during race</span>
  </div>
  <div class="sim-controls">
    <button class="btn btn-sm" id="${id}-sim-play">▶ Play</button>
    <button class="btn btn-sm btn-ghost" id="${id}-sim-reset">↺</button>
    <input type="range" id="${id}-sim-slider" class="sim-slider" min="0" max="100" step="0.1" value="0"
      style="background:linear-gradient(to right,${color} 0%,rgba(14,165,233,.15) 0%)">
    <div class="sim-stat"><div class="sim-stat-val" id="${id}-sim-pct" style="color:${color}">0%</div><div class="sim-stat-lbl">Progress</div></div>
    <div class="sim-stat"><div class="sim-stat-val" id="${id}-sim-mi" style="color:${color}">0.0 mi</div><div class="sim-stat-lbl">Distance</div></div>
  </div>
  <div id="${id}-sim-track" class="on-track-banner on-track-neutral" style="font-size:12px;padding:8px 12px;margin-bottom:8px">
    Drag the slider to simulate the race
  </div>
  <div id="${id}-sim-rows" style="display:flex;flex-direction:column"></div>
</div>`;
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderAll() { REG.forEach(r => renderRunner(r.id)); }

function renderRunner(id) {
  const s = STATE[id]; if (!s) return;
  const pct = Math.min(100, s.pct);
  const r = REG.find(r => r.id === id);

  set(id+'-dist',    s.distMi > 0 ? s.distMi.toFixed(2) : '—');
  set(id+'-elapsed', fmtHMS(s.elapsedSec));
  set(id+'-pace',    fmtPace(s.elapsedSec, s.distMi));
  set(id+'-pct-lbl', pct.toFixed(1) + '%');
  const bar = document.getElementById(id+'-bar');
  if (bar) bar.style.width = pct + '%';

  const pill = document.getElementById(id+'-pill');
  if (pill) {
    const { cls, label } = statusInfo(s.status);
    pill.className = 'status-badge ' + cls;
    pill.innerHTML = `<span class="status-dot"></span>${label}`;
  }

  if (s.etaSec) {
    set(id+'-eta', fmtHMS(s.etaSec));
    const fin = new Date(RACE_START.getTime() + s.etaSec * 1000);
    set(id+'-eta-sub', 'Est: ' + fin.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}));
    set(id+'-conf', s.conf + '%');
  }

  updateOnTrack(id);
  updateETASpots(id);

  const cps = document.getElementById(id+'-cps');
  if (cps) cps.innerHTML = CHECKPOINTS.map(cp =>
    `<div class="cp-dot${pct>=(cp.mi/TOTAL_MI*100)?' hit':''}" style="left:${cp.mi/TOTAL_MI*100}%"></div>
     <div class="cp-lbl" style="left:${cp.mi/TOTAL_MI*100}%">${cp.label}</div>`
  ).join('');

  if (s.splits.length) {
    const tb = document.getElementById(id+'-splits');
    if (tb) tb.innerHTML = s.splits.map(sp =>
      `<tr><td>${sp.label}</td><td>${sp.chipTime}</td><td>${sp.pace}/mi</td></tr>`
    ).join('');
  }

  // Family
  if (id === 'gf' || id === 'mom') {
    const k = id;
    set('fam-'+k+'-st', statusInfo(s.status).label);
    set('fam-'+k+'-d',  s.distMi > 0 ? s.distMi.toFixed(2)+' mi' : '—');
    set('fam-'+k+'-e',  fmtHMS(s.elapsedSec));
    set('fam-'+k+'-p',  fmtPace(s.elapsedSec,s.distMi) !== '—' ? fmtPace(s.elapsedSec,s.distMi)+'/mi' : '—');
    set('fam-'+k+'-eta',s.etaSec ? fmtHMS(s.etaSec) : '—');
    updateLeadBanner();
  }

  set('upd-'+id, 'Updated '+new Date().toLocaleTimeString());
  if (mapInited && pct > 0) updateMarker(id, pct);
  updateMiniMarker(id, pct);
  updateLiveChart(id);
  updateSimTrack(id);
  checkNotifications(id, s);
}

function statusInfo(status) {
  if (status==='running')  return {cls:'status-running', label:'Running ▲'};
  if (status==='finished') return {cls:'status-finished',label:'Finished! 🎉'};
  return {cls:'status-pre', label:'Pre-race'};
}
const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

// ─── On-track ─────────────────────────────────────────────
function updateOnTrack(id) {
  const el = document.getElementById(id+'-on-track'); if (!el) return;
  const s = STATE[id]; if (!s||s.status!=='running'||!s.etaSec) { el.style.display='none'; return; }
  const TARGET = id === 'gf' ? 5400 : null;
  if (!TARGET) { el.style.display='none'; return; }
  const diff = s.etaSec - TARGET;
  el.style.display = 'flex';
  if (Math.abs(diff)<30) { el.className='on-track-banner on-track-neutral'; el.innerHTML='🎯 Right on 90-min pace!'; }
  else if (diff<0) { el.className='on-track-banner on-track-ahead'; el.innerHTML=`✅ ${fmtHMS(Math.abs(diff))} ahead of 90-min goal`; }
  else { el.className='on-track-banner on-track-behind'; el.innerHTML=`⚠️ ${fmtHMS(diff)} behind 90-min goal · proj: ${fmtHMS(s.etaSec)}`; }
}

// ─── ETA spots ────────────────────────────────────────────
function updateETASpots(id) {
  const el = document.getElementById(id+'-eta-spots'); if (!el) return;
  const s = STATE[id];
  if (!s||s.distMi<.5) { el.innerHTML='<div style="padding:12px 14px;font-size:12px;color:var(--text-tertiary)">Available once race starts</div>'; return; }
  const pace = s.elapsedSec / s.distMi;
  const upcoming = SPECTATOR_SPOTS.filter(sp => sp.mi > s.distMi);
  el.innerHTML = upcoming.map(sp => {
    const etaSec = etaAtMile(s, sp.mi, pace);
    const clock = new Date(RACE_START.getTime() + etaSec*1000);
    return `<div class="eta-spot-item">
      <span class="eta-spot-mi">${sp.mi}mi</span>
      <span class="eta-spot-name">${sp.name}</span>
      <div style="text-align:right">
        <div class="eta-spot-time">${fmtHMS(etaSec)}</div>
        <div class="eta-spot-clock">${clock.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>`;
  }).join('');
}

function etaAtMile(state, targetMi, pace) {
  let cum = state.elapsedSec;
  for (let i = Math.floor(state.distMi); i < Math.ceil(targetMi) && i < MILE_PACE_FACTORS.length; i++) {
    const seg = Math.min(1, targetMi - i);
    cum += pace * MILE_PACE_FACTORS[i] * seg;
  }
  return Math.round(cum);
}

// ─── Lead banner ──────────────────────────────────────────
function updateLeadBanner() {
  const g=STATE.gf,m=STATE.mom; if (!g||!m||(g.status==='pre'&&m.status==='pre')) return;
  const b=document.getElementById('lead-banner'); if(!b) return;
  if (g.distMi>0||m.distMi>0) {
    const d=g.distMi-m.distMi;
    const who=d>0?REG.find(r=>r.id==='gf'):REG.find(r=>r.id==='mom');
    b.querySelector('.lead-title').textContent=`${who?.emoji} ${who?.name?.split(' ')[0]} leads by ${Math.abs(d).toFixed(2)} miles`;
    b.querySelector('.lead-title').style.color=who?.color||'var(--blue)';
  }
}

// ═══════════════════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════════════════
const CHART_SCALES = {
  x:{type:'linear',min:0,max:13.1,
    ticks:{color:'#5a8db5',font:{family:'-apple-system,BlinkMacSystemFont',size:10},
      callback:v=>v===13.1?'Finish':Number.isInteger(v)?v+'mi':''},
    grid:{color:'rgba(14,165,233,0.08)'},border:{display:false}},
  y:{ticks:{color:'#5a8db5',font:{family:'-apple-system,BlinkMacSystemFont',size:10}},
    grid:{color:'rgba(14,165,233,0.08)'},border:{display:false}},
};
const CHART_TOOLTIP = {
  mode:'index',intersect:false,
  backgroundColor:'rgba(255,255,255,0.96)',
  titleColor:'#0c2340',bodyColor:'#1e4976',
  borderColor:'rgba(14,165,233,0.2)',borderWidth:1,
  titleFont:{family:'-apple-system,BlinkMacSystemFont',weight:'600',size:12},
  bodyFont:{family:'SF Mono,Fira Code,Menlo',size:11},
  padding:10,cornerRadius:10,
  callbacks:{
    label:c=>{
      const v=c.parsed.y,h=Math.floor(v/60),m=Math.floor(v%60),s=Math.floor((v%1)*60);
      return`${c.dataset.label}: ${h>0?h+':':''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
  }
};

function initCharts() {
  buildPaceChart('gf',  GF_SCENARIOS,  true,  '#007AFF');
  buildPaceChart('mom', MOM_SCENARIOS, false, '#5856D6');
  initDistChart();
  initElevChart();
}

function buildPaceChart(id, scenarios, showTarget, liveColor) {
  const ctx = document.getElementById(id+'-pace-chart'); if(!ctx) return;
  const datasets = scenarios.map(s => ({
    label: s.emoji+' '+s.label,
    data: (s.flatPace ? buildPaceProfile(s.flatPace) : PROFILE_90).map(p=>({x:p.mi,y:+(p.sec/60).toFixed(2)})),
    borderColor:s.color,borderWidth:2,
    borderDash:s.key==='walk'?[5,3]:[],
    backgroundColor:'transparent',tension:.35,pointRadius:0,pointHoverRadius:4,
  }));
  if (showTarget) datasets.push({
    label:'🎯 90-min goal',
    data:PROFILE_90.map(p=>({x:p.mi,y:+(p.sec/60).toFixed(2)})),
    borderColor:'#FF3B30',borderWidth:2.5,borderDash:[8,5],
    backgroundColor:'transparent',tension:.35,pointRadius:0,
  });
  const yTick = v=>{const h=Math.floor(v/60),m=Math.floor(v%60);return h>0?`${h}:${String(m).padStart(2,'0')}`:`${m}m`;};
  charts[id+'-pace'] = new Chart(ctx, {
    type:'line', data:{datasets},
    options:{responsive:true,maintainAspectRatio:false,parsing:false,
      plugins:{legend:{display:false},
        zoom:{zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'},pan:{enabled:true,mode:'x'}},
        tooltip:CHART_TOOLTIP},
      scales:{...CHART_SCALES,y:{...CHART_SCALES.y,ticks:{...CHART_SCALES.y.ticks,callback:yTick},
        title:{display:true,text:'Elapsed',color:'#5a8db5',font:{size:10}}}}
    }
  });
  buildChartLegend(id+'-pace-legend', id+'-pace', datasets);
  buildBadges(id+'-sc-badges', scenarios, showTarget);
  buildScenarioCards(id+'-sc-grid', scenarios, showTarget, id);
}

function buildChartLegend(legendId, chartKey, datasets) {
  const el = document.getElementById(legendId); if(!el) return;
  el.innerHTML = datasets.map((ds,i)=>`
    <div class="legend-item" data-chart="${chartKey}" data-index="${i}">
      <span class="legend-swatch" style="background:${ds.borderColor};${ds.borderDash?.length?'border-top:2px dashed '+ds.borderColor+';background:transparent;height:0;margin-top:8px':''}"></span>
      <span>${ds.label}</span>
    </div>`).join('');
  el.querySelectorAll('.legend-item').forEach(item => {
    item.addEventListener('click', () => {
      const ch = charts[item.dataset.chart]; const idx = +item.dataset.index;
      const meta = ch.getDatasetMeta(idx); meta.hidden = !meta.hidden;
      ch.update(); item.classList.toggle('hidden', meta.hidden);
    });
  });
}

function buildBadges(elId, scenarios, showTarget) {
  const el = document.getElementById(elId); if(!el) return;
  const b = scenarios.map(s=>{
    const sec=scenarioFinishSec(s),pct=getPercentile(sec);
    return `<span class="sc-badge" style="background:${s.color}15;color:${s.color}">${s.emoji} ${s.label}: <strong>${fmtHMS(sec)}</strong> · Top ${pct}%</span>`;
  });
  if(showTarget){const s90=Math.round(PROFILE_90.at(-1).sec);b.push(`<span class="sc-badge" style="background:#FF3B3015;color:#FF3B30;border:1px dashed #FF3B3030">🎯 Sub-90: <strong>${fmtHMS(s90)}</strong> · Top ${getPercentile(s90)}%</span>`);}
  el.innerHTML=b.join('');
}

function buildScenarioCards(elId, scenarios, showTarget, runnerId) {
  const el = document.getElementById(elId); if(!el) return;
  const cards = scenarios.map(s=>{
    const sec=scenarioFinishSec(s),pct=getPercentile(sec);
    return `<div class="sc-card">
      <div class="sc-emoji">${s.emoji}</div>
      <div class="sc-name">${s.label}</div>
      <div class="sc-time" style="color:${s.color}">${fmtHMS(sec)}</div>
      <div class="sc-pct">Top ${pct}%</div>
    </div>`;
  });
  el.innerHTML=cards.join('');
}

function updateLiveChart(id) {
  const ch=charts[id+'-pace']; if(!ch) return;
  const s=STATE[id]; if(!s||s.distMi<.5) return;
  const pace=s.elapsedSec/s.distMi;
  const prof=buildPaceProfile(pace).filter(p=>p.mi<=s.distMi+.05);
  const r=REG.find(r=>r.id===id);
  const liveDS={label:'📍 Live',data:prof.map(p=>({x:p.mi,y:+(p.sec/60).toFixed(2)})),
    borderColor:r?.color||'#007AFF',borderWidth:3,borderDash:[4,3],
    backgroundColor:'transparent',tension:.2,
    pointRadius:prof.map((_,i)=>i===prof.length-1?6:0),
    pointBackgroundColor:'#fff',pointBorderColor:r?.color||'#007AFF',pointBorderWidth:2,
  };
  const li=ch.data.datasets.findIndex(d=>d.label==='📍 Live');
  if(li===-1)ch.data.datasets.push(liveDS);else ch.data.datasets[li]=liveDS;
  ch.update('none');
}

function initDistChart() {
  const ctx=document.getElementById('dist-chart');if(!ctx)return;
  const labels=['1:20','1:30','1:45','2:00','2:10','2:20','2:30','2:45','3:00','3:15+'];
  const data=[200,600,2200,4800,5900,5200,4100,2800,1800,1100];
  charts['dist']=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Runners',data,
    backgroundColor:data.map((_,i)=>i>=3&&i<=5?'rgba(0,122,255,0.6)':'rgba(0,122,255,0.18)'),
    borderRadius:4,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        zoom:{zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'xy'},pan:{enabled:true}},
        tooltip:{...CHART_TOOLTIP,callbacks:{label:c=>`~${c.raw.toLocaleString()} runners`}}},
      scales:{x:{type:'category',ticks:{color:'#5a8db5',font:{size:10}},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}},
              y:{ticks:{color:'#5a8db5',font:{size:10}},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}}}}});
}

function initElevChart() {
  const ctx=document.getElementById('elev-chart');if(!ctx)return;
  charts['elev']=new Chart(ctx,{type:'line',data:{
    labels:ELEVATION.map(e=>e.mi%1===0?e.mi+'mi':''),
    datasets:[{label:'Elevation (ft)',data:ELEVATION.map(e=>e.ft),
      borderColor:'rgba(0,122,255,0.7)',borderWidth:2,
      fill:true,backgroundColor:'rgba(0,122,255,0.08)',tension:.4,pointRadius:0}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},
        zoom:{zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'},pan:{enabled:true,mode:'x'}},
        tooltip:{...CHART_TOOLTIP,callbacks:{label:c=>`${c.raw} ft`}}},
      scales:{x:{type:'category',ticks:{color:'#5a8db5',font:{size:10},maxTicksLimit:14},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}},
              y:{min:0,max:220,ticks:{color:'#5a8db5',font:{size:10},callback:v=>v+'ft'},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}}}}});
}

// ═══════════════════════════════════════════════════════════
// MINI MAPS (one per runner pane)
// ═══════════════════════════════════════════════════════════
function initMiniMap(id) {
  const el = document.getElementById('mini-map-'+id);
  if (!el || miniMaps[id]) return;
  const r = REG.find(r => r.id === id);
  const map = L.map(el, { center: [40.638, -73.974], zoom: 12, zoomControl: false, attributionControl: false, scrollWheelZoom: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
  // Course line
  L.polyline(COURSE_LATLNGS, { color: '#007AFF', weight: 3, opacity: 0.7 }).addTo(map);
  // Start/finish
  L.circleMarker([COURSE_LATLNGS[0][0], COURSE_LATLNGS[0][1]], { radius:6, color:'#FF9500', fillColor:'#FF9500', fillOpacity:.4, weight:2 }).addTo(map);
  L.circleMarker([COURSE_LATLNGS.at(-1)[0], COURSE_LATLNGS.at(-1)[1]], { radius:6, color:'#34C759', fillColor:'#34C759', fillOpacity:.4, weight:2 }).addTo(map);
  // Runner marker
  const markerEl = document.createElement('div');
  markerEl.style.cssText = `width:24px;height:24px;border-radius:50%;background:#fff;border:2.5px solid ${r?.color||'#007AFF'};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:${r?.color||'#007AFF'};box-shadow:0 2px 6px rgba(0,0,0,0.15)`;
  markerEl.textContent = (r?.name||'').split(' ').map(w=>w[0]).join('').slice(0,2);
  const icon = L.divIcon({ className:'', html:markerEl.outerHTML, iconSize:[24,24], iconAnchor:[12,12] });
  miniMarkers[id] = L.marker(COURSE_LATLNGS[0], { icon }).addTo(map);
  miniMaps[id] = map;
  setTimeout(() => map.invalidateSize(), 100);
}

function updateMiniMarker(id, pct) {
  if (!miniMaps[id]) initMiniMap(id);
  const marker = miniMarkers[id]; if (!marker) return;
  const idx = Math.min(Math.floor(pct / 100 * (COURSE_LATLNGS.length - 1)), COURSE_LATLNGS.length - 1);
  const ll = COURSE_LATLNGS[idx];
  marker.setLatLng(ll);
  miniMaps[id].panTo(ll, { animate: true, duration: 0.5 });
}

// ═══════════════════════════════════════════════════════════
// FULL MAP
// ═══════════════════════════════════════════════════════════
function initFullMap() {
  mapInited = true;
  fullMap = L.map('map', { center: [40.638, -73.974], zoom: 12 });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom:19, attribution:'© CARTO © OSM' }).addTo(fullMap);
  L.polyline(COURSE_LATLNGS, { color:'#007AFF', weight:5, opacity:.9 }).addTo(fullMap);
  CHECKPOINTS.forEach(cp => {
    const isEnd = cp.label.includes('Start')||cp.label.includes('Finish');
    const col = isEnd ? '#FF9500' : (cp.spectator ? '#007AFF' : '#34C759');
    L.circleMarker([cp.lat,cp.lng], { radius:isEnd?8:5, color:col, fillColor:col, fillOpacity:.25, weight:2.5 })
     .addTo(fullMap).bindPopup(`<b>${cp.label}</b><br>${cp.mi} miles`);
  });
  REG.forEach(r => {
    const el = document.createElement('div');
    el.style.cssText = `width:26px;height:26px;border-radius:50%;background:#fff;border:2.5px solid ${r.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${r.color};box-shadow:0 2px 8px rgba(0,0,0,0.15)`;
    el.textContent = r.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    const icon = L.divIcon({ className:'', html:el.outerHTML, iconSize:[26,26], iconAnchor:[13,13] });
    markers[r.id] = L.marker(COURSE_LATLNGS[0], { icon }).addTo(fullMap)
      .bindPopup(`${r.emoji} ${r.name} — waiting for data`);
  });
  setTimeout(() => fullMap.invalidateSize(), 150);
  initElevChart();
}

function updateMarker(id, pct) {
  const m = markers[id]; if(!m) return;
  const idx = Math.min(Math.floor(pct/100*(COURSE_LATLNGS.length-1)), COURSE_LATLNGS.length-1);
  m.setLatLng(COURSE_LATLNGS[idx]);
  const s=STATE[id],r=REG.find(r=>r.id===id);
  if(s&&r) m.getPopup()?.setContent(`<b>${r.emoji} ${r.name}</b><br>${s.distMi.toFixed(2)} mi · ${fmtHMS(s.elapsedSec)}<br>Pace: ${fmtPace(s.elapsedSec,s.distMi)}/mi`);
}

// ═══════════════════════════════════════════════════════════
// SIMULATOR
// ═══════════════════════════════════════════════════════════
const simState = {};
const simIntervals = {};
function initSimulators() { REG.forEach(r => initSimForRunner(r.id)); }

function initSimForRunner(id) {
  simState[id] = { pct: 0, playing: false };
  const slider = document.getElementById(id+'-sim-slider');
  const play   = document.getElementById(id+'-sim-play');
  const reset  = document.getElementById(id+'-sim-reset');
  if (!slider) return;

  const r = REG.find(r=>r.id===id);
  slider.addEventListener('input', e => {
    const livePct = STATE[id]?.pct || 0;
    const val = Math.max(livePct, +e.target.value); // lock forward-only during race
    simState[id].pct = val;
    slider.value = val;
    updateSliderGradient(slider, val, r?.color);
    updateSimDisplay(id, val);
  });
  play?.addEventListener('click', () => toggleSimPlay(id));
  reset?.addEventListener('click', () => {
    clearInterval(simIntervals[id]); simState[id].playing = false;
    if(play) play.textContent='▶ Play';
    simState[id].pct = STATE[id]?.pct||0;
    slider.value = simState[id].pct;
    updateSliderGradient(slider, simState[id].pct, r?.color);
    updateSimDisplay(id, simState[id].pct);
  });
}

function toggleSimPlay(id) {
  const play = document.getElementById(id+'-sim-play');
  const r = REG.find(r=>r.id===id);
  if (simState[id].playing) {
    clearInterval(simIntervals[id]); simState[id].playing=false;
    if(play) play.textContent='▶ Play';
  } else {
    simState[id].playing=true;
    if(play) play.textContent='⏸ Pause';
    simIntervals[id] = setInterval(() => {
      const livePct = STATE[id]?.pct||0;
      simState[id].pct = Math.min(100, Math.max(livePct, simState[id].pct+.4));
      const slider = document.getElementById(id+'-sim-slider');
      if(slider){slider.value=simState[id].pct;updateSliderGradient(slider,simState[id].pct,r?.color);}
      updateSimDisplay(id, simState[id].pct);
      if(simState[id].pct>=100){clearInterval(simIntervals[id]);simState[id].playing=false;if(play)play.textContent='▶ Play';}
    }, 100);
  }
}

function updateSliderGradient(slider, pct, color) {
  slider.style.background = `linear-gradient(to right,${color||'#007AFF'} ${pct}%,rgba(14,165,233,.15) ${pct}%)`;
}

const SIM_SCENS = {
  gf:  GF_SCENARIOS,
  mom: MOM_SCENARIOS,
};

function updateSimDisplay(id, pct) {
  const distMi = (pct/100)*TOTAL_MI;
  set(id+'-sim-pct',  pct.toFixed(1)+'%');
  set(id+'-sim-mi',   distMi.toFixed(2)+' mi');

  const scens = SIM_SCENS[id] || GF_SCENARIOS;
  const rows  = scens.map(s => {
    const pace  = s.flatPace || (PROFILE_90.at(-1).sec / TOTAL_MI);
    const elapsed = Math.round(pace * distMi);
    const remSec  = Math.round((TOTAL_MI - distMi) * pace);
    return `<div class="sim-row">
      <span style="color:${s.color}">${s.emoji} ${s.label}</span>
      <span style="font-family:var(--font-mono);font-size:12px">Elapsed: ${fmtHMS(elapsed)} · Finish: ${fmtHMS(elapsed+remSec)}</span>
    </div>`;
  });
  const rowEl = document.getElementById(id+'-sim-rows');
  if(rowEl) rowEl.innerHTML = rows.join('');

  // On-track vs goal
  if (id === 'gf') {
    const onPace = PROFILE_90.find(p=>p.mi>=distMi)?.sec || PROFILE_90.at(-1).sec;
    const actual = Math.round((PROFILE_90.at(-1).sec/TOTAL_MI)*distMi);
    const diff   = actual - onPace;
    const trackEl = document.getElementById(id+'-sim-track');
    if (trackEl) {
      if(pct<1){trackEl.textContent='Drag to simulate the race';trackEl.className='on-track-banner on-track-neutral';}
      else if(Math.abs(diff)<30){trackEl.textContent='🎯 Exactly on 90-min pace!';trackEl.className='on-track-banner on-track-neutral';}
      else if(diff<0){trackEl.textContent=`✅ ${fmtHMS(Math.abs(diff))} ahead of sub-90 goal`;trackEl.className='on-track-banner on-track-ahead';}
      else{trackEl.textContent=`⚠️ ${fmtHMS(diff)} behind sub-90 goal`;trackEl.className='on-track-banner on-track-behind';}
    }
  }
}

function updateSimTrack(id) {
  // Sync sim slider to live position if race is running
  const s = STATE[id]; if(!s||s.status!=='running') return;
  const livePct = s.pct;
  if (simState[id] && simState[id].pct < livePct) {
    simState[id].pct = livePct;
    const slider = document.getElementById(id+'-sim-slider');
    const r = REG.find(r=>r.id===id);
    if(slider){slider.value=livePct;updateSliderGradient(slider,livePct,r?.color);}
    updateSimDisplay(id, livePct);
  }
}

// ═══════════════════════════════════════════════════════════
// WEATHER
// ═══════════════════════════════════════════════════════════
async function loadWeather() {
  if (wxLoaded) return;
  set('wx-desc','Loading forecast…');
  try {
    wxData = await fetchWeather();
    const idxs = getRaceDayHours(wxData, '2026-05-16');
    const i = idxs.length
      ? (idxs.find(j=>wxData.hourly.time[j].includes('T07'))||idxs[0])
      : getCurrentHourIndex(wxData);
    const wx = extractHourData(wxData, i);
    const hourIdxs = idxs.length ? idxs.slice(0,12) : Array.from({length:12},(_,j)=>i+j);
    renderWeather(wx, !!idxs.length, hourIdxs);
    wxLoaded = true;
  } catch(e) {
    set('wx-desc','⚠️ Weather unavailable — try again later');
  }
}

function renderWeather(wx, isRace, hourIdxs) {
  set('wx-icon', getWeatherIcon(wx));
  set('wx-temp', wx.temp+'°F');
  set('wx-feels', 'Feels like '+wx.feels+'°F');
  set('wx-desc', (isRace?'Race day: ':'Current: ')+wx.temp+'°F, '+(wx.cloud<30?'clear':'partly cloudy'));
  set('wx-loc', isRace?'Brooklyn · May 16 · 7AM start forecast':'Brooklyn · Current (May 16 forecast available closer to race)');
  set('wx-wind',wx.wind+' mph'); set('wx-wdir',wx.windDir+' wind');
  set('wx-hum',wx.humid+'%'); set('wx-dew',wx.dew+'°F');
  set('wx-rain',wx.rain+'%'); set('wx-cloud',wx.cloud+'% cloud');
  const impact=analyzeRaceImpact(wx);
  const impEl=document.getElementById('wx-impact');
  if(impEl){impEl.textContent=impact.summary+' '+impact.parts.join(' · ');impEl.className='wx-impact '+impact.cls;}
  const adjEl=document.getElementById('wx-goal-adj');
  if(adjEl&&impact.totalPctImpact!==0){
    const adj=Math.round(PROFILE_90.at(-1).sec*(1+Math.abs(impact.totalPctImpact)/100));
    const sign=impact.totalPctImpact<0?'+':'-';
    const diff=Math.abs(adj-PROFILE_90.at(-1).sec);
    adjEl.textContent=`Weather-adjusted finish: ${fmtHMS(adj)} (${sign}${fmtHMS(diff)} vs ideal)`;
  }
  if (wxData && hourIdxs) {
    const ctx=document.getElementById('wx-hourly'); if(!ctx) return;
    if(charts['wx']){charts['wx'].destroy();delete charts['wx'];}
    const labs=hourIdxs.map(i=>{const h=parseInt(wxData.hourly.time[i].slice(11,13));return h<12?`${h||12}am`:h===12?'12pm':`${h-12}pm`;});
    const temps=hourIdxs.map(i=>Math.round(wxData.hourly.temperature_2m[i]));
    const winds=hourIdxs.map(i=>Math.round(wxData.hourly.windspeed_10m[i]));
    charts['wx']=new Chart(ctx,{type:'line',data:{labels:labs,datasets:[
      {label:'Temp °F',data:temps,borderColor:'#007AFF',borderWidth:2.5,fill:true,backgroundColor:'rgba(0,122,255,.07)',tension:.4,yAxisID:'y',pointRadius:3,pointBackgroundColor:'#007AFF'},
      {label:'Wind mph',data:winds,borderColor:'#FF9500',borderWidth:2,borderDash:[4,3],backgroundColor:'transparent',tension:.4,yAxisID:'y2',pointRadius:2}
    ]},options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#5a8db5',font:{size:10},usePointStyle:true}},tooltip:CHART_TOOLTIP},
      scales:{
        x:{ticks:{color:'#5a8db5',font:{size:10}},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}},
        y:{position:'left',ticks:{color:'#5a8db5',font:{size:10},callback:v=>v+'°'},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}},
        y2:{position:'right',ticks:{color:'#FF9500',font:{size:10},callback:v=>v+'mph'},grid:{display:false},border:{display:false}}
      }}});
  }
}

// ═══════════════════════════════════════════════════════════
// STATS / PERCENTILE
// ═══════════════════════════════════════════════════════════
function renderPctScenarios() {
  [{id:'gf',scens:GF_SCENARIOS,showT:true},{id:'mom',scens:MOM_SCENARIOS,showT:false}].forEach(({id,scens,showT})=>{
    const el=document.getElementById(id+'-pct-rows'); if(!el) return;
    const rows=scens.map(s=>{
      const sec=scenarioFinishSec(s),pct=getPercentile(sec);
      return`<div class="pct-row"><span style="color:${s.color}">${s.emoji} ${s.label}</span><span style="font-family:var(--font-mono)">${fmtHMS(sec)} · Top ${pct}%</span></div>`;
    });
    if(showT){const s=Math.round(PROFILE_90.at(-1).sec);rows.push(`<div class="pct-row"><span style="color:#FF3B30">🎯 Sub-90</span><span style="font-family:var(--font-mono)">${fmtHMS(s)} · Top ${getPercentile(s)}%</span></div>`);}
    el.innerHTML=rows.join('');
    const best=scenarioFinishSec(scens[0]);
    const bigEl=document.getElementById(id+'-pct-big');
    if(bigEl){bigEl.textContent='Top '+getPercentile(best)+'%';bigEl.style.color=scens[0].color;}
  });
}

window.lookupPct=function(){
  const t=document.getElementById('lookup-time')?.value;if(!t)return;
  const p=t.split(':').map(Number);
  const sec=p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*3600+p[1]*60;
  set('pct-result',`Top ${getPercentile(sec)}% 🏅`);
};

// ═══════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════
function openSettings(){renderRLI();document.getElementById('settings-modal').classList.add('open');}
function closeSettings(){document.getElementById('settings-modal').classList.remove('open');}
function renderRLI(){
  const el=document.getElementById('rli-list');if(!el)return;
  el.innerHTML=REG.map(r=>`<div class="runner-list-item">
    <span>${r.emoji||'🏃'}</span><span class="rli-name">${r.name}</span><span class="rli-id">${r.trackId}</span>
    ${r.fixed?'<span style="font-size:10px;color:var(--text-muted)">core</span>':`<button class="rli-del" onclick="removeRunner('${r.id}')">✕</button>`}
  </div>`).join('');
}
window.addRunner=function(){
  const name=document.getElementById('new-name')?.value?.trim();
  const tid=document.getElementById('new-tid')?.value?.trim()?.toUpperCase();
  const emoji=document.getElementById('new-emoji')?.value?.trim()||'🏃';
  const color=document.getElementById('new-color')?.value||'#007AFF';
  if(!name||!tid){notify('Name and tracker ID required');return;}
  const id='r_'+Date.now();
  REG.push({id,name,trackId:tid,emoji,color,fixed:false});
  saveRegistry(REG);STATE[id]=makeRunnerState(REG.at(-1));
  buildTabs();buildPanes();initSimulators();renderRLI();
  ['new-name','new-tid','new-emoji'].forEach(fid=>{const f=document.getElementById(fid);if(f)f.value='';});
  notify(name+' added!');
};
window.removeRunner=function(id){
  REG=REG.filter(r=>r.id!==id);saveRegistry(REG);delete STATE[id];
  document.getElementById('tab-'+id)?.remove();document.getElementById('pane-'+id)?.remove();
  tabOrder=tabOrder.filter(t=>t!==id);saveTabOrder();renderRLI();showTab('gf');
};
window.closeSettings=closeSettings;window.openSettings=openSettings;

// ═══════════════════════════════════════════════════════════
// FETCH + REFRESH
// ═══════════════════════════════════════════════════════════
async function doRefresh(){
  const ring=document.getElementById('spinRing');if(ring)ring.classList.add('on');
  await Promise.all(REG.map(async r=>{
    const changed=await fetchRunnerData(STATE[r.id]);if(changed)renderRunner(r.id);
  }));
  lastRefresh=Date.now();
  if(ring)ring.classList.remove('on');
  updateRefreshLabel();
}
function updateRefreshLabel(){
  if(!lastRefresh)return;
  const s=Math.round((Date.now()-lastRefresh)/1000);
  set('lastUpd',s<5?'Just updated':`Updated ${s}s ago`);
}
function startAutoRefresh(){setInterval(()=>doRefresh(),60000);}
window.manualRefresh=async function(){
  const btn=document.getElementById('refreshBtn');if(btn)btn.textContent='↻ Loading…';
  await doRefresh();if(btn)btn.textContent='↻ Refresh';notify('Refreshed ⚡');
};

// ═══════════════════════════════════════════════════════════
// COUNTDOWN
// ═══════════════════════════════════════════════════════════
function updateClock(){
  const d=RACE_START-new Date();
  if(d<=0){['d','h','m','s'].forEach(k=>set('cd-'+k,'🏃'));return;}
  set('cd-d',String(Math.floor(d/86400000)).padStart(2,'0'));
  set('cd-h',String(Math.floor(d%86400000/3600000)).padStart(2,'0'));
  set('cd-m',String(Math.floor(d%3600000/60000)).padStart(2,'0'));
  set('cd-s',String(Math.floor(d%60000/1000)).padStart(2,'0'));
}

// ═══════════════════════════════════════════════════════════
// CHEER
// ═══════════════════════════════════════════════════════════
window.sendCheer=function(id){
  const r=REG.find(r=>r.id===id);if(!r)return;
  const btn=document.getElementById('cheer-btn-'+id);
  if(btn){btn.textContent='🎉 Cheer sent!';btn.className='cheer-btn cheer-sent';}
  window.open(`https://rtrt.me/bkh2026/track/${r.trackId}#cheer`,'_blank');
  notify(`Cheer sent to ${r.name.split(' ')[0]}! 🎉`);
  setTimeout(()=>{if(btn){btn.innerHTML=`<span>📣</span> Send Cheer to ${r.name.split(' ')[0]}`;btn.className='cheer-btn';}},5000);
};

// ═══════════════════════════════════════════════════════════
// NOTIFICATIONS (PWA)
// ═══════════════════════════════════════════════════════════
const notified = {};
async function requestNotificationPermission(){
  if('Notification' in window && Notification.permission==='default'){
    await Notification.requestPermission();
  }
}
function checkNotifications(id, s){
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  const r = REG.find(r=>r.id===id); if(!r) return;
  // Milestone notifications
  const milestones = [25,50,75,90,100];
  milestones.forEach(m=>{
    const key=id+'-'+m;
    if(!notified[key] && s.pct>=m){
      notified[key]=true;
      const at = m===100?'Finished!':m+'% done';
      new Notification(`${r.emoji} ${r.name.split(' ')[0]} — ${at}`,{
        body: m===100
          ? `🎉 Finished in ${fmtHMS(s.elapsedSec)}! 🏅`
          : `${s.distMi.toFixed(1)} miles · pace ${fmtPace(s.elapsedSec,s.distMi)}/mi${s.etaSec?` · on track for ${fmtHMS(s.etaSec)}`:''}`,
        icon:'/icon-192.png', badge:'/icon-72.png',
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════
let notifTO;
function notify(msg){
  const el=document.getElementById('notif');const txt=document.getElementById('notif-text');
  if(!el||!txt)return;txt.textContent=msg;el.classList.add('show');
  clearTimeout(notifTO);notifTO=setTimeout(()=>el.classList.remove('show'),3000);
}

// expose for tabs/buttons
window.showTab=showTab;
