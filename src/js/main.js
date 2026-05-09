// ============================================================
// main.js — Blizzard Tracker v3
// ============================================================
import '../css/main.css';
import { COURSE, COURSE_LATLNGS, CHECKPOINTS, ELEVATION, MILE_PACE_FACTORS, SPECTATOR_SPOTS } from '../data/course.js';
import {
  TOTAL_MI, RACE_START,
  loadRegistry, saveRegistry, makeRunnerState,
  computeETA, getPercentile, loadGoals, saveGoals,
  buildNonLinearProfile, buildGoalProfile, buildSplitGoalLine,
  fetchRunnerData, fmtHMS, fmtPace, parsePaceStr, fmtGoalTime, FIELD_CDF,
} from '../data/runners.js';
import { fetchWeather, getRaceDayHours, getCurrentHourIndex, extractHourData, getWeatherIcon, analyzeRaceImpact } from '../data/weather.js';
import { loadRaces, computePRs, computeCareerTotals, timeToSec, fmtPaceFromSec, SAMPLE_RACES } from '../data/race-history.js';
import { mountDevTab, unmountDevTab } from './dev-tab.js';

const L = window.L;
const Chart = window.Chart;
// Register Chart.js zoom plugin immediately (before DOMContentLoaded race)
// Register Chart.js plugins safely
function registerChartPlugins() {
  if (window.Chart && window.ChartZoom) {
    try { window.Chart.register(window.ChartZoom); } catch(e) {}
  }
}
registerChartPlugins();

// Retry chart init after all CDN scripts are definitely loaded
window.addEventListener('load', function() {
  registerChartPlugins();
  setTimeout(function() {
    REG.forEach(function(r) {
      if (!charts[r.id + '-pace']) { try { buildPaceChart(r.id); } catch(e){ console.warn('pace chart retry failed', r.id, e.message); } }
    });
    if (!charts['dist'])  { try { initDistChart(); } catch(e){ console.warn('dist chart retry', e.message); } }
    if (!charts['elev'])  { try { initElevChart(); } catch(e){ console.warn('elev chart retry', e.message); } }
    updateClock();
    updateFamClock();
  }, 300);
});

// ── App state ─────────────────────────────────────────────
let REG   = loadRegistry();
const STATE = {};
const GOALS = {};
REG.forEach(r => { STATE[r.id] = makeRunnerState(r); GOALS[r.id] = loadGoals(r.id); });

let fullMap=null, mapInited=false;
// Expose globals for dev-tab.js
window._devREG   = REG;
window._devGOALS = GOALS;
const miniMaps={}, markers={}, miniMarkers={};
let wxLoaded=false, wxData=null;
const charts={};
let lastRefresh=null;
const simState={};

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Clocks first — never blocked by chart errors
  updateClock();
  updateFamClock();
  setInterval(updateClock, 1000);
  setInterval(updateFamClock, 1000);
  setInterval(updateRefreshLabel, 5000);
  buildTabs();
  buildPanes();
  renderAll();
  try { initAllCharts(); } catch(e) { console.error('Chart init error (will retry on load):', e.message); }
  renderPctScenariosV5();
  startAutoRefresh();
  doRefresh();
  requestNotificationPermission();
  setTimeout(() => {
    renderMergedAgeGroups();
    renderPctScenariosV5();
    updateHeaderStatus();
    updateFamSpotETAs();
    REG.forEach(r => renderRunnerStats(r.id));
  }, 200);
});

// ═══════════════════════════════════════════════════════════
// TABS — drag-and-drop
// ═══════════════════════════════════════════════════════════
const FIXED_TABS = ['family','gf','mom','weather','stats'];
// Clear stale tab order so family moves to front
localStorage.removeItem('blizzard_tab_order');
let tabOrder = [...FIXED_TABS];
const saveTabOrder = () => localStorage.setItem('blizzard_tab_order', JSON.stringify(tabOrder));

function buildTabs() {
  const bar = document.getElementById('tab-bar'); bar.innerHTML='';
  const toRender = tabOrder.filter(id=>FIXED_TABS.includes(id)||REG.find(r=>r.id===id));
  REG.filter(r=>!r.fixed&&!tabOrder.includes(r.id)).forEach(r=>toRender.push(r.id));
  toRender.forEach(id=>bar.appendChild(makeTab(id)));
  const add=document.createElement('div'); add.className='tab-add-btn'; add.textContent='⊕'; add.title='Add runner'; add.onclick=openGlobalSettings; bar.appendChild(add);
  setupDragDrop();
}
const TAB_META = { gf:'💙 Catherine', mom:'⚡ Helaine', family:'🏠 Family HQ', map:'🗺 Live Map', weather:'🌤 Weather', stats:'📊 Stats' };
function makeTab(id) {
  const r=REG.find(r=>r.id===id);
  const label=TAB_META[id]||`${r?.emoji||'🏃'} ${r?.name?.split(' ')[0]||id}`;
  const el=document.createElement('div'); el.className='tab'; el.id='tab-'+id; el.draggable=true; el.setAttribute('data-tab-id',id);
  el.innerHTML=label;
  if(r&&!r.fixed){ const x=document.createElement('span'); x.className='tab-x'; x.textContent='✕'; x.onclick=e=>{e.stopPropagation();removeRunner(id);}; el.appendChild(x); }
  el.addEventListener('click',()=>showTab(id)); return el;
}
function setupDragDrop() {
  const bar=document.getElementById('tab-bar'); let dragging=null;
  bar.querySelectorAll('.tab').forEach(tab=>{
    tab.addEventListener('dragstart',e=>{dragging=tab;tab.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    tab.addEventListener('dragend',()=>{tab.classList.remove('dragging');bar.querySelectorAll('.tab').forEach(t=>t.classList.remove('drag-over'));tabOrder=[...bar.querySelectorAll('.tab')].map(t=>t.getAttribute('data-tab-id'));saveTabOrder();});
    tab.addEventListener('dragover',e=>{e.preventDefault();if(tab!==dragging){tab.classList.add('drag-over');const mid=tab.getBoundingClientRect().left+tab.getBoundingClientRect().width/2;bar.insertBefore(dragging,e.clientX<mid?tab:tab.nextSibling);}});
    tab.addEventListener('dragleave',()=>tab.classList.remove('drag-over'));
  });
}
function showTab(id) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+id)?.classList.add('active');
  document.getElementById('pane-'+id)?.classList.add('active');
  if(id==='map'&&!mapInited) initFullMap();
  if(id==='weather'&&!wxLoaded) loadWeather();
  setTimeout(()=>{ if(miniMaps[id]) miniMaps[id].invalidateSize(); if(id==='map'&&fullMap) fullMap.invalidateSize(); },50);
}

// ═══════════════════════════════════════════════════════════
// PANES
// ═══════════════════════════════════════════════════════════
function buildPanes() {
  const main=document.querySelector('main');
  REG.filter(r=>!r.fixed).forEach(r=>{ if(!document.getElementById('pane-'+r.id)) main.insertBefore(makeDynPane(r),document.getElementById('pane-family')); });
}
function makeDynPane(r) {
  const el=document.createElement('div'); el.className='pane'; el.id='pane-'+r.id;
  const init=r.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const heroStyle = `background:linear-gradient(135deg,${r.color}dd,${r.color}88)`;
  el.innerHTML = `
    <div class="runner-hero-section gap-md" style="${heroStyle}">
      <div class="runner-hero-content">
        <div>
          <div class="runner-hero-name">${r.emoji} ${r.name}</div>
          <div class="runner-hero-subtitle">RBC Brooklyn Half 2026 · ${r.trackId}</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:flex-start">
          <button class="runner-settings-btn" onclick="openRunnerSettings('${r.id}')">⚙ Settings</button>
        </div>
      </div>
    </div>
    ${runnerBodyHTML(r.id, r.name, init, r.trackId, r.emoji, r.color)}
    <div class="runner-stats-section" id="stats-section-${r.id}"></div>
    <div id="upd-${r.id}" style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:6px;font-family:var(--font-mono)">—</div>`;
  STATE[r.id] = makeRunnerState(r);
  GOALS[r.id] = loadGoals(r.id);
  return el;
}

// ═══════════════════════════════════════════════════════════
// RUNNER BODY HTML (shared for static + dynamic)
// ═══════════════════════════════════════════════════════════
function runnerBodyHTML(id,name,initials,trackId,emoji,color) {
  return `
<div class="grid-2" style="align-items:start">
  <div>
    <div class="runner-header-card">
      <div class="runner-top-bar">
        <div class="avatar" style="background:${color}18;color:${color};border:1.5px solid ${color}35">${initials}</div>
        <div><div class="runner-name">${name}</div><div class="runner-sub">Tracker · ${trackId}</div></div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:6px">
          <div id="${id}-pill" class="status-badge status-pre"><span class="status-dot"></span>Pre-race</div>
          <button class="icon-btn" onclick="openRunnerSettings('${id}')" title="Runner settings">⚙</button>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-cell"><div class="stat-label">Distance</div><div class="stat-num" id="${id}-dist" style="color:${color}">—</div><div class="stat-unit">of 13.1 mi</div></div>
        <div class="stat-cell"><div class="stat-label">Elapsed</div><div class="stat-num" id="${id}-elapsed" style="color:${color}">—</div><div class="stat-unit">HH:MM:SS</div></div>
        <div class="stat-cell"><div class="stat-label">Avg Pace</div><div class="stat-num" id="${id}-pace" style="color:${color}">—</div><div class="stat-unit">min/mi</div></div>
      </div>
      <div class="progress-section">
        <div class="progress-labels"><span>Start</span><span id="${id}-pct-lbl">0%</span></div>
        <div class="progress-track"><div class="progress-fill" id="${id}-bar" style="background:${color};width:0%"></div></div>
        <div class="cp-row" id="${id}-cps"></div>
      </div>
      <div class="splits-section">
        <div class="splits-label">Checkpoint Splits <span class="info-btn" data-tip="splits">ⓘ</span></div>
        <table class="splits-table">
          <colgroup><col style="width:38%"><col style="width:34%"><col style="width:28%"></colgroup>
          <thead><tr><th>Checkpoint</th><th>Clock Time</th><th>Pace</th></tr></thead>
          <tbody id="${id}-splits"><tr><td class="split-empty" colspan="3">Race starts May 16 — populates live</td></tr></tbody>
        </table>
      </div>
    </div>
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
          <div class="eta-label" style="color:${color}">Predicted Finish <span class="info-btn" data-tip="eta">ⓘ</span></div>
          <div class="eta-time" id="${id}-eta" style="color:${color}">—:—:—</div>
          <div class="eta-sub" id="${id}-eta-sub">Waiting…</div>
        </div>
        <div class="eta-right"><div class="eta-conf" id="${id}-conf" style="color:${color}">—</div><div class="eta-conf-label">% confidence</div></div>
      </div>
      <div id="${id}-goal-strip" class="goal-strip"></div>
    </div>
    <div class="card gap-md">
      <div class="card-header"><div class="card-title">📍 Arrival estimates <span class="info-btn" data-tip="arrivals">ⓘ</span></div></div>
      <div id="${id}-eta-spots" class="eta-spots-row"><div style="padding:12px 14px;font-size:12px;color:var(--text-tertiary)">Available once race starts</div></div>
    </div>
    <div class="card gap-md">
      <div class="card-header">
        <div class="card-title">Pace on course <span class="info-btn" data-tip="pace-chart">ⓘ</span></div>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button class="btn btn-sm btn-ghost" onclick="charts['${id}-pace']?.resetZoom()">Reset zoom</button>
        </div>
      </div>
      <div class="chart-wrap">
        <div id="${id}-pace-legend" class="chart-legend"></div>
        <div style="position:relative;height:240px"><canvas id="${id}-pace-chart"></canvas></div>
      </div>
      <div id="${id}-sc-badges" class="badge-row"></div>
    </div>
    <button class="cheer-btn gap-md" id="cheer-btn-${id}" onclick="sendCheer('${id}')">
      <span>📣</span> Send Cheer to ${name.split(' ')[0]}
    </button>
    
  </div>
</div>
<div id="upd-${id}" style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:6px;font-family:var(--font-mono)">—</div>`;
}


// ═══════════════════════════════════════════════════════════
// RUNNER SETTINGS MODAL
// ═══════════════════════════════════════════════════════════
let settingsRunnerId = null;

window.openRunnerSettings = function(id) {
  settingsRunnerId = id;
  const goals = GOALS[id];
  const r = REG.find(r=>r.id===id);
  const modal = document.getElementById('runner-settings-modal');
  document.getElementById('rs-title').textContent = `${r?.emoji||'⚡'} ${r?.name?.split(' ')[0]} — Race Settings`;

  // Goal time
  document.getElementById('rs-goal-time').value = fmtGoalTime(goals.goalTime);
  document.getElementById('rs-goal-label').value = goals.goalLabel;

  // Milestone paces
  document.getElementById('rs-pace-5k').value  = fmtPace(goals.mile5kPace, 1);
  document.getElementById('rs-pace-10k').value = fmtPace(goals.mile10kPace, 1);
  document.getElementById('rs-pace-15k').value = fmtPace(goals.mile15kPace, 1);
  document.getElementById('rs-pace-fin').value = fmtPace(goals.mileFinishPace, 1);

  // Split goals
  const tbody = document.getElementById('rs-splits-body');
  tbody.innerHTML = goals.splitGoals.map((sg,i) => `
    <tr>
      <td style="padding:6px 4px;font-size:13px;color:var(--text-secondary)">${sg.label}</td>
      <td><input class="form-input rs-split-input" data-index="${i}" value="${fmtHMS(sg.targetSec)}" style="width:90px;font-size:13px;padding:5px 8px"></td>
    </tr>`).join('');

  modal.classList.add('open');
};

window.saveRunnerSettings = function() {
  const id = settingsRunnerId; if (!id) return;
  const goals = GOALS[id];

  // Goal time
  const gtStr = document.getElementById('rs-goal-time').value;
  const gtParts = gtStr.split(':').map(Number);
  if (gtParts.length === 3) goals.goalTime = gtParts[0]*3600+gtParts[1]*60+gtParts[2];
  else if (gtParts.length === 2) goals.goalTime = gtParts[0]*60+gtParts[1];
  goals.goalLabel = document.getElementById('rs-goal-label').value || goals.goalLabel;

  // Milestone paces
  const p5  = parsePaceStr(document.getElementById('rs-pace-5k').value);
  const p10 = parsePaceStr(document.getElementById('rs-pace-10k').value);
  const p15 = parsePaceStr(document.getElementById('rs-pace-15k').value);
  const pFin= parsePaceStr(document.getElementById('rs-pace-fin').value);
  if(p5)  goals.mile5kPace  = p5;
  if(p10) goals.mile10kPace = p10;
  if(p15) goals.mile15kPace = p15;
  if(pFin)goals.mileFinishPace = pFin;

  // Split goals
  document.querySelectorAll('.rs-split-input').forEach(inp => {
    const i = +inp.dataset.index;
    const parts = inp.value.split(':').map(Number);
    let sec = 0;
    if(parts.length===3) sec=parts[0]*3600+parts[1]*60+parts[2];
    else if(parts.length===2) sec=parts[0]*3600+parts[1]*60;
    if(sec>0) goals.splitGoals[i].targetSec = sec;
  });

  saveGoals(id, goals);
  document.getElementById('runner-settings-modal').classList.remove('open');
  rebuildPaceChart(id);
  renderMergedAgeGroups();
  renderPctScenariosV5();
  notify('Settings saved ✓');
};

window.closeRunnerSettings = () => document.getElementById('runner-settings-modal').classList.remove('open');

// ═══════════════════════════════════════════════════════════
// GLOBAL SETTINGS (manage runners)
// ═══════════════════════════════════════════════════════════
function openGlobalSettings(){ renderRLI(); document.getElementById('settings-modal').classList.add('open'); }
function closeSettings(){ document.getElementById('settings-modal').classList.remove('open'); }
function renderRLI(){
  const el=document.getElementById('rli-list'); if(!el) return;
  el.innerHTML=REG.map(r=>`<div class="runner-list-item">
    <span>${r.emoji||'🏃'}</span><span class="rli-name">${r.name}</span><span class="rli-id">${r.trackId}</span>
    ${r.fixed?'<span style="font-size:10px;color:var(--text-muted)">core</span>':`<button class="rli-del" onclick="removeRunner('${r.id}')">✕</button>`}
  </div>`).join('');
}
window.addRunner=function(){
  var name=document.getElementById('new-name')?.value?.trim();
  var tid=document.getElementById('new-tid')?.value?.trim()?.toUpperCase();
  var emoji=document.getElementById('new-emoji')?.value?.trim()||'🏃';
  var color=document.getElementById('new-color')?.value||'#007AFF';
  if(!name||!tid){notify('Name and tracker ID required');return;}
  var id='r_'+Date.now();
  var newRunner={id:id,name:name,trackId:tid,emoji:emoji,color:color,fixed:false};
  REG.push(newRunner);
  saveRegistry(REG);
  STATE[id]=makeRunnerState(newRunner);
  GOALS[id]=loadGoals(id);
  window._devREG=REG; window._devGOALS=GOALS;
  buildTabs();
  buildPanes();
  // Small delay to allow DOM to render before init
  setTimeout(function(){
    try { buildPaceChart(id); } catch(e){ console.warn('chart err',e); }
    renderRunnerStats(id);
    closeSettings();
    showTab(id);
    notify(name+' added! 🎉');
  }, 150);
  ['new-name','new-tid','new-emoji'].forEach(function(fid){var f=document.getElementById(fid);if(f)f.value='';});
};
window.removeRunner=function(id){
  REG=REG.filter(r=>r.id!==id); saveRegistry(REG); delete STATE[id];
  document.getElementById('tab-'+id)?.remove(); document.getElementById('pane-'+id)?.remove();
  tabOrder=tabOrder.filter(t=>t!==id); saveTabOrder(); renderRLI(); showTab('gf');
};
window.closeSettings=closeSettings; window.openGlobalSettings=openGlobalSettings;

// ═══════════════════════════════════════════════════════════
// INFO TOOLTIPS
// ═══════════════════════════════════════════════════════════
const TIPS = {
  splits:      'Live checkpoint times from the RTRT.me official tracker. Updates every 60s during the race.',
  eta:         'Predicted finish based on current pace + elevation-adjusted Riegel fatigue model. Confidence increases as more of the race completes.',
  arrivals:    'Estimated times when the runner will pass each spectator spot, based on current pace and remaining elevation profile.',
  'pace-chart':'Shows all scenarios on the course mile by mile. Lines adjust live once the race starts. 📌 Click any legend item to show/hide it. Scroll to zoom.',
  simulator:   'Drag to any point in the race to see projected finish times for all scenarios. During the live race, the slider locks to the current position — you can only look ahead.',
  weather:     'Race day weather from Open-Meteo. Shows how conditions affect pace relative to ideal racing temperature (50–55°F).',
  percentile:  'Where this finish time ranks among the ~28,500 runners who finished the 2025 RBC Brooklyn Half.',
};

document.addEventListener('click', e => {
  const btn = e.target.closest('.info-btn');
  if (btn) {
    const tip = TIPS[btn.dataset.tip] || 'No info available.';
    showTooltip(btn, tip);
    e.stopPropagation();
    return;
  }
  const existing = document.querySelector('.tooltip-popup');
  if (existing && !existing.contains(e.target)) existing.remove();
});

function showTooltip(anchor, text) {
  document.querySelector('.tooltip-popup')?.remove();
  const pop = document.createElement('div');
  pop.className = 'tooltip-popup';
  pop.innerHTML = `<div style="font-size:13px;line-height:1.55;color:var(--text-primary)">${text}</div><div class="tooltip-arrow"></div>`;
  document.body.appendChild(pop);
  const rect = anchor.getBoundingClientRect();
  pop.style.cssText = `position:fixed;z-index:2000;background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 12px;max-width:260px;box-shadow:0 4px 20px rgba(0,0,0,0.12);top:${rect.bottom+6}px;left:${Math.max(8, Math.min(rect.left-100, window.innerWidth-280))}px`;
  setTimeout(() => { document.addEventListener('click', () => pop.remove(), { once: true }); }, 50);
}

// ═══════════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════════
function renderAll() { REG.forEach(r=>renderRunner(r.id)); }
const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };

function renderRunner(id) {
  const s=STATE[id],goals=GOALS[id]; if(!s||!goals) return;
  const pct=Math.min(100,s.pct);
  const r=REG.find(r=>r.id===id);
  set(id+'-dist',    s.distMi>0?s.distMi.toFixed(2):'—');
  set(id+'-elapsed', fmtHMS(s.elapsedSec));
  set(id+'-pace',    fmtPace(s.elapsedSec,s.distMi));
  set(id+'-pct-lbl', pct.toFixed(1)+'%');
  const bar=document.getElementById(id+'-bar'); if(bar) bar.style.width=pct+'%';
  const pill=document.getElementById(id+'-pill');
  if(pill){ const {cls,label}=statusInfo(s.status); pill.className='status-badge '+cls; pill.innerHTML=`<span class="status-dot"></span>${label}`; }
  if(s.etaSec){ set(id+'-eta',fmtHMS(s.etaSec)); const fin=new Date(RACE_START.getTime()+s.etaSec*1000); set(id+'-eta-sub','Est: '+fin.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})); set(id+'-conf',s.conf+'%'); }
  // Goal strip
  const gs=document.getElementById(id+'-goal-strip');
  if(gs){ const pctToGoal=goals.goalTime?Math.round(((goals.goalTime-(s.etaSec||goals.goalTime))/goals.goalTime)*100):0; gs.innerHTML=`<div class="goal-strip-inner"><span style="color:var(--text-tertiary);font-size:11px">Goal: ${fmtHMS(goals.goalTime)} · ${goals.goalLabel}</span>${s.etaSec?`<span style="font-size:11px;color:${s.etaSec<=goals.goalTime?'var(--green)':'var(--orange)'}"> ${s.etaSec<=goals.goalTime?'✅ On track':'⚠️ '+fmtHMS(s.etaSec-goals.goalTime)+' behind'}</span>`:''}</div>`; }
  updateOnTrack(id);
  updateETASpots(id);
  const cps=document.getElementById(id+'-cps');
  if(cps) cps.innerHTML=CHECKPOINTS.map(cp=>`<div class="cp-dot${pct>=(cp.mi/TOTAL_MI*100)?' hit':''}" style="left:${cp.mi/TOTAL_MI*100}%"></div><div class="cp-lbl" style="left:${cp.mi/TOTAL_MI*100}%">${cp.label}</div>`).join('');
  if(s.splits.length){ const tb=document.getElementById(id+'-splits'); if(tb) tb.innerHTML=s.splits.map(sp=>`<tr><td>${sp.label}</td><td>${sp.chipTime}</td><td>${sp.pace}/mi</td></tr>`).join(''); }
  if(id==='gf'||id==='mom'){ set('fam-'+id+'-st',statusInfo(s.status).label); set('fam-'+id+'-d',s.distMi>0?s.distMi.toFixed(2)+' mi':'—'); set('fam-'+id+'-e',fmtHMS(s.elapsedSec)); set('fam-'+id+'-p',fmtPace(s.elapsedSec,s.distMi)!=='—'?fmtPace(s.elapsedSec,s.distMi)+'/mi':'—'); set('fam-'+id+'-eta',s.etaSec?fmtHMS(s.etaSec):'—'); updateLeadBanner(); }
  set('upd-'+id,'Updated '+new Date().toLocaleTimeString());
  if(mapInited&&pct>0) updateMarker(id,pct);
  updateMiniMarker(id,pct);
  updateLiveChart(id);
  updateSimTrack(id);
  checkNotifications(id,s);
}

function statusInfo(s){ if(s==='running')return{cls:'status-running',label:'Running ▲'}; if(s==='finished')return{cls:'status-finished',label:'Finished! 🎉'}; return{cls:'status-pre',label:'Pre-race'}; }
function updateOnTrack(id){
  const el=document.getElementById(id+'-on-track'); if(!el) return;
  const s=STATE[id],goals=GOALS[id]; if(!s||s.status!=='running'||!s.etaSec){el.style.display='none';return;}
  const diff=s.etaSec-goals.goalTime; el.style.display='flex';
  if(Math.abs(diff)<30){el.className='on-track-banner on-track-neutral';el.innerHTML=`🎯 Right on ${goals.goalLabel} pace!`;}
  else if(diff<0){el.className='on-track-banner on-track-ahead';el.innerHTML=`✅ ${fmtHMS(Math.abs(diff))} ahead of ${goals.goalLabel}`;}
  else{el.className='on-track-banner on-track-behind';el.innerHTML=`⚠️ ${fmtHMS(diff)} behind ${goals.goalLabel} · proj: ${fmtHMS(s.etaSec)}`;}
}
function updateETASpots(id){
  const el=document.getElementById(id+'-eta-spots'); if(!el) return;
  const s=STATE[id]; if(!s||s.distMi<.5){el.innerHTML='<div style="padding:12px 14px;font-size:12px;color:var(--text-tertiary)">Available once race starts</div>';return;}
  const pace=s.elapsedSec/s.distMi;
  el.innerHTML=SPECTATOR_SPOTS.filter(sp=>sp.mi>s.distMi).map(sp=>{
    let cum=s.elapsedSec; const profile=buildNonLinearProfile(GOALS[id],pace,100);
    const atNow=profile.find(p=>p.mi>=s.distMi)?.sec||0; const atSp=profile.find(p=>p.mi>=sp.mi)?.sec||0;
    const etaSec=Math.round(s.elapsedSec+(atSp-atNow)); const clock=new Date(RACE_START.getTime()+etaSec*1000);
    return `<div class="eta-spot-item"><span class="eta-spot-mi">${sp.mi}mi</span><span class="eta-spot-name">${sp.name}</span><div style="text-align:right"><div class="eta-spot-time">${fmtHMS(etaSec)}</div><div class="eta-spot-clock">${clock.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div></div></div>`;
  }).join('');
}
function updateLeadBanner(){
  const g=STATE.gf,m=STATE.mom; if(!g||!m||(g.status==='pre'&&m.status==='pre'))return;
  const b=document.getElementById('lead-banner'); if(!b) return;
  if(g.distMi>0||m.distMi>0){const d=g.distMi-m.distMi,who=d>0?REG.find(r=>r.id==='gf'):REG.find(r=>r.id==='mom');b.querySelector('.lead-title').textContent=`${who?.emoji} ${who?.name?.split(' ')[0]} leads by ${Math.abs(d).toFixed(2)} miles`;b.querySelector('.lead-title').style.color=who?.color||'var(--blue)';}
}

// ═══════════════════════════════════════════════════════════
// CHARTS — non-linear, live-updating, zoomable
// ═══════════════════════════════════════════════════════════
const CHART_OPTS = {
  responsive:true, maintainAspectRatio:false, parsing:false,
  animation: { duration: 300 },
  plugins:{
    legend:{display:false},
    zoom: window.ChartZoom ? {zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'},pan:{enabled:true,mode:'x'}} : undefined,
    tooltip:{mode:'index',intersect:false,
      backgroundColor:'rgba(255,255,255,0.97)',titleColor:'#0c2340',bodyColor:'#1e4976',
      borderColor:'rgba(14,165,233,0.2)',borderWidth:1,
      titleFont:{family:'-apple-system,BlinkMacSystemFont',weight:'600',size:12},
      bodyFont:{family:'SF Mono,Fira Code,Menlo',size:11},padding:10,cornerRadius:10,
      callbacks:{
        title:items=>'Mile '+items[0].parsed.x.toFixed(1),
        label:item=>' '+item.dataset.label+': '+fmtHMS(Math.round(item.parsed.y*60)),
      }
    },
  },
  scales:{
    x:{type:'linear',min:0,max:13.1,
      title:{display:true,text:'Miles',font:{size:11},color:'var(--text-tertiary)'},
      grid:{color:'rgba(14,165,233,0.08)'},
      ticks:{color:'var(--text-tertiary)',font:{size:10},maxTicksLimit:8,callback:v=>v+'mi'}
    },
    y:{title:{display:true,text:'Min/Mile',font:{size:11},color:'var(--text-tertiary)'},
      grid:{color:'rgba(14,165,233,0.08)'},
      ticks:{color:'var(--text-tertiary)',font:{size:10},
        callback:v=>{const m=Math.floor(v),s=Math.round((v-m)*60);return m+':'+(s<10?'0':'')+s;}
      }
    }
  }
};

function initAllCharts() {
  REG.forEach(r => buildPaceChart(r.id));
  initDistChart(); initElevChart();
}

function buildPaceChart(id) {
  const ctx=document.getElementById(id+'-pace-chart'); if(!ctx) return;
  if(charts[id+'-pace']){charts[id+'-pace'].destroy();delete charts[id+'-pace'];}
  const goals=GOALS[id];
  if (!goals || !goals.scenarios) { console.warn('buildPaceChart: no goals for', id); return; }
  const datasets = goals.scenarios.map(s => ({
    label: s.emoji + ' ' + s.label + ' (' + fmtHMS(Math.round((s.flatPace ? buildNonLinearProfile(goals, s.flatPace, 100) : buildGoalProfile(goals, 100)).at(-1)?.sec || 0)) + ')',
    data: (s.flatPace ? buildNonLinearProfile(goals, s.flatPace, 100) : buildGoalProfile(goals, 100)).map(p => ({ x: p.mi, y: +(p.sec / 60).toFixed(2) })),
    borderColor: s.color, borderWidth: 2,
    borderDash: s.key === 'runwalk' ? [5, 3] : [],
    backgroundColor: 'transparent', tension: .35, pointRadius: 0, pointHoverRadius: 4,
    hidden: true, // hidden by default — user clicks legend to show
  }));
  // Goal target line — VISIBLE by default, clearly labeled
  datasets.push({
    label: '🎯 ' + goals.goalLabel + ' TARGET line — not actual',
    data: buildSplitGoalLine(goals),
    borderColor: '#FF3B30', borderWidth: 2.5, borderDash: [8, 5],
    backgroundColor: 'transparent', tension: .35, pointRadius: 5,
    pointBackgroundColor: '#FF3B30', pointBorderColor: '#fff', pointBorderWidth: 1.5,
    hidden: false, // visible by default
  });
  charts[id+'-pace']=new Chart(ctx,{type:'line',data:{datasets},options:CHART_OPTS});
  buildChartLegend(id+'-pace-legend',id+'-pace',datasets);
  buildBadges(id+'-sc-badges',goals);
}

function rebuildPaceChart(id) { buildPaceChart(id); }

function buildChartLegend(legendId,chartKey,datasets){
  const el=document.getElementById(legendId); if(!el) return;
  el.innerHTML=datasets.map((ds,i)=>`<div class="legend-item" data-chart="${chartKey}" data-index="${i}">
    <span class="legend-swatch" style="${ds.borderDash?.length?'border-top:2px dashed '+ds.borderColor+';background:transparent;height:0;margin-top:8px':'background:'+ds.borderColor}"></span>
    <span>${ds.label}</span></div>`).join('');
  el.querySelectorAll('.legend-item').forEach(item=>{ item.addEventListener('click',()=>{ const ch=charts[item.dataset.chart],idx=+item.dataset.index,meta=ch.getDatasetMeta(idx); meta.hidden=!meta.hidden; ch.update(); item.classList.toggle('hidden',meta.hidden); }); });
}

function buildBadges(elId,goals){
  const el=document.getElementById(elId); if(!el) return;
  const b=goals.scenarios.map(s=>{
    const profile=s.flatPace?buildNonLinearProfile(goals,s.flatPace,100):buildGoalProfile(goals,100);
    const sec=Math.round(profile.at(-1)?.sec||0); const pct=getPercentile(sec);
    return `<span class="sc-badge" style="background:${s.color}15;color:${s.color}">${s.emoji} ${s.label}: <strong>${fmtHMS(sec)}</strong> · Top ${pct}%</span>`;
  });
  const gSec=Math.round(buildGoalProfile(goals,100).at(-1)?.sec||0);
  b.push(`<span class="sc-badge" style="background:#FF3B3015;color:#FF3B30;border:1px dashed #FF3B3030">🎯 ${goals.goalLabel}: <strong>${fmtHMS(gSec)}</strong> · Top ${getPercentile(gSec)}%</span>`);
  el.innerHTML=b.join('');
}

// Live chart update — adds actual trace + extends prediction from current position
function updateLiveChart(id){
  const ch=charts[id+'-pace']; if(!ch) return;
  const s=STATE[id]; if(!s||s.distMi<.5) return;
  const goals=GOALS[id];
  const actualPace=s.elapsedSec/s.distMi;
  const r=REG.find(r=>r.id===id);

  // 1. Actual trace (solid, from history)
  const actualPts=[{x:0,y:0},...s.paceHistory.map(h=>({x:+(h.mi).toFixed(2),y:+(h.elapsedSec/60).toFixed(2)}))];
  const actualDS={label:'📍 Actual',data:actualPts,borderColor:r?.color||'#007AFF',borderWidth:3,borderDash:[],backgroundColor:'transparent',tension:.2,pointRadius:actualPts.map((_,i)=>i===actualPts.length-1?6:0),pointBackgroundColor:'#fff',pointBorderColor:r?.color,pointBorderWidth:2};

  // 2. Projected remaining (dotted, from current position)
  const projProfile=buildNonLinearProfile(goals,actualPace,100).filter(p=>p.mi>=s.distMi-.1);
  const projectedPts=projProfile.map(p=>({x:+(p.mi).toFixed(2),y:+(( s.elapsedSec+(p.sec - projProfile[0].sec) )/60).toFixed(2)}));
  const projDS={label:'→ Projected',data:projectedPts,borderColor:r?.color||'#007AFF',borderWidth:2,borderDash:[4,3],backgroundColor:'transparent',tension:.3,pointRadius:0};

  ['📍 Actual','→ Projected'].forEach(lbl=>{ const li=ch.data.datasets.findIndex(d=>d.label===lbl); if(li!==-1)ch.data.datasets.splice(li,1); });
  ch.data.datasets.push(actualDS,projDS);
  ch.update('none');
}

function initDistChart(){
  const ctx=document.getElementById('dist-chart'); if(!ctx) return;
  const labels=['1:20','1:30','1:45','2:00','2:10','2:20','2:30','2:45','3:00','3:15+'];
  const data=[200,600,2200,4800,5900,5200,4100,2800,1800,1100];
  charts['dist']=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Runners',data,backgroundColor:data.map((_,i)=>i>=3&&i<=5?'rgba(0,122,255,0.6)':'rgba(0,122,255,0.18)'),borderRadius:4,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},zoom:{zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'xy'},pan:{enabled:true}},tooltip:{backgroundColor:'rgba(255,255,255,0.97)',titleColor:'#0c2340',bodyColor:'#1e4976',borderColor:'rgba(14,165,233,0.2)',borderWidth:1,callbacks:{label:c=>`~${c.raw.toLocaleString()} runners`}}},scales:{x:{type:'category',ticks:{color:'#5a8db5',font:{size:10}},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}},y:{ticks:{color:'#5a8db5',font:{size:10}},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}}}}});
}

function initElevChart(){
  const ctx=document.getElementById('elev-chart'); if(!ctx) return;
  charts['elev']=new Chart(ctx,{type:'line',data:{labels:ELEVATION.map(e=>e.mi%1===0?e.mi+'mi':''),datasets:[{label:'Elevation (ft)',data:ELEVATION.map(e=>e.ft),borderColor:'rgba(0,122,255,0.7)',borderWidth:2,fill:true,backgroundColor:'rgba(0,122,255,0.08)',tension:.4,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},zoom:{zoom:{wheel:{enabled:true},pinch:{enabled:true},mode:'x'},pan:{enabled:true,mode:'x'}},tooltip:{backgroundColor:'rgba(255,255,255,0.97)',titleColor:'#0c2340',bodyColor:'#1e4976',borderColor:'rgba(14,165,233,0.2)',borderWidth:1,callbacks:{label:c=>`${c.raw} ft`}}},scales:{x:{type:'category',ticks:{color:'#5a8db5',font:{size:10},maxTicksLimit:14},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}},y:{min:0,max:220,ticks:{color:'#5a8db5',font:{size:10},callback:v=>v+'ft'},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}}}}});
}

// ═══════════════════════════════════════════════════════════
// SIMULATOR — updates charts too
// ═══════════════════════════════════════════════════════════
// Update chart to show sim position + projections from that point
// ═══════════════════════════════════════════════════════════
// MINI MAPS + FULL MAP
// ═══════════════════════════════════════════════════════════
function initMiniMap(id){
  const el=document.getElementById('mini-map-'+id); if(!el||miniMaps[id]) return;
  const r=REG.find(r=>r.id===id);
  const map=L.map(el,{center:[40.638,-73.974],zoom:12,zoomControl:false,attributionControl:false,scrollWheelZoom:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);
  L.polyline(COURSE_LATLNGS,{color:'#007AFF',weight:3,opacity:.7}).addTo(map);
  L.circleMarker(COURSE_LATLNGS[0],{radius:6,color:'#FF9500',fillColor:'#FF9500',fillOpacity:.4,weight:2}).addTo(map);
  L.circleMarker(COURSE_LATLNGS.at(-1),{radius:6,color:'#34C759',fillColor:'#34C759',fillOpacity:.4,weight:2}).addTo(map);
  const mEl=document.createElement('div');
  mEl.style.cssText=`width:26px;height:26px;border-radius:50%;background:#fff;border:2.5px solid ${r?.color||'#007AFF'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${r?.color||'#007AFF'};box-shadow:0 2px 6px rgba(0,0,0,.15)`;
  mEl.textContent=(r?.name||'').split(' ').map(w=>w[0]).join('').slice(0,2);
  miniMarkers[id]=L.marker(COURSE_LATLNGS[0],{icon:L.divIcon({className:'',html:mEl.outerHTML,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(map);
  miniMaps[id]=map; setTimeout(()=>map.invalidateSize(),100);
}
function updateMiniMarker(id,pct){
  if(!miniMaps[id]) initMiniMap(id);
  const marker=miniMarkers[id]; if(!marker) return;
  const idx=Math.min(Math.floor(pct/100*(COURSE_LATLNGS.length-1)),COURSE_LATLNGS.length-1);
  const ll=COURSE_LATLNGS[idx]; marker.setLatLng(ll); miniMaps[id].panTo(ll,{animate:true,duration:.5});
}
function initFullMap(){
  mapInited=true;
  fullMap=L.map('map',{center:[40.638,-73.974],zoom:12});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'© CARTO © OSM'}).addTo(fullMap);
  L.polyline(COURSE_LATLNGS,{color:'#007AFF',weight:5,opacity:.9}).addTo(fullMap);
  CHECKPOINTS.forEach(cp=>{
    const isEnd=cp.label.includes('Start')||cp.label.includes('Finish');
    const col=isEnd?'#FF9500':(cp.spectator?'#007AFF':'#34C759');
    L.circleMarker([cp.lat,cp.lng],{radius:isEnd?8:5,color:col,fillColor:col,fillOpacity:.25,weight:2.5}).addTo(fullMap).bindPopup(`<b>${cp.label}</b><br>${cp.mi} miles`);
  });
  REG.forEach(r=>{
    const el=document.createElement('div');
    el.style.cssText=`width:26px;height:26px;border-radius:50%;background:#fff;border:2.5px solid ${r.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${r.color};box-shadow:0 2px 8px rgba(0,0,0,0.15)`;
    el.textContent=r.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    markers[r.id]=L.marker(COURSE_LATLNGS[0],{icon:L.divIcon({className:'',html:el.outerHTML,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(fullMap).bindPopup(`${r.emoji} ${r.name}`);
  });
  setTimeout(()=>fullMap.invalidateSize(),150); initElevChart();
}
function updateMarker(id,pct){
  const m=markers[id]; if(!m) return;
  const idx=Math.min(Math.floor(pct/100*(COURSE_LATLNGS.length-1)),COURSE_LATLNGS.length-1);
  m.setLatLng(COURSE_LATLNGS[idx]);
  const s=STATE[id],r=REG.find(r=>r.id===id);
  if(s&&r) m.getPopup()?.setContent(`<b>${r.emoji} ${r.name}</b><br>${s.distMi.toFixed(2)} mi · ${fmtHMS(s.elapsedSec)}`);
}


// ═══════════════════════════════════════════════════════════
// RUNNER STATS — career history, PRs, total distance
// ═══════════════════════════════════════════════════════════
function renderRunnerStats(id) {
  const el = document.getElementById('stats-section-' + id); if (!el) return;
  const r = REG.find(r => r.id === id); if (!r) return;
  const races  = loadRaces(id).sort((a,b) => b.date.localeCompare(a.date));
  if (!races.length) { el.innerHTML=''; return; }
  const totals = computeCareerTotals(races);
  const prs    = computePRs(races);

  const prRow = (label, r) => r ? `
    <div style="padding:9px 12px;border-bottom:1px solid var(--separator);display:flex;align-items:center;gap:10px">
      <div style="flex:1">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.3px;color:var(--text-tertiary)">${label}</div>
        <div style="font-size:13px;font-weight:500;color:var(--text-primary);margin-top:1px">${r.name}</div>
        <div style="font-size:10px;color:var(--text-muted)">${r.date} · ${r.location||''}</div>
      </div>
      <div style="font-size:20px;font-weight:700;color:${r.color || 'var(--blue)'};font-family:var(--font-mono)">${r.time}</div>
    </div>` : '';

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">🏅 Career Stats & Personal Bests</div>
        <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${races.length} races tracked</span>
      </div>
      <!-- Career totals -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));border-bottom:1px solid var(--separator)">
        ${[
          ['Total Races', totals.totalRaces],
          ['Total Miles', totals.totalMiles.toLocaleString()],
          ['Marathons',   totals.marathons],
          ['Halfs',       totals.halfs],
        ].map(([lbl,val])=>`<div style="padding:10px 14px;border-right:1px solid var(--separator)">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.3px;color:var(--text-tertiary)">${lbl}</div>
          <div style="font-size:22px;font-weight:700;color:${r.color};margin-top:2px">${val}</div>
        </div>`).join('')}
      </div>
      <!-- PRs -->
      <div style="border-bottom:1px solid var(--separator)">
        ${prRow('Marathon PR', prs.marathon ? {...prs.marathon, color: r.color} : null)}
        ${prRow('Half Marathon PR', prs.half ? {...prs.half, color: r.color} : null)}
      </div>
      <!-- Recent race history -->
      <div style="padding:8px 12px 4px">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary);margin-bottom:6px">Recent Races</div>
        ${races.slice(0,5).map(race => {
          const pr = Object.values(prs).some(p => p?.id === race.id);
          return `<div class="race-history-row">
            <span class="race-history-date">${race.date.slice(0,7)}</span>
            <span class="race-history-name">${pr?'<span class="pr-badge">PR</span>':''}${race.name}</span>
            <span style="font-size:10px;padding:1px 6px;border-radius:980px;background:var(--fill-blue);color:var(--accent);margin-right:6px">${race.type}</span>
            <span class="race-history-time">${race.time}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// WEATHER
// ═══════════════════════════════════════════════════════════
async function loadWeather(){
  if(wxLoaded)return; set('wx-desc','Loading…');
  try{ wxData=await fetchWeather(); const idxs=getRaceDayHours(wxData,'2026-05-16'); const i=idxs.length?(idxs.find(j=>wxData.hourly.time[j].includes('T07'))||idxs[0]):getCurrentHourIndex(wxData); const wx=extractHourData(wxData,i); const hourIdxs=idxs.length?idxs.slice(0,12):Array.from({length:12},(_,j)=>i+j); renderWeather(wx,!!idxs.length,hourIdxs); wxLoaded=true; }
  catch{ set('wx-desc','⚠️ Weather unavailable'); }
}
function renderWeather(wx,isRace,hourIdxs){
  set('wx-icon',getWeatherIcon(wx)); set('wx-temp',wx.temp+'°F'); set('wx-feels','Feels like '+wx.feels+'°F');
  set('wx-desc',(isRace?'Race day: ':'Current: ')+wx.temp+'°F, '+(wx.cloud<30?'clear':'partly cloudy'));
  set('wx-loc',isRace?'Brooklyn · May 16 · 7AM forecast':'Brooklyn · Current (May 16 forecast available closer to race)');
  set('wx-wind',wx.wind+' mph'); set('wx-wdir',wx.windDir+' wind'); set('wx-hum',wx.humid+'%'); set('wx-dew',wx.dew+'°F'); set('wx-rain',wx.rain+'%'); set('wx-cloud',wx.cloud+'% cloud');
  const impact=analyzeRaceImpact(wx); const impEl=document.getElementById('wx-impact'); if(impEl){impEl.textContent=impact.summary+' '+impact.parts.join(' · ');impEl.className='wx-impact '+impact.cls;}
  if(wxData&&hourIdxs){
    const ctx=document.getElementById('wx-hourly'); if(!ctx)return; if(charts['wx']){charts['wx'].destroy();delete charts['wx'];}
    const labs=hourIdxs.map(i=>{const h=parseInt(wxData.hourly.time[i].slice(11,13));return h<12?`${h||12}am`:h===12?'12pm':`${h-12}pm`;});
    const temps=hourIdxs.map(i=>Math.round(wxData.hourly.temperature_2m[i])); const winds=hourIdxs.map(i=>Math.round(wxData.hourly.windspeed_10m[i]));
    charts['wx']=new Chart(ctx,{type:'line',data:{labels:labs,datasets:[{label:'Temp °F',data:temps,borderColor:'#007AFF',borderWidth:2.5,fill:true,backgroundColor:'rgba(0,122,255,.07)',tension:.4,yAxisID:'y',pointRadius:3,pointBackgroundColor:'#007AFF'},{label:'Wind mph',data:winds,borderColor:'#FF9500',borderWidth:2,borderDash:[4,3],backgroundColor:'transparent',tension:.4,yAxisID:'y2',pointRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#5a8db5',font:{size:10},usePointStyle:true}},tooltip:{backgroundColor:'rgba(255,255,255,0.97)',titleColor:'#0c2340',bodyColor:'#1e4976',borderColor:'rgba(14,165,233,0.2)',borderWidth:1}},scales:{x:{ticks:{color:'#5a8db5',font:{size:10}},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}},y:{position:'left',ticks:{color:'#5a8db5',font:{size:10},callback:v=>v+'°'},grid:{color:'rgba(14,165,233,.07)'},border:{display:false}},y2:{position:'right',ticks:{color:'#FF9500',font:{size:10},callback:v=>v+'mph'},grid:{display:false},border:{display:false}}}}});
  }
}

// ═══════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════
function renderPctScenarios(){
  REG.filter(r=>['gf','mom'].includes(r.id)).forEach(r=>{
    const goals=GOALS[r.id]; const el=document.getElementById(r.id+'-pct-rows'); if(!el)return;
    const rows=goals.scenarios.map(s=>{
      const profile=s.flatPace?buildNonLinearProfile(goals,s.flatPace,100):buildGoalProfile(goals,100);
      const sec=Math.round(profile.at(-1)?.sec||0); const pct=getPercentile(sec);
      return`<div class="pct-row"><span style="color:${s.color}">${s.emoji} ${s.label}</span><span style="font-family:var(--font-mono)">${fmtHMS(sec)} · Top ${pct}%</span></div>`;
    });
    const gSec=Math.round(buildGoalProfile(goals,100).at(-1)?.sec||0);
    rows.push(`<div class="pct-row"><span style="color:#FF3B30">🎯 ${goals.goalLabel}</span><span style="font-family:var(--font-mono)">${fmtHMS(gSec)} · Top ${getPercentile(gSec)}%</span></div>`);
    el.innerHTML=rows.join('');
    const bigEl=document.getElementById(r.id+'-pct-big');
    if(bigEl){bigEl.textContent='Top '+getPercentile(gSec)+'%';bigEl.style.color=r.color;}
  });
}
window.lookupPct=function(){
  const t=document.getElementById('lookup-time')?.value; if(!t)return;
  const p=t.split(':').map(Number); const sec=p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*3600+p[1]*60;
  set('pct-result',`Top ${getPercentile(sec)}% 🏅`);
};

// ═══════════════════════════════════════════════════════════
// FETCH + REFRESH
// ═══════════════════════════════════════════════════════════
async function doRefresh(){
  const ring=document.getElementById('spinRing'); if(ring)ring.classList.add('on');
  await Promise.all(REG.map(async r=>{ const changed=await fetchRunnerData(STATE[r.id]); if(changed){computeETA(STATE[r.id],GOALS[r.id]);renderRunner(r.id);} }));
  lastRefresh=Date.now(); if(ring)ring.classList.remove('on'); updateRefreshLabel();
}
function updateRefreshLabel(){ if(!lastRefresh)return; const s=Math.round((Date.now()-lastRefresh)/1000); set('lastUpd',s<5?'Just updated':`${s}s ago`); }
function startAutoRefresh(){ setInterval(()=>doRefresh(),60000); }
window.manualRefresh=async function(){ const btn=document.getElementById('refreshBtn'); if(btn)btn.textContent='↻ Loading…'; await doRefresh(); if(btn)btn.textContent='↻'; notify('Refreshed ⚡'); };

// ═══════════════════════════════════════════════════════════
// COUNTDOWN + CLOCK
// ═══════════════════════════════════════════════════════════
function updateClock(){
  const d=RACE_START-new Date(); if(d<=0){['d','h','m','s'].forEach(k=>set('cd-'+k,'🏃'));return;}
  set('cd-d',String(Math.floor(d/86400000)).padStart(2,'0')); set('cd-h',String(Math.floor(d%86400000/3600000)).padStart(2,'0'));
  set('cd-m',String(Math.floor(d%3600000/60000)).padStart(2,'0')); set('cd-s',String(Math.floor(d%60000/1000)).padStart(2,'0'));
}

// ═══════════════════════════════════════════════════════════
// CHEER + NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
window.sendCheer=function(id){ const r=REG.find(r=>r.id===id);if(!r)return; const btn=document.getElementById('cheer-btn-'+id); if(btn){btn.textContent='🎉 Cheer sent!';btn.className='cheer-btn cheer-sent';} window.open(`https://rtrt.me/bkh2026/track/${r.trackId}#cheer`,'_blank'); notify(`Cheer sent! 🎉`); setTimeout(()=>{if(btn){btn.innerHTML=`<span>📣</span> Send Cheer to ${r.name.split(' ')[0]}`;btn.className='cheer-btn';}},5000); };
const notified={};
async function requestNotificationPermission(){ if('Notification' in window&&Notification.permission==='default') await Notification.requestPermission(); }
function checkNotifications(id,s){ if(!('Notification'in window)||Notification.permission!=='granted')return; const r=REG.find(r=>r.id===id);if(!r)return; [25,50,75,90,100].forEach(m=>{ const key=id+'-'+m; if(!notified[key]&&s.pct>=m){ notified[key]=true; new Notification(`${r.emoji} ${r.name.split(' ')[0]} — ${m===100?'Finished!':m+'% done'}`,{body:m===100?`🎉 Finished in ${fmtHMS(s.elapsedSec)}!`:`${s.distMi.toFixed(1)} mi · ${fmtPace(s.elapsedSec,s.distMi)}/mi${s.etaSec?` · proj ${fmtHMS(s.etaSec)}`:''}`,icon:'/icon-192.png'}); } }); }

// ═══════════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════════
let notifTO;
function notify(msg){ const el=document.getElementById('notif'),txt=document.getElementById('notif-text'); if(!el||!txt)return; txt.textContent=msg; el.classList.add('show'); clearTimeout(notifTO); notifTO=setTimeout(()=>el.classList.remove('show'),3000); }

// Expose globals
window.showTab=showTab; window.openRunnerSettings=openRunnerSettings; window.lookupPct=window.lookupPct;

// ═══════════════════════════════════════════════════════════
// DEV MODE — password login + race simulation
// ═══════════════════════════════════════════════════════════
const DEV_PW = 'sagichnicht';
let devLoggedIn = false;

window.openDevLogin = function() {
  document.getElementById('dev-login-modal').classList.add('open');
  document.getElementById('dev-pw').value = '';
  document.getElementById('dev-err').style.display = 'none';
  setTimeout(() => document.getElementById('dev-pw').focus(), 100);
};
window.closeDev = function() {
  document.getElementById('dev-login-modal').classList.remove('open');
};
window.devLogin = function() {
  const pw = document.getElementById('dev-pw').value;
  if (pw === DEV_PW) {
    devLoggedIn = true;
    document.getElementById('dev-login-modal').classList.remove('open');
    document.getElementById('dev-header-tools').style.display = 'flex';
    document.getElementById('dev-footer-link').textContent = '🛠 Developer (active)';
    document.getElementById('dev-footer-link').style.color = 'var(--orange)';
    // Mount dev database tab
    window._devREG = REG; window._devGOALS = GOALS;
    mountDevTab(REG, GOALS);
    notify('🛠 Developer mode ON');
  } else {
    document.getElementById('dev-err').style.display = 'block';
    document.getElementById('dev-pw').focus();
  }
};
window.devLogout = function() {
  devLoggedIn = false;
  document.getElementById('dev-header-tools').style.display = 'none';
  document.getElementById('dev-footer-link').textContent = '🛠 Developer';
  document.getElementById('dev-footer-link').style.color = '';
  unmountDevTab();
  simRace('pre');
  showTab('family');
  notify('Developer mode off');
};

// Simulate race state at different milestones
window.simRace = function(stage) {
  var GF  = { pre:{distMi:0,elapsedSec:0,status:'pre'}, early:{distMi:3.0,elapsedSec:1200,status:'running'}, park:{distMi:6.2,elapsedSec:2580,status:'running'}, ocean:{distMi:9.3,elapsedSec:3840,status:'running'}, late:{distMi:11.0,elapsedSec:4500,status:'running'}, finish:{distMi:13.1,elapsedSec:5292,status:'finished'} };
  var MOM = { pre:{distMi:0,elapsedSec:0,status:'pre'}, early:{distMi:2.7,elapsedSec:1500,status:'running'}, park:{distMi:5.5,elapsedSec:3300,status:'running'}, ocean:{distMi:8.0,elapsedSec:4920,status:'running'}, late:{distMi:9.8,elapsedSec:6060,status:'running'}, finish:{distMi:13.1,elapsedSec:7680,status:'finished'} };
  REG.forEach(function(r) {
    var id = r.id;
    var d = (id === 'gf') ? GF[stage] : MOM[stage];
    if (!d || !STATE[id]) return;
    STATE[id].distMi = d.distMi;
    STATE[id].elapsedSec = d.elapsedSec;
    STATE[id].status = d.status;
    STATE[id].pct = (d.distMi / TOTAL_MI) * 100;
    STATE[id].lastUpdate = Date.now();
    if (d.distMi > 0 && d.elapsedSec > 0) {
      var goals = GOALS[id] || GOALS.gf;
      var pace  = d.elapsedSec / Math.max(d.distMi, 0.01);
      var prof  = buildNonLinearProfile(goals, pace, 100);
      STATE[id].paceHistory = prof.filter(function(p){return p.mi>0&&p.mi<=d.distMi;}).map(function(p){return {mi:p.mi,elapsedSec:Math.round(p.sec)};});
      STATE[id].paceHistory.push({mi:d.distMi, elapsedSec:d.elapsedSec});
      computeETA(STATE[id], goals);
    } else {
      STATE[id].etaSec = null; STATE[id].conf = 0; STATE[id].paceHistory = [];
    }
    renderRunner(id);
  });
  notify('Simulating: ' + stage);
};

// ═══════════════════════════════════════════════════════════
// GENDER + AGE GROUP STATS
// ═══════════════════════════════════════════════════════════

// Women's median finish times by age group (RBC Brooklyn Half 2025 estimates)
const WOMEN_AGE_GROUPS = [
  { range:'18–24', median:7620, label:'2:07:00' },
  { range:'25–29', median:7500, label:'2:05:00', highlight:true }, // Catherine's group
  { range:'30–34', median:7680, label:'2:08:00' },
  { range:'35–39', median:7800, label:'2:10:00' },
  { range:'40–44', median:7980, label:'2:13:00' },
  { range:'45–49', median:8100, label:'2:15:00' },
  { range:'50–54', median:8400, label:'2:20:00' },
  { range:'55–59', median:8820, label:'2:27:00' },
  { range:'60+',   median:9600, label:'2:40:00' },
];

const MEN_AGE_GROUPS = [
  { range:'18–24', median:7020, label:'1:57:00' },
  { range:'25–29', median:6900, label:'1:55:00' },
  { range:'30–34', median:7080, label:'1:58:00' },
  { range:'35–39', median:7200, label:'2:00:00' },
  { range:'40–44', median:7380, label:'2:03:00' },
  { range:'45–49', median:7560, label:'2:06:00' },
  { range:'50–54', median:7860, label:'2:11:00' },
  { range:'55–59', median:8280, label:'2:18:00' },
  { range:'60+',   median:9000, label:'2:30:00' },
];

// Women's field CDF for percentile (separate from overall)
const WOMEN_FIELD_CDF = [
  [5400,0.5],[5700,1.5],[6000,4],[6300,9],[6600,17],[6900,27],
  [7200,37],[7500,48],[7800,58],[8100,67],[8400,74],[8700,80],
  [9000,86],[9600,91],[10200,95],[10800,97],[11400,99],
];

function getWomenPercentile(sec) {
  for (let i=0; i<WOMEN_FIELD_CDF.length-1; i++) {
    if (sec <= WOMEN_FIELD_CDF[i][0]) return 100-WOMEN_FIELD_CDF[i][1];
    if (sec <= WOMEN_FIELD_CDF[i+1][0]) {
      const t=(sec-WOMEN_FIELD_CDF[i][0])/(WOMEN_FIELD_CDF[i+1][0]-WOMEN_FIELD_CDF[i][0]);
      return Math.round(100-(WOMEN_FIELD_CDF[i][1]+(WOMEN_FIELD_CDF[i+1][1]-WOMEN_FIELD_CDF[i][1])*t));
    }
  }
  return 1;
}

function loadPersonalInfo(id) {
  try { const s=localStorage.getItem('blizzard_personal_'+id); if(s) return JSON.parse(s); } catch {}
  const defaults = { gf: { gender:'F', dob:'1998-05-25' }, mom: { gender:'F', dob:'1960-01-01' } };
  return defaults[id] || { gender:'F', dob:'1980-01-01' };
}
function savePersonalInfo(id, info) { localStorage.setItem('blizzard_personal_'+id, JSON.stringify(info)); }

function getAge(dob) {
  const d = new Date(dob), race = new Date('2026-05-16');
  let age = race.getFullYear() - d.getFullYear();
  if (race.getMonth() < d.getMonth() || (race.getMonth()===d.getMonth()&&race.getDate()<d.getDate())) age--;
  return age;
}

function getAgeGroup(age) {
  if (age < 25) return '18–24';
  if (age < 30) return '25–29';
  if (age < 35) return '30–34';
  if (age < 40) return '35–39';
  if (age < 45) return '40–44';
  if (age < 50) return '45–49';
  if (age < 55) return '50–54';
  if (age < 60) return '55–59';
  return '60+';
}

function renderAgeGroups() {
  const el = document.getElementById('women-age-groups'); if(!el) return;
  const gfInfo = loadPersonalInfo('gf');
  const gfAge  = getAge(gfInfo.dob);
  const gfGroup = getAgeGroup(gfAge);
  el.innerHTML = WOMEN_AGE_GROUPS.map(g => `
    <div class="age-group-row${g.range===gfGroup?' highlight':''}">
      <span style="font-size:11px;color:var(--text-secondary)">${g.range}${g.range===gfGroup?` <span style="color:#007AFF;font-size:10px">← Catherine</span>`:''}</span>
      <span style="font-family:var(--font-mono);font-size:12px">${g.label} median</span>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
// FAMILY HQ SPOT ETAs
// ═══════════════════════════════════════════════════════════
function updateFamSpotETAs() {
  const s = STATE.gf;
  if (!s || s.distMi < 0.5 || !s.elapsedSec) return;
  const pace = s.elapsedSec / s.distMi;
  SPECTATOR_SPOTS.forEach((sp, i) => {
    const el = document.getElementById('fam-spot-'+i); if(!el) return;
    if (sp.mi <= s.distMi) { el.innerHTML = `<div class="spot-eta-time" style="color:var(--green)">✓ Passed</div>`; return; }
    const profile = buildNonLinearProfile(GOALS.gf, pace, 100);
    const atNow = profile.find(p=>p.mi>=s.distMi)?.sec||0;
    const atSp  = profile.find(p=>p.mi>=sp.mi)?.sec||atNow;
    const etaSec = Math.round(s.elapsedSec + (atSp-atNow));
    const clock  = new Date(RACE_START.getTime() + etaSec*1000);
    el.innerHTML = `<div class="spot-eta-time">${fmtHMS(etaSec)}</div><div class="spot-eta-clock">${clock.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>`;
  });
}

// Patch renderRunner to also update fam spots
const _origRenderRunner = window._origRenderRunner;

// Update family countdown separately (different element IDs)
function updateFamClock() {
  const d = RACE_START - new Date();
  if(d<=0){['d','h','m','s'].forEach(k=>{const e=document.getElementById('fam-cd-'+k);if(e)e.textContent='🏃';});return;}
  const setFam=(k,v)=>{const e=document.getElementById('fam-cd-'+k);if(e)e.textContent=String(v).padStart(2,'0');};
  setFam('d',Math.floor(d/86400000));setFam('h',Math.floor(d%86400000/3600000));
  setFam('m',Math.floor(d%3600000/60000));setFam('s',Math.floor(d%60000/1000));
}
setInterval(updateFamClock,1000); updateFamClock();

// ═══════════════════════════════════════════════════════════
// RUNNER SETTINGS — personal info patch
// ═══════════════════════════════════════════════════════════
const _origOpenRunnerSettings = window.openRunnerSettings;
window.openRunnerSettings = function(id) {
  _origOpenRunnerSettings(id);
  const info = loadPersonalInfo(id);
  const gSel = document.getElementById('rs-gender');
  if (gSel) gSel.value = info.gender || 'F';
  const dob  = document.getElementById('rs-dob');
  if (dob)  dob.value  = info.dob   || '';
};
const _origSaveRunnerSettings = window.saveRunnerSettings;
window.saveRunnerSettings = function() {
  const id = settingsRunnerId; if(!id) return;
  const gender = document.getElementById('rs-gender')?.value;
  const dob    = document.getElementById('rs-dob')?.value;
  if (gender || dob) savePersonalInfo(id, { gender: gender||'F', dob: dob||'' });
  _origSaveRunnerSettings();
  renderMergedAgeGroups();
};

// ═══════════════════════════════════════════════════════════
// RENDER PATCH — update header runner status + fam spots
// ═══════════════════════════════════════════════════════════
const _patchedRenderRunner = renderRunner;
// Patch in header status updates after each render
const origRenderAll = renderAll;
function patchedRenderAll() { origRenderAll(); updateHeaderStatus(); updateFamSpotETAs(); renderMergedAgeGroups(); }

function updateHeaderStatus() {
  ['gf','mom'].forEach(id => {
    const s = STATE[id]; if(!s) return;
    const el = document.getElementById('hdr-'+id+'-status'); if(!el) return;
    if (s.status==='running') el.textContent = s.distMi.toFixed(1)+'mi · '+fmtPace(s.elapsedSec,s.distMi)+'/mi';
    else if (s.status==='finished') el.textContent = 'Finished! '+fmtHMS(s.elapsedSec);
    else el.textContent = 'Pre-race';
  });
}

// Patch the doRefresh to also update header
const origDoRefresh = window.manualRefresh;
// consolidated into main DOMContentLoaded

// ═══════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES
// ═══════════════════════════════════════════════════════════
const NOTIF_PREFS_KEY = 'blizzard_notif_prefs';
const DEFAULT_NOTIF_PREFS = {
  milestone25: true, milestone50: true, milestone75: true,
  milestone90: true, finish: true, spectator: true,
};

function loadNotifPrefs() {
  try { const s = localStorage.getItem(NOTIF_PREFS_KEY); if (s) return {...DEFAULT_NOTIF_PREFS,...JSON.parse(s)}; } catch {}
  return {...DEFAULT_NOTIF_PREFS};
}
function saveNotifPrefs(prefs) { localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs)); }

window.openNotifModal = function() {
  const existing = document.getElementById('notif-modal');
  if (existing) { existing.classList.add('open'); return; }
  const prefs = loadNotifPrefs();
  const defs = [
    { key:'milestone25', label:'📍 25% complete (mile ~3)' },
    { key:'milestone50', label:'📍 Halfway! (mile ~6.5)' },
    { key:'milestone75', label:'📍 75% done (mile ~10)' },
    { key:'milestone90', label:'📍 Almost there! (mile ~12)' },
    { key:'finish',      label:'🏆 Finish line crossed' },
    { key:'spectator',   label:'⏱ Spectator spot ETAs (when running near)' },
  ];
  const m = document.createElement('div');
  m.className = 'modal-overlay open'; m.id = 'notif-modal';
  m.innerHTML = `<div class="modal-sheet" style="position:relative;max-width:400px">
    <div class="modal-handle"></div>
    <button class="modal-close-btn" onclick="document.getElementById('notif-modal').classList.remove('open')">✕</button>
    <div class="modal-title">🔔 Notification Preferences</div>
    <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:14px">Get notified at these race milestones. You'll need to allow notifications when your browser asks.</p>
    <div id="notif-pref-list">${defs.map(d=>`
      <div class="notif-pref-row">
        <label>${d.label}</label>
        <label class="notif-toggle">
          <input type="checkbox" id="np-${d.key}" ${prefs[d.key]?'checked':''} onchange="saveNotifPref('${d.key}',this.checked)">
          <span class="notif-toggle-slider"></span>
        </label>
      </div>`).join('')}</div>
    <div style="margin-top:14px;display:flex;gap:8px">
      <button class="btn" onclick="requestNotificationPermission().then(()=>notify('Notifications enabled ✓'))" style="flex:1">Enable Notifications</button>
      <button class="btn btn-ghost" onclick="document.getElementById('notif-modal').classList.remove('open')">Done</button>
    </div>
  </div>`;
  document.body.appendChild(m);
};

window.saveNotifPref = function(key, val) {
  const p = loadNotifPrefs(); p[key] = val; saveNotifPrefs(p);
};

// ═══════════════════════════════════════════════════════════
// GENDER/AGE PERCENTILE PROJECTIONS (patch stats render)
// ═══════════════════════════════════════════════════════════
function getAgeGroupCDF(gender, ageGroup) {
  // Women's percentile CDFs by age group (estimated from race data)
  const WOMEN_CDFS = {
    '18–24': [[4800,0.5],[5400,2],[5700,5],[6000,12],[6300,20],[6600,30],[6900,40],[7200,51],[7500,61],[7800,70],[8100,77],[8700,85],[9600,92],[11400,99]],
    '25–29': [[4800,0.5],[5400,1.5],[5700,4],[6000,9],[6300,17],[6600,27],[6900,37],[7200,48],[7500,58],[7800,67],[8100,74],[8700,82],[9600,91],[11400,99]],
    '30–34': [[5100,0.5],[5700,3],[6000,8],[6300,16],[6600,26],[6900,37],[7200,48],[7500,58],[7800,67],[8100,74],[8700,83],[9600,92],[11400,99]],
    '35–39': [[5400,1],[5700,3],[6000,8],[6300,17],[6600,27],[6900,38],[7200,49],[7500,59],[7800,68],[8100,75],[8700,84],[9600,93],[11400,99]],
    '40–44': [[5400,1],[6000,6],[6300,14],[6600,24],[6900,35],[7200,46],[7500,57],[7800,66],[8100,74],[8400,80],[8700,85],[9600,93],[11400,99]],
    '45–49': [[5700,1],[6000,4],[6300,11],[6600,20],[6900,31],[7200,43],[7500,54],[7800,64],[8100,72],[8700,82],[9600,91],[11400,99]],
    '50–54': [[6000,2],[6300,7],[6600,15],[6900,26],[7200,38],[7500,50],[7800,61],[8100,70],[8700,81],[9600,91],[11400,99]],
    '55–59': [[6300,2],[6600,7],[6900,16],[7200,28],[7500,41],[7800,53],[8100,63],[8700,77],[9600,89],[11400,99]],
    '60+':   [[6900,3],[7200,10],[7500,22],[7800,36],[8100,50],[8700,67],[9600,83],[11400,99]],
  };
  const MEN_CDFS = {
    '18–24': [[4200,0.5],[4800,2],[5400,5],[5700,11],[6000,20],[6300,31],[6600,42],[6900,53],[7200,63],[7800,75],[8400,84],[9600,94],[11400,99]],
    '25–29': [[4200,0.5],[4800,2],[5400,5],[5700,10],[6000,18],[6300,28],[6600,39],[6900,50],[7200,60],[7800,73],[8400,83],[9600,93],[11400,99]],
    '30–34': [[4500,0.5],[5100,3],[5700,9],[6000,17],[6300,27],[6600,38],[6900,49],[7200,59],[7800,72],[8400,82],[9600,92],[11400,99]],
    '35–39': [[4800,0.5],[5400,3],[5700,8],[6000,16],[6300,26],[6600,37],[6900,48],[7200,58],[7800,71],[8400,81],[9600,92],[11400,99]],
    '40–44': [[5100,1],[5700,4],[6000,10],[6300,19],[6600,30],[6900,41],[7200,52],[7800,65],[8400,76],[9000,85],[10200,93],[11400,99]],
    '45–49': [[5400,1],[6000,5],[6300,13],[6600,22],[6900,33],[7200,44],[7800,58],[8400,70],[9000,80],[10200,90],[11400,99]],
    '50–54': [[5700,1],[6000,4],[6300,10],[6600,18],[6900,28],[7200,39],[7800,53],[8400,66],[9000,77],[10200,88],[11400,99]],
    '55–59': [[6000,1],[6300,5],[6600,12],[6900,21],[7200,33],[7800,48],[8400,62],[9000,74],[10200,85],[11400,99]],
    '60+':   [[6300,2],[6600,7],[6900,15],[7200,26],[7800,42],[8400,57],[9000,70],[10200,83],[11400,99]],
  };
  const cdfs = gender === 'M' ? MEN_CDFS : WOMEN_CDFS;
  return cdfs[ageGroup] || cdfs['25–29'];
}

function getAgeGroupPercentile(sec, gender, ageGroup) {
  const cdf = getAgeGroupCDF(gender, ageGroup);
  for (let i = 0; i < cdf.length - 1; i++) {
    if (sec <= cdf[i][0]) return 100 - cdf[i][1];
    if (sec <= cdf[i+1][0]) {
      const t = (sec - cdf[i][0]) / (cdf[i+1][0] - cdf[i][0]);
      return Math.round(100 - (cdf[i][1] + (cdf[i+1][1] - cdf[i][1]) * t));
    }
  }
  return 1;
}

// Override renderPctScenarios to use age/gender
function renderPctScenariosV5() {
  const runners = [
    { id:'gf',  color:'#007AFF', label:'⚡ Catherine' },
    { id:'mom', color:'#5856D6', label:'💜 Helaine'   },
  ];
  runners.forEach(({id, color, label}) => {
    const goals  = GOALS[id]; if(!goals) return;
    const info   = loadPersonalInfo(id);
    const age    = getAge(info.dob);
    const ageGrp = getAgeGroup(age);
    const gender = info.gender || 'F';
    const genderLabel = gender === 'M' ? 'Men' : gender === 'F' ? 'Women' : 'Non-binary';

    const el = document.getElementById(id+'-pct-rows'); if(!el) return;
    const rows = goals.scenarios.map(s => {
      const profile = s.flatPace ? buildNonLinearProfile(goals,s.flatPace,100) : buildGoalProfile(goals,100);
      const sec = Math.round(profile.at(-1)?.sec||0);
      const pctOverall = getPercentile(sec);
      const pctAgeGrp  = getAgeGroupPercentile(sec, gender, ageGrp);
      return `<div class="pct-row">
        <span style="color:${s.color}">${s.emoji} ${s.label}</span>
        <div style="text-align:right">
          <div style="font-family:var(--font-mono);font-size:11px">${fmtHMS(sec)}</div>
          <div style="font-size:10px;color:var(--text-tertiary)">Overall top ${pctOverall}% · ${genderLabel} ${ageGrp} top ${pctAgeGrp}%</div>
        </div>
      </div>`;
    });
    const gSec = Math.round(buildGoalProfile(goals,100).at(-1)?.sec||0);
    const gPct = getAgeGroupPercentile(gSec, gender, ageGrp);
    rows.push(`<div class="pct-row">
      <span style="color:#FF3B30">🎯 ${goals.goalLabel}</span>
      <div style="text-align:right">
        <div style="font-family:var(--font-mono);font-size:11px">${fmtHMS(gSec)}</div>
        <div style="font-size:10px;color:var(--text-tertiary)">${genderLabel} ${ageGrp} top ${gPct}%</div>
      </div>
    </div>`);
    el.innerHTML = rows.join('');

    const bigEl = document.getElementById(id+'-pct-big');
    if (bigEl) { bigEl.textContent = `Top ${gPct}%`; bigEl.style.color = color; }
    const subEl = document.getElementById(id+'-pct-sub');
    if (subEl) subEl.textContent = `${genderLabel} · Age group ${ageGrp} · Age ${age} at race`;
  });
}

// Call it on DOMContentLoaded and after settings save
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(renderPctScenariosV5, 200);
  renderMergedAgeGroups();
});

function renderHelainerStats() {
  const el = document.getElementById('helaine-age-groups'); if (!el) return;
  const info = loadPersonalInfo('mom');
  const age  = getAge(info.dob);
  const grp  = getAgeGroup(age);
  const gender = info.gender || 'F';
  const table = gender === 'M' ? MEN_AGE_GROUPS : WOMEN_AGE_GROUPS;
  el.innerHTML = (table || WOMEN_AGE_GROUPS).map(g => `
    <div class="age-group-row${g.range===grp?' highlight':''}">
      <span style="font-size:11px;color:var(--text-secondary)">${g.range}${g.range===grp?` <span style="color:#5856D6;font-size:10px">← Helaine</span>`:''}</span>
      <span style="font-family:var(--font-mono);font-size:12px">${g.label} median</span>
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════════
// DEV MODE HEADER STATUS FIX
// ═══════════════════════════════════════════════════════════
// Override simRace to also update header
// simRace handles all runners inline now — just update fam map after
window.addEventListener('DOMContentLoaded', () => {
  const _origSimRaceForFam = window.simRace;
  window.simRace = function(stage) {
    _origSimRaceForFam(stage);
    setTimeout(function() {
      updateHeaderStatus();
      updateFamSpotETAs();
      updateFamMapMarkers();
      if(window._famMap) window._famMap.invalidateSize();
    }, 80);
  };
});;

// ═══════════════════════════════════════════════════════════
// FAMILY MAP (embedded Leaflet on Family HQ)
// ═══════════════════════════════════════════════════════════
let famMapInited = false;
const famMarkers = {};

function initFamMap() {
  if (famMapInited) return;
  const el = document.getElementById('fam-map'); if(!el) return;
  famMapInited = true;

  const map = L.map(el, { center:[40.638,-73.974], zoom:11 });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'© CARTO © OSM'}).addTo(map);
  L.polyline(COURSE_LATLNGS,{color:'#007AFF',weight:4,opacity:.8}).addTo(map);

  // Start and finish markers
  CHECKPOINTS.filter(cp=>cp.spectator).forEach(cp=>{
    const isEnd = cp.label.includes('Start')||cp.label.includes('Finish');
    const col = isEnd ? '#FF9500' : '#007AFF';
    L.circleMarker([cp.lat,cp.lng],{radius:isEnd?9:6,color:col,fillColor:col,fillOpacity:.3,weight:2.5})
     .addTo(map).bindPopup(`<b>${cp.label}</b>`);
  });

  // Runner markers
  REG.forEach(r=>{
    const el2=document.createElement('div');
    el2.style.cssText=`width:26px;height:26px;border-radius:50%;background:#fff;border:2.5px solid ${r.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${r.color};box-shadow:0 2px 8px rgba(0,0,0,.15)`;
    el2.textContent=r.name.split(' ').map(w=>w[0]).join('').slice(0,2);
    famMarkers[r.id]=L.marker(COURSE_LATLNGS[0],{icon:L.divIcon({className:'',html:el2.outerHTML,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(map).bindPopup(`${r.emoji} ${r.name}`);
  });

  setTimeout(()=>map.invalidateSize(),100);

  // Store for updates
  window._famMap = map;
}

// Update fam map markers when runner positions change
function updateFamMapMarkers() {
  REG.forEach(r=>{
    const m=famMarkers[r.id]; const s=STATE[r.id]; if(!m||!s||s.pct<0.1) return;
    const idx=Math.min(Math.floor(s.pct/100*(COURSE_LATLNGS.length-1)),COURSE_LATLNGS.length-1);
    m.setLatLng(COURSE_LATLNGS[idx]);
  });
}

// Init fam map on tab show
const _origShowTab = window.showTab;
window.showTab = function(id) {
  _origShowTab(id);
  if (id === 'family') { setTimeout(()=>{ initFamMap(); if(window._famMap) window._famMap.invalidateSize(); updateFamMapMarkers(); }, 100); }
};

// Also init on first load since family is the default tab
document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(initFamMap, 600); });


// ═══════════════════════════════════════════════════════════
// TOUR v2 — non-blocking spotlight, element highlighting,
//           state reset on exit, proper skip UX
// ═══════════════════════════════════════════════════════════

// Snapshot of state before tour starts (so we can reset)
let tourPreState = null;

function snapshotState() {
  return {
    gf:  JSON.parse(JSON.stringify(STATE.gf)),
    mom: JSON.parse(JSON.stringify(STATE.mom)),
  };
}
function restoreState(snap) {
  if (!snap) return;
  Object.assign(STATE.gf,  snap.gf);
  Object.assign(STATE.mom, snap.mom);
  renderAll();
  updateHeaderStatus();
}

// Each step: title, body, highlight text, targetEl selector (for spotlight), action fn
const TOUR_STEPS = [
  {
    title: "Welcome to Blizzard Tracker! 👋",
    body: "Your race day command center for Catherine & Helaine at the RBC Brooklyn Half 2026. Let me give you a quick 30-second tour.",
    highlight: null,
    tip: "💡 The tour won't block the page — feel free to click around!",
    targetSel: null,
    action: () => showTab('family'),
    pos: 'center',
  },
  {
    title: "Family HQ 🏠",
    body: "This is your home dashboard. It shows the live map, both runner stats, spectator spots with ETAs, and the course elevation profile all in one place.",
    highlight: '.celebrate-banner',
    tip: "👈 The celebration banner at the top shows race details.",
    targetSel: '.celebrate-banner',
    action: () => showTab('family'),
    pos: 'bottom',
  },
  {
    title: "The tab bar 🗂",
    body: "Switch between views using the tabs. You can drag-and-drop any tab to reorder them.",
    highlight: '#tab-bar',
    tip: "↕️ Drag tabs left or right to rearrange them however you like.",
    targetSel: '#tab-bar',
    action: () => {},
    pos: 'bottom',
  },
  {
    title: "Catherine's tracker ⚡",
    body: "Each runner has their own page with live distance, pace, predicted finish, and arrival ETAs at every spectator spot.",
    highlight: '#pane-gf .runner-hero-section',
    tip: "👉 The photo strip expands on hover — the running-on-dunes hero photo is her background!",
    targetSel: '#tab-gf',
    action: () => showTab('gf'),
    pos: 'bottom',
  },
  {
    title: "The pace chart 📈",
    body: "Shows the sub-90 goal line (red dashed) plus 5 race scenarios. Click any legend item to show or hide it. Scroll/pinch to zoom in.",
    highlight: '#gf .card',
    tip: "📌 Only the 🎯 target line is shown by default — click others to compare.",
    targetSel: '#gf-pace-chart',
    action: () => showTab('gf'),
    pos: 'top',
  },
  {
    title: "The Race Simulator 🎮",
    body: "Drag the slider to preview what any point in the race looks like. Let me simulate mile 6 (Prospect Park) for you now so you can see all the data come to life!",
    highlight: null,
    tip: "🔒 During the live race, the slider locks forward-only so you can't simulate backward.",
    targetSel: '#gf-pace-chart',
    action: () => { showTab('gf'); window.simRace && simRace('park'); },
    pos: 'top',
  },
  {
    title: "Race Settings ⚙️",
    body: "Click the ⚙ Settings button in each runner's hero section to change their goal time, milestone paces, gender, and date of birth (for age-group stats).",
    highlight: '.runner-settings-btn',
    tip: "📊 Changing gender/DOB updates the age-group percentile projections in the Stats tab.",
    targetSel: '.runner-settings-btn',
    action: () => showTab('gf'),
    pos: 'bottom',
  },
  {
    title: "Adding runners ➕",
    body: "Tap the ⊕ button at the end of the tab bar to add any runner with an RTRT tracker ID — a friend, pacer, anyone.",
    highlight: '.tab-add-btn',
    tip: "You'll need their RTRT tracker ID from the official NYRR tracking link.",
    targetSel: '.tab-add-btn',
    action: () => {},
    pos: 'bottom',
  },
  {
    title: "Push Notifications 🔔",
    body: "Enable race-day notifications so you don't miss a milestone. The 🔔 button is in the Family HQ tab.",
    highlight: null,
    tip: "👈 Let me take you there now.",
    targetSel: '[onclick="openNotifModal()"]',
    action: () => showTab('family'),
    pos: 'top',
  },
  {
    title: "You're all set! 🎉",
    body: "Race day is May 16 at 7:00 AM ET. Add this page to your phone's home screen for the best experience.",
    highlight: null,
    tip: "📱 Safari → Share → 'Add to Home Screen'. Find the tour again anytime via the ? button (top-right).",
    targetSel: null,
    action: () => { showTab('family'); window.simRace && simRace('pre'); },
    pos: 'center',
  },
];

let tourStep = 0;
let tourActive = false;
let _spotlightEl = null;

window.startTour = function(fromButton = false) {
  // Always allow tour to run (ignore cookie when manually triggered)
  tourPreState = snapshotState();
  tourStep = 0; tourActive = true;
  clearSpotlight();
  renderTourStep();
};

function clearSpotlight() {
  document.querySelectorAll('.tour-spotlight-ring').forEach(e => e.remove());
  _spotlightEl = null;
}

function spotlightElement(sel) {
  clearSpotlight();
  if (!sel) return;
  try {
    const el = document.querySelector(sel);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Only spotlight if element is visible on screen
    if (rect.width === 0 || rect.height === 0) return;
    const pad = 6;
    const ring = document.createElement('div');
    ring.className = 'tour-spotlight-ring';
    ring.style.cssText = `position:fixed;z-index:4999;pointer-events:none;
      top:${Math.max(0, rect.top - pad)}px;left:${Math.max(0, rect.left - pad)}px;
      width:${rect.width + pad*2}px;height:${rect.height + pad*2}px;
      border:2.5px solid #007AFF;border-radius:10px;
      box-shadow:0 0 0 4000px rgba(0,0,0,0.35);
      animation:tour-pulse 1.8s ease infinite;`;
    document.body.appendChild(ring);
    _spotlightEl = ring;
  } catch(e) { console.warn('spotlight error:', e); }
}

function renderTourStep() {
  document.querySelector('.tour-card-wrap')?.remove();
  if (!tourActive || tourStep >= TOUR_STEPS.length) { endTour(); return; }

  const s = TOUR_STEPS[tourStep];
  if (s.action) s.action();
  setTimeout(() => { if (s.targetSel) spotlightElement(s.targetSel); else clearSpotlight(); }, 350);

  const wrap = document.createElement('div');
  wrap.className = 'tour-card-wrap';

  // Position card: center, top, or bottom
  const posStyle = s.pos === 'center'
    ? 'top:50%;left:50%;transform:translate(-50%,-50%)'
    : s.pos === 'top'
      ? 'top:80px;left:50%;transform:translateX(-50%)'
      : 'bottom:20px;left:50%;transform:translateX(-50%)';

  wrap.style.cssText = `position:fixed;z-index:5000;${posStyle};width:min(420px,calc(100vw - 32px));pointer-events:auto;`;

  wrap.innerHTML = `
    <div class="tour-card" style="position:relative">
      <button onclick="endTour()" title="Close tour" style="
        position:absolute;top:12px;right:12px;
        width:26px;height:26px;border-radius:50%;
        background:rgba(0,0,0,0.08);border:none;cursor:pointer;
        font-size:14px;color:var(--text-secondary);
        display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
      <div class="tour-step-pill">Step ${tourStep+1} of ${TOUR_STEPS.length}</div>
      <div class="tour-title">${s.title}</div>
      <div class="tour-body">${s.body}</div>
      ${s.tip ? `<div class="tour-highlight">${s.tip}</div>` : ''}
      <div class="tour-footer">
        <div class="tour-dots">${TOUR_STEPS.map((_,i)=>`<div class="tour-dot${i===tourStep?' active':''}"></div>`).join('')}</div>
        ${tourStep > 0 ? `<button class="btn btn-ghost btn-sm" onclick="tourPrev()">← Back</button>` : ''}
        ${tourStep < TOUR_STEPS.length - 1
          ? `<button class="btn btn-sm" onclick="tourNext()">Next →</button>`
          : `<button class="btn btn-sm btn-success" onclick="endTour(true)">🎉 Let's go!</button>`}
        <button onclick="endTour(false, true)" style="
          padding:0 10px;height:28px;border:none;background:none;
          font-size:12px;color:var(--text-muted);cursor:pointer;
          border-radius:6px;transition:background .15s"
          onmouseover="this.style.background='rgba(0,0,0,0.06)'"
          onmouseout="this.style.background='none'">Skip tour</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

window.tourNext = function() { tourStep++; renderTourStep(); };
window.tourPrev = function() { tourStep = Math.max(0,tourStep-1); renderTourStep(); };

window.endTour = function(completed = false, skipped = false) {
  tourActive = false;
  document.querySelector('.tour-card-wrap')?.remove();
  clearSpotlight();

  if (!completed) {
    // Reset any simulation state made during tour
    restoreState(tourPreState);
  }

  localStorage.setItem('blizzard_tour_done', '1');

  if (skipped) {
    notify('Tour skipped — tap the ? button (top right) to restart anytime 👆');
  } else if (!completed) {
    notify('Tour closed — tap ? anytime to restart');
  }
};

// Auto-start on first visit
document.addEventListener('DOMContentLoaded', () => {
  // Auto-start tour: check cookie, but always allow ? button to restart
  if (!localStorage.getItem('blizzard_tour_done')) {
    setTimeout(() => startTour(false), 2000);
  }
});

// ? button in top-right corner
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.createElement('button');
  btn.className = 'tour-info-btn'; btn.title = 'App guide & tour'; btn.textContent = '?';
  btn.onclick = () => startTour(true);
  document.body.appendChild(btn);
});

// ═══════════════════════════════════════════════════════════
// AGE GROUP TABLE — merged when same gender
// ═══════════════════════════════════════════════════════════
function renderMergedAgeGroups() {
  const gfInfo  = loadPersonalInfo('gf');
  const momInfo = loadPersonalInfo('mom');
  const gfAge   = getAge(gfInfo.dob),  gfGrp  = getAgeGroup(gfAge);
  const momAge  = getAge(momInfo.dob), momGrp = getAgeGroup(momAge);
  const samGender = gfInfo.gender === momInfo.gender;

  const gfGender  = gfInfo.gender  || 'F';
  const momGender = momInfo.gender || 'F';
  const gfTable   = gfGender  === 'M' ? MEN_AGE_GROUPS  : WOMEN_AGE_GROUPS;
  const momTable  = momGender === 'M' ? MEN_AGE_GROUPS  : WOMEN_AGE_GROUPS;

  const genderLabel = g => g === 'M' ? 'Men' : 'Women';

  if (samGender) {
    // One table for both
    const el = document.getElementById('women-age-groups'); if(!el) return;
    el.innerHTML = gfTable.map(g => {
      const isCat   = g.range === gfGrp;
      const isHel   = g.range === momGrp;
      const isBoth  = isCat && isHel;
      let badge = '';
      if (isBoth) badge = ` <span style="color:#007AFF;font-size:10px">← Catherine & Helaine</span>`;
      else if (isCat) badge = ` <span style="color:#007AFF;font-size:10px">← Catherine</span>`;
      else if (isHel) badge = ` <span style="color:#5856D6;font-size:10px">← Helaine</span>`;
      return `<div class="age-group-row${(isCat||isHel)?' highlight':''}">
        <span style="font-size:11px;color:var(--text-secondary)">${g.range}${badge}</span>
        <span style="font-family:var(--font-mono);font-size:12px">${g.label} median (${genderLabel(gfGender)})</span>
      </div>`;
    }).join('');

    // Hide Helaine's separate section
    const hEl = document.getElementById('helaine-age-groups');
    if (hEl) hEl.closest('.age-groups-helaine-wrap')?.style?.setProperty('display','none');
    const hSection = document.getElementById('helaine-age-section');
    if (hSection) hSection.style.display = 'none';
  } else {
    // Separate tables
    const gfEl = document.getElementById('women-age-groups'); if(gfEl) {
      gfEl.innerHTML = gfTable.map(g => `
        <div class="age-group-row${g.range===gfGrp?' highlight':''}">
          <span style="font-size:11px;color:var(--text-secondary)">${g.range}${g.range===gfGrp?` <span style="color:#007AFF;font-size:10px">← Catherine</span>`:''}</span>
          <span style="font-family:var(--font-mono);font-size:12px">${g.label} median</span>
        </div>`).join('');
    }
    const hEl = document.getElementById('helaine-age-groups'); if(hEl) {
      hEl.innerHTML = momTable.map(g => `
        <div class="age-group-row${g.range===momGrp?' highlight':''}">
          <span style="font-size:11px;color:var(--text-secondary)">${g.range}${g.range===momGrp?` <span style="color:#5856D6;font-size:10px">← Helaine</span>`:''}</span>
          <span style="font-family:var(--font-mono);font-size:12px">${g.label} median</span>
        </div>`).join('');
      const sect = document.getElementById('helaine-age-section');
      if (sect) sect.style.display = '';
    }
  }
}

// Replace old renderAgeGroups calls
// consolidated into main DOMContentLoaded

