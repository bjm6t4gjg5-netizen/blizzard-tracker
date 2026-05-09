// ============================================================
// main.js — Blizzard Tracker App Entry Point
// ============================================================

import '../css/main.css';
import {
  COURSE, COURSE_LATLNGS, CHECKPOINTS, ELEVATION, MILE_PACE_FACTORS
} from './data/course.js';
import {
  loadRegistry, saveRegistry, makeRunnerState,
  computeETA, getPercentile, buildPaceProfile, build90MinTarget,
  PROFILE_90, GF_SCENARIOS, MOM_SCENARIOS, scenarioFinishSec,
  fetchRunnerData, fmtHMS, fmtPace, FIELD_CDF
} from './data/runners.js';
import {
  fetchWeather, getRaceDayHours, getCurrentHourIndex,
  extractHourData, getWeatherIcon, analyzeRaceImpact
} from './data/weather.js';

// ── Leaflet + Chart.js loaded from CDN in index.html ──────
const L = window.L;
const Chart = window.Chart;

const TOTAL_MI   = 13.1;
const RACE_START = new Date('2026-05-16T07:00:00');

// ── App state ─────────────────────────────────────────────
let REG       = loadRegistry();
const STATE   = {};
REG.forEach(r => { STATE[r.id] = makeRunnerState(r); });

let mapInited  = false;
let leafMap    = null;
let markerMap  = {}; // id → Leaflet marker
let heatLayer  = null;
let wxLoaded   = false;
let wxData     = null;
let charts     = {};  // id → Chart instance
let simActive  = false;
let simPct     = 0;
let lastRefresh = null;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildTabs();
  buildPanes();
  renderAll();
  initCharts();
  renderPctScenarios();
  initSim();
  startAutoRefresh();
  doRefresh();
  setInterval(updateClock, 1000);
  setInterval(updateRefreshLabel, 5000);
  updateClock();
});

// ═══════════════════════════════════════════════════════════
// TABS — drag-and-drop reorder
// ═══════════════════════════════════════════════════════════
const FIXED_TABS = ['gf','mom','family','map','weather','stats','sim'];
let tabOrder = JSON.parse(localStorage.getItem('blizzard_tab_order') || 'null')
  || [...FIXED_TABS];

function saveTabOrder() {
  localStorage.setItem('blizzard_tab_order', JSON.stringify(tabOrder));
}

function buildTabs() {
  const bar = document.getElementById('tab-bar');
  bar.innerHTML = '';

  tabOrder.forEach(id => {
    if (!FIXED_TABS.includes(id) && !REG.find(r => r.id === id)) return;
    bar.appendChild(makeTab(id));
  });

  // Dynamic runner tabs
  REG.filter(r => !r.fixed).forEach(r => {
    if (!tabOrder.includes(r.id)) {
      bar.appendChild(makeTab(r.id));
      tabOrder.push(r.id);
    }
  });

  // Add + gear
  const addBtn = document.createElement('div');
  addBtn.className = 'tab-add-btn';
  addBtn.textContent = '⊕';
  addBtn.title = 'Manage runners';
  addBtn.onclick = openSettings;
  bar.appendChild(addBtn);

  setupDragDrop();
}

function makeTab(id) {
  const info = getTabInfo(id);
  const el = document.createElement('div');
  el.className = 'tab';
  el.id = 'tab-' + id;
  el.draggable = true;
  el.setAttribute('data-tab-id', id);

  const label = document.createTextNode(info.label);
  el.appendChild(label);

  // Close btn for dynamic tabs
  const r = REG.find(r => r.id === id);
  if (r && !r.fixed) {
    const x = document.createElement('span');
    x.className = 'tab-close-btn';
    x.textContent = '✕';
    x.onclick = (e) => { e.stopPropagation(); removeRunner(id); };
    el.appendChild(x);
  }

  el.addEventListener('click', () => showTab(id));
  return el;
}

function getTabInfo(id) {
  const map = {
    gf:          { label: '⚡ Catherine' },
    mom:         { label: '💜 Helaine'   },
    family:      { label: '🏠 Family HQ' },
    map:         { label: '🗺 Live Map'  },
    weather:     { label: '🌤 Weather'   },
    stats:       { label: '📊 Stats'     },
    sim:         { label: '🎮 Simulator' },
  };
  if (map[id]) return map[id];
  const r = REG.find(r => r.id === id);
  return { label: `${r?.emoji || '🏃'} ${r?.name?.split(' ')[0] || id}` };
}

function setupDragDrop() {
  const bar = document.getElementById('tab-bar');
  let dragging = null;

  bar.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('dragstart', e => {
      dragging = tab;
      tab.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    tab.addEventListener('dragend', () => {
      tab.classList.remove('dragging');
      bar.querySelectorAll('.tab').forEach(t => t.classList.remove('drag-over'));
      // Persist new order
      tabOrder = [...bar.querySelectorAll('.tab')].map(t => t.getAttribute('data-tab-id'));
      saveTabOrder();
    });
    tab.addEventListener('dragover', e => {
      e.preventDefault();
      if (tab !== dragging) {
        tab.classList.add('drag-over');
        const rect = tab.getBoundingClientRect();
        const mid  = rect.left + rect.width / 2;
        if (e.clientX < mid) bar.insertBefore(dragging, tab);
        else bar.insertBefore(dragging, tab.nextSibling);
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
  if (id === 'map' && !mapInited) initMap();
  if (id === 'weather' && !wxLoaded) loadWeather();
  if (id === 'sim') updateSimDisplay();
}

// ═══════════════════════════════════════════════════════════
// PANES — build HTML
// ═══════════════════════════════════════════════════════════
function buildPanes() {
  const main = document.querySelector('main');
  // Fixed panes are in index.html; only build dynamic ones here
  REG.filter(r => !r.fixed).forEach(r => {
    if (!document.getElementById('pane-' + r.id)) {
      main.insertBefore(makeDynPane(r), document.getElementById('pane-family'));
    }
  });
}

function makeDynPane(r) {
  const el = document.createElement('div');
  el.className = 'pane'; el.id = 'pane-' + r.id;
  const init = r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  el.innerHTML = `
    <div class="runner-header-card gap-md">
      <div class="runner-top-bar">
        <div class="avatar" style="background:${r.color}20;color:${r.color};border:1.5px solid ${r.color}40">${init}</div>
        <div>
          <div class="runner-name">${r.name}</div>
          <div class="runner-sub">Tracker · ${r.trackId}</div>
        </div>
        <div id="${r.id}-pill" class="status-badge status-pre"><span class="status-dot"></span>Pre-race</div>
      </div>
      <div class="stats-row">
        <div class="stat-cell"><div class="stat-label">Distance</div><div class="stat-num" id="${r.id}-dist" style="color:${r.color}">—</div><div class="stat-unit">of 13.1 mi</div></div>
        <div class="stat-cell"><div class="stat-label">Elapsed</div><div class="stat-num" id="${r.id}-elapsed" style="color:${r.color}">—</div><div class="stat-unit">HH:MM:SS</div></div>
        <div class="stat-cell"><div class="stat-label">Avg Pace</div><div class="stat-num" id="${r.id}-pace" style="color:${r.color}">—</div><div class="stat-unit">min/mile</div></div>
      </div>
      <div class="progress-section">
        <div class="progress-labels"><span>Brooklyn Museum</span><span id="${r.id}-pct-lbl">0%</span></div>
        <div class="progress-track"><div class="progress-fill" id="${r.id}-bar" style="background:${r.color};width:0%"></div></div>
        <div class="cp-row" id="${r.id}-cps"></div>
      </div>
      <div class="splits-section">
        <div class="splits-label">Checkpoint Splits</div>
        <table class="splits-table"><thead><tr><th>Point</th><th>Clock Time</th><th>Split Pace</th></tr></thead>
        <tbody id="${r.id}-splits"><tr><td class="split-empty" colspan="3">Race starts May 16 — live data populates here</td></tr></tbody></table>
      </div>
    </div>
    <div class="eta-card gap-md">
      <div class="eta-inner">
        <div class="eta-icon">${r.emoji}</div>
        <div>
          <div class="eta-label">Predicted Finish</div>
          <div class="eta-time" id="${r.id}-eta" style="color:${r.color}">—:—:—</div>
          <div class="eta-sub" id="${r.id}-eta-sub">Waiting for live data…</div>
        </div>
        <div class="eta-right"><div class="eta-conf" id="${r.id}-conf" style="color:${r.color}">—</div><div class="eta-conf-label">% confidence</div></div>
      </div>
    </div>`;
  STATE[r.id] = makeRunnerState(r);
  return el;
}

// ═══════════════════════════════════════════════════════════
// RENDER — update all DOM from state
// ═══════════════════════════════════════════════════════════
function renderAll() {
  REG.forEach(r => renderRunner(r.id));
}

function renderRunner(id) {
  const s = STATE[id]; if (!s) return;
  const pct = Math.min(100, s.pct);

  setEl(id + '-dist', s.distMi > 0 ? s.distMi.toFixed(2) : '—');
  setEl(id + '-elapsed', fmtHMS(s.elapsedSec));
  setEl(id + '-pace', fmtPace(s.elapsedSec, s.distMi));
  setEl(id + '-pct-lbl', pct.toFixed(1) + '%');

  const bar = document.getElementById(id + '-bar');
  if (bar) bar.style.width = pct + '%';

  // Status
  const pill = document.getElementById(id + '-pill');
  if (pill) {
    const { cls, label } = statusInfo(s.status);
    pill.className = 'status-badge ' + cls;
    pill.innerHTML = `<span class="status-dot"></span>${label}`;
  }

  // ETA
  if (s.etaSec) {
    setEl(id + '-eta', fmtHMS(s.etaSec));
    const fin = new Date(RACE_START.getTime() + s.etaSec * 1000);
    setEl(id + '-eta-sub', 'Est. clock: ' + fin.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    setEl(id + '-conf', s.conf + '%');
  }

  // On-track indicator
  updateOnTrackBanner(id);

  // ETA at spectator spots
  updateETASpots(id);

  // Checkpoints
  const cpsEl = document.getElementById(id + '-cps');
  if (cpsEl) {
    cpsEl.innerHTML = CHECKPOINTS.map(cp =>
      `<div class="cp-dot${pct >= (cp.mi / TOTAL_MI) * 100 ? ' hit' : ''}"
        style="left:${(cp.mi / TOTAL_MI) * 100}%"></div>
       <div class="cp-lbl" style="left:${(cp.mi / TOTAL_MI) * 100}%">${cp.label}</div>`
    ).join('');
  }

  // Splits
  if (s.splits.length) {
    const tb = document.getElementById(id + '-splits');
    if (tb) tb.innerHTML = s.splits.map(sp =>
      `<tr><td>${sp.label}</td><td>${sp.chipTime}</td><td>${sp.pace}/mi</td></tr>`
    ).join('');
  }

  // Family view
  const famId = id === 'gf' ? 'gf' : id === 'mom' ? 'mom' : null;
  if (famId) {
    setEl('fam-' + famId + '-st', statusInfo(s.status).label);
    setEl('fam-' + famId + '-d', s.distMi > 0 ? s.distMi.toFixed(2) + ' mi' : '—');
    setEl('fam-' + famId + '-e', fmtHMS(s.elapsedSec));
    setEl('fam-' + famId + '-p', fmtPace(s.elapsedSec, s.distMi) !== '—' ? fmtPace(s.elapsedSec, s.distMi) + '/mi' : '—');
    setEl('fam-' + famId + '-eta', s.etaSec ? fmtHMS(s.etaSec) : '—');
    updateLeadBanner();
  }

  // Update map marker
  if (mapInited && s.pct > 0) updateMarker(id, s.pct);

  // Update pace charts
  updateLiveOnChart(id);

  // Updated timestamp
  setEl('upd-' + id, 'Updated ' + new Date().toLocaleTimeString());
}

function statusInfo(status) {
  if (status === 'running')  return { cls: 'status-running',  label: 'Running ▲' };
  if (status === 'finished') return { cls: 'status-finished', label: 'Finished! 🎉' };
  return { cls: 'status-pre', label: 'Pre-race' };
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ─── On-track vs 90-min target ───────────────────────────
function updateOnTrackBanner(id) {
  const el = document.getElementById(id + '-on-track');
  if (!el) return;
  const s = STATE[id];
  if (!s || s.status !== 'running' || !s.etaSec) return;

  const TARGET = id === 'gf' ? 5400 : null; // 90 min for Catherine
  if (!TARGET) return;

  const diff = s.etaSec - TARGET; // positive = behind
  if (Math.abs(diff) < 30) {
    el.className = 'on-track-banner on-track-neutral';
    el.innerHTML = '🎯 Right on 90-min pace!';
  } else if (diff < 0) {
    el.className = 'on-track-banner on-track-ahead';
    el.innerHTML = `✅ Ahead of 90-min goal by ${fmtHMS(Math.abs(diff))}`;
  } else {
    el.className = 'on-track-banner on-track-behind';
    el.innerHTML = `⚠️ Behind 90-min goal by ${fmtHMS(diff)} — current projection: ${fmtHMS(s.etaSec)}`;
  }
  el.style.display = 'flex';
}

// ─── ETA at each spectator spot ──────────────────────────
function updateETASpots(id) {
  const el = document.getElementById(id + '-eta-spots');
  if (!el) return;
  const s = STATE[id];
  if (!s || s.distMi < 0.5 || !s.elapsedSec) { el.innerHTML = ''; return; }

  const avgPace = s.elapsedSec / s.distMi; // sec/mi
  const spectatorCPs = CHECKPOINTS.filter(cp => cp.spectator && cp.mi > s.distMi);

  el.innerHTML = spectatorCPs.map(cp => {
    const etaSec = estimateETAAtMile(s, cp.mi, avgPace);
    const clock  = new Date(RACE_START.getTime() + etaSec * 1000);
    return `<div class="eta-spot-item">
      <span class="eta-spot-mi">${cp.mi}mi</span>
      <span class="eta-spot-name">${cp.label}</span>
      <div style="text-align:right">
        <div class="eta-spot-time">${fmtHMS(etaSec)}</div>
        <div class="eta-spot-clock">${clock.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>`;
  }).join('');
}

function estimateETAAtMile(state, targetMi, avgPace) {
  let cum = state.elapsedSec;
  const startMile = Math.floor(state.distMi);
  for (let i = startMile; i < Math.ceil(targetMi) && i < MILE_PACE_FACTORS.length; i++) {
    const seg = Math.min(1, targetMi - i);
    cum += avgPace * MILE_PACE_FACTORS[i] * seg;
  }
  return Math.round(cum);
}

// ═══════════════════════════════════════════════════════════
// CHARTS — zoomable, toggleable lines
// ═══════════════════════════════════════════════════════════
// Chart.js zoom plugin from CDN
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    zoom: {
      zoom: {
        wheel: { enabled: true },
        pinch: { enabled: true },
        mode: 'x',
      },
      pan: { enabled: true, mode: 'x' },
    },
    tooltip: {
      mode: 'index', intersect: false,
      backgroundColor: 'rgba(255,255,255,0.95)',
      titleColor: '#000', bodyColor: '#3C3C43',
      borderColor: 'rgba(60,60,67,0.12)', borderWidth: 1,
      titleFont: { family: '-apple-system,BlinkMacSystemFont,SF Pro Display', weight: '600', size: 13 },
      bodyFont: { family: 'SF Mono,Fira Code,Menlo', size: 11 },
      padding: 10, cornerRadius: 8,
    },
  },
  scales: {
    x: {
      type: 'linear',
      ticks: {
        color: '#8E8E93', font: { family: 'SF Mono,Fira Code,Menlo', size: 10 },
        callback: v => v === 13.1 ? 'Finish' : Number.isInteger(v) ? v + 'mi' : '',
      },
      grid: { color: 'rgba(60,60,67,0.08)', drawBorder: false },
      border: { display: false },
    },
    y: {
      ticks: {
        color: '#8E8E93', font: { family: 'SF Mono,Fira Code,Menlo', size: 10 },
      },
      grid: { color: 'rgba(60,60,67,0.08)', drawBorder: false },
      border: { display: false },
    },
  },
};

function initCharts() {
  initPaceChart('gf',  GF_SCENARIOS,  true,  '#007AFF');
  initPaceChart('mom', MOM_SCENARIOS, false, '#5856D6');
  initDistChart();
  initElevChart();
}

function initPaceChart(id, scenarios, showTarget, liveColor) {
  const ctx = document.getElementById(id + '-pace-chart');
  if (!ctx) return;

  const datasets = scenarios.map(s => {
    const prof = s.flatPace ? buildPaceProfile(s.flatPace) : PROFILE_90;
    return {
      label: s.emoji + ' ' + s.label,
      data: prof.map(p => ({ x: p.mi, y: +(p.sec / 60).toFixed(2) })),
      borderColor: s.color, borderWidth: 2,
      borderDash: s.key === 'walk' ? [5, 3] : [],
      backgroundColor: 'transparent',
      tension: 0.35, pointRadius: 0, pointHoverRadius: 4,
    };
  });

  if (showTarget) {
    datasets.push({
      label: '🎯 90-min goal',
      data: PROFILE_90.map(p => ({ x: p.mi, y: +(p.sec / 60).toFixed(2) })),
      borderColor: '#FF3B30', borderWidth: 2.5, borderDash: [8, 5],
      backgroundColor: 'transparent', tension: 0.35, pointRadius: 0,
    });
  }

  const options = {
    ...CHART_DEFAULTS,
    parsing: false,
    scales: {
      ...CHART_DEFAULTS.scales,
      x: { ...CHART_DEFAULTS.scales.x, min: 0, max: 13.1 },
      y: {
        ...CHART_DEFAULTS.scales.y,
        ticks: {
          ...CHART_DEFAULTS.scales.y.ticks,
          callback: v => {
            const h = Math.floor(v / 60), m = Math.floor(v % 60);
            return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}m`;
          },
        },
        title: { display: true, text: 'Elapsed time', color: '#8E8E93', font: { size: 11 } },
      },
    },
    plugins: {
      ...CHART_DEFAULTS.plugins,
      tooltip: {
        ...CHART_DEFAULTS.plugins.tooltip,
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y;
            const h = Math.floor(v / 60), m = Math.floor(v % 60), s = Math.floor((v % 1) * 60);
            return `${ctx.dataset.label}: ${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          },
        },
      },
    },
  };

  charts[id + '-pace'] = new Chart(ctx, { type: 'line', data: { datasets }, options });

  // Build interactive legend
  buildChartLegend(id + '-pace-legend', id + '-pace', datasets);
  buildBadges(id + '-sc-badges', scenarios, showTarget);
}

function buildChartLegend(legendId, chartKey, datasets) {
  const el = document.getElementById(legendId);
  if (!el) return;
  el.innerHTML = datasets.map((ds, i) => {
    const dash = ds.borderDash?.length ? `border-top:2px dashed ${ds.borderColor};background:transparent;height:0;margin-top:8px;` : `background:${ds.borderColor}`;
    return `<div class="legend-item" data-chart="${chartKey}" data-index="${i}">
      <span class="legend-swatch" style="${dash}"></span>
      <span>${ds.label}</span>
    </div>`;
  }).join('');

  el.querySelectorAll('.legend-item').forEach(item => {
    item.addEventListener('click', () => {
      const chart = charts[item.dataset.chart];
      const idx   = +item.dataset.index;
      const meta  = chart.getDatasetMeta(idx);
      meta.hidden = !meta.hidden;
      chart.update();
      item.classList.toggle('hidden', meta.hidden);
    });
  });
}

function buildBadges(elId, scenarios, showTarget) {
  const el = document.getElementById(elId);
  if (!el) return;
  const badges = scenarios.map(s => {
    const sec = scenarioFinishSec(s);
    const pct = getPercentile(sec);
    return `<span class="sc-badge" style="background:${s.color}18;color:${s.color}">
      ${s.emoji} ${s.label}: <strong>${fmtHMS(sec)}</strong> · Top ${pct}%
    </span>`;
  });
  if (showTarget) {
    const sec90 = Math.round(PROFILE_90.at(-1).sec);
    badges.push(`<span class="sc-badge" style="background:#FF3B3018;color:#FF3B30;border:1px dashed #FF3B3040">
      🎯 Sub-90 goal: <strong>${fmtHMS(sec90)}</strong> · Top ${getPercentile(sec90)}%
    </span>`);
  }
  el.innerHTML = badges.join('');
}

function updateLiveOnChart(id) {
  const chartKey = id + '-pace';
  const chart = charts[chartKey];
  if (!chart) return;
  const s = STATE[id];
  if (!s || s.distMi < 0.5) return;

  const pace = s.elapsedSec / s.distMi;
  const prof = buildPaceProfile(pace);
  const livePts = prof.filter(p => p.mi <= s.distMi + 0.05);

  const r = REG.find(r => r.id === id);
  const liveDS = {
    label: '📍 Live pace',
    data: livePts.map(p => ({ x: p.mi, y: +(p.sec / 60).toFixed(2) })),
    borderColor: r?.color || '#007AFF',
    borderWidth: 3, borderDash: [4, 3],
    backgroundColor: 'transparent', tension: 0.2,
    pointRadius: livePts.map((_, i) => i === livePts.length - 1 ? 6 : 0),
    pointBackgroundColor: '#fff',
    pointBorderColor: r?.color || '#007AFF',
    pointBorderWidth: 2,
  };

  const liveIdx = chart.data.datasets.findIndex(d => d.label === '📍 Live pace');
  if (liveIdx === -1) chart.data.datasets.push(liveDS);
  else chart.data.datasets[liveIdx] = liveDS;
  chart.update('none');
}

function initDistChart() {
  const ctx = document.getElementById('dist-chart');
  if (!ctx) return;
  const labels = ['1:20','1:30','1:45','2:00','2:10','2:20','2:30','2:45','3:00','3:15+'];
  const data   = [200,600,2200,4800,5900,5200,4100,2800,1800,1100];
  charts['dist'] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{
      label: 'Runners',
      data,
      backgroundColor: data.map((_, i) => i >= 3 && i <= 5 ? 'rgba(0,122,255,0.65)' : 'rgba(0,122,255,0.18)'),
      borderRadius: 4, borderSkipped: false,
    }]},
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        ...CHART_DEFAULTS.plugins,
        tooltip: { ...CHART_DEFAULTS.plugins.tooltip, callbacks: { label: c => `~${c.raw.toLocaleString()} runners` } },
      },
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, type: 'category', ticks: { ...CHART_DEFAULTS.scales.x.ticks } },
        y: { ...CHART_DEFAULTS.scales.y },
      },
    },
  });
}

function initElevChart() {
  const ctx = document.getElementById('elev-chart');
  if (!ctx) return;
  charts['elev'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ELEVATION.map(e => e.mi % 1 === 0 ? e.mi + 'mi' : ''),
      datasets: [{
        label: 'Elevation (ft)',
        data: ELEVATION.map(e => e.ft),
        borderColor: 'rgba(0,122,255,0.7)', borderWidth: 2,
        fill: true, backgroundColor: 'rgba(0,122,255,0.07)',
        tension: 0.4, pointRadius: 0,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ...CHART_DEFAULTS.scales.x, type: 'category', ticks: { ...CHART_DEFAULTS.scales.x.ticks, maxTicksLimit: 14 } },
        y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 220, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: v => v + 'ft' } },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════
// MAP — Leaflet with real course + heatmap
// ═══════════════════════════════════════════════════════════
function initMap() {
  mapInited = true;
  leafMap = L.map('map', { center: [40.638, -73.974], zoom: 13, zoomControl: true });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, attribution: '© CARTO © OpenStreetMap',
  }).addTo(leafMap);

  // Course polyline
  L.polyline(COURSE_LATLNGS, { color: '#007AFF', weight: 4.5, opacity: 0.85 }).addTo(leafMap);

  // Checkpoint markers
  CHECKPOINTS.forEach(cp => {
    const isEnd = cp.label.includes('Finish') || cp.label.includes('Start');
    const col = isEnd ? '#FF9500' : (cp.spectator ? '#007AFF' : '#34C759');
    const rad = isEnd ? 9 : (cp.spectator ? 7 : 5);
    L.circleMarker([cp.lat, cp.lng], {
      radius: rad, color: col, fillColor: col, fillOpacity: 0.25, weight: 2.5,
    }).addTo(leafMap).bindPopup(`<b>${cp.label}</b><br>${cp.mi} miles`);
  });

  // Runner markers
  REG.forEach(r => {
    const el = document.createElement('div');
    el.style.cssText = `width:28px;height:28px;border-radius:50%;background:#fff;
      border:2.5px solid ${r.color};display:flex;align-items:center;justify-content:center;
      font-size:10px;font-weight:700;color:${r.color};
      box-shadow:0 2px 8px rgba(0,0,0,0.18);font-family:-apple-system,BlinkMacSystemFont`;
    el.textContent = r.name.split(' ').map(w => w[0]).join('').slice(0, 2);
    const icon = L.divIcon({ className: '', html: el.outerHTML, iconSize: [28, 28], iconAnchor: [14, 14] });
    markerMap[r.id] = L.marker(COURSE_LATLNGS[0], { icon })
      .addTo(leafMap)
      .bindPopup(`${r.emoji} ${r.name} — waiting for race data`);
  });

  setTimeout(() => leafMap.invalidateSize(), 150);
  initElevChart(); // elev chart is in map pane
}

function updateMarker(id, pct) {
  const marker = markerMap[id];
  if (!marker) return;
  const idx = Math.min(Math.floor(pct / 100 * (COURSE_LATLNGS.length - 1)), COURSE_LATLNGS.length - 1);
  marker.setLatLng(COURSE_LATLNGS[idx]);

  // Update popup with pace info
  const s = STATE[id]; const r = REG.find(r => r.id === id);
  if (s && r) {
    marker.getPopup()?.setContent(
      `<b>${r.emoji} ${r.name}</b><br>${s.distMi.toFixed(2)} mi · ${fmtHMS(s.elapsedSec)}<br>Pace: ${fmtPace(s.elapsedSec, s.distMi)}/mi`
    );
  }

  // Heatmap from pace history
  drawPaceHeatmap();
}

function drawPaceHeatmap() {
  // Color the course segments by pace (compared to target pace)
  // Requires ≥2 data points — updates polyline color per segment
  if (heatLayer) { leafMap.removeLayer(heatLayer); heatLayer = null; }

  const gf = STATE.gf;
  if (!gf || gf.paceHistory.length < 2) return;

  const targetPace = (5400 / TOTAL_MI); // 90-min target pace in sec/mi
  const segs = [];

  for (let i = 1; i < gf.paceHistory.length; i++) {
    const a = gf.paceHistory[i - 1], b = gf.paceHistory[i];
    const segPace = (b.sec - a.sec) / Math.max(0.01, b.mi - a.mi); // rough segment pace
    // not tracked per seg, use overall for now
    const ratio = gf.elapsedSec / gf.distMi / targetPace;
    const col = ratio < 0.95 ? '#34C759' : ratio < 1.05 ? '#007AFF' : ratio < 1.15 ? '#FF9500' : '#FF3B30';

    const startIdx = Math.floor(a.mi / TOTAL_MI * (COURSE_LATLNGS.length - 1));
    const endIdx   = Math.floor(b.mi / TOTAL_MI * (COURSE_LATLNGS.length - 1));
    segs.push(L.polyline(COURSE_LATLNGS.slice(startIdx, endIdx + 1), { color: col, weight: 5 }));
  }

  if (segs.length) heatLayer = L.layerGroup(segs).addTo(leafMap);
}

// ═══════════════════════════════════════════════════════════
// WEATHER
// ═══════════════════════════════════════════════════════════
async function loadWeather() {
  if (wxLoaded) return;
  setEl('wx-desc', 'Loading forecast…');
  try {
    wxData = await fetchWeather();
    const idxs = getRaceDayHours(wxData, '2026-05-16');
    const i = idxs.length ? (idxs.find(j => wxData.hourly.time[j].includes('T07')) || idxs[0]) : getCurrentHourIndex(wxData);
    const wx = extractHourData(wxData, i);
    renderWeather(wx, !!idxs.length, idxs.length ? idxs.slice(0, 12) : Array.from({ length: 12 }, (_, j) => i + j));
    wxLoaded = true;
  } catch {
    setEl('wx-desc', '⚠️ Weather unavailable — try again closer to race day.');
  }
}

function renderWeather(wx, isRaceDay, hourIdxs) {
  setEl('wx-icon', getWeatherIcon(wx));
  setEl('wx-temp', wx.temp + '°F');
  setEl('wx-feels', 'Feels like ' + wx.feels + '°F');
  setEl('wx-desc', (isRaceDay ? 'Race day forecast: ' : 'Current: ') + wx.temp + '°F, ' + (wx.cloud < 30 ? 'clear' : 'partly cloudy'));
  setEl('wx-loc', isRaceDay ? 'Brooklyn, NY · May 16 · 7AM race start forecast' : 'Brooklyn, NY · Current (May 16 forecast available closer to race)');
  setEl('wx-wind', wx.wind + ' mph'); setEl('wx-wdir', wx.windDir + ' wind');
  setEl('wx-hum', wx.humid + '%');
  setEl('wx-dew', wx.dew + '°F'); setEl('wx-rain', wx.rain + '%');
  setEl('wx-cloud', wx.cloud + '% cloud cover');

  const impact = analyzeRaceImpact(wx);
  const impEl = document.getElementById('wx-impact');
  if (impEl) { impEl.textContent = impact.summary + ' ' + impact.parts.join(' · '); impEl.className = 'wx-impact ' + impact.cls; }

  // Weather impact on 90-min goal
  if (impact.totalPctImpact !== 0) {
    const adjSec = Math.round(PROFILE_90.at(-1).sec * (1 + Math.abs(impact.totalPctImpact) / 100));
    const sign = impact.totalPctImpact < 0 ? '+' : '-';
    const diff = Math.abs(adjSec - PROFILE_90.at(-1).sec);
    setEl('wx-goal-adj', `Weather-adjusted sub-90 projection: ${fmtHMS(adjSec)} (${sign}${fmtHMS(diff)} vs ideal conditions)`);
  }

  // Hourly chart
  if (wxData && hourIdxs) {
    const ctx = document.getElementById('wx-hourly');
    if (ctx) {
      if (charts['wx']) { charts['wx'].destroy(); delete charts['wx']; }
      const labs  = hourIdxs.map(i => { const h = parseInt(wxData.hourly.time[i].slice(11,13)); return h < 12 ? `${h||12}${h<12?'am':'pm'}` : `${h===12?12:h-12}pm`; });
      const temps = hourIdxs.map(i => Math.round(wxData.hourly.temperature_2m[i]));
      const winds = hourIdxs.map(i => Math.round(wxData.hourly.windspeed_10m[i]));
      charts['wx'] = new Chart(ctx, {
        type: 'line',
        data: { labels: labs, datasets: [
          { label: 'Temp °F', data: temps, borderColor: '#007AFF', borderWidth: 2.5, fill: true, backgroundColor: 'rgba(0,122,255,0.07)', tension: 0.4, yAxisID: 'y', pointRadius: 3, pointBackgroundColor: '#007AFF' },
          { label: 'Wind mph', data: winds, borderColor: '#FF9500', borderWidth: 2, borderDash: [4,3], backgroundColor: 'transparent', tension: 0.4, yAxisID: 'y2', pointRadius: 2 },
        ]},
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#8E8E93', font: { size: 10 }, usePointStyle: true } }, tooltip: CHART_DEFAULTS.plugins.tooltip },
          scales: {
            x: { ticks: { color: '#8E8E93', font: { family: 'SF Mono,Fira Code,Menlo', size: 10 } }, grid: { color: 'rgba(60,60,67,0.06)' }, border: { display: false } },
            y:  { position: 'left',  ticks: { color: '#8E8E93', font: { size: 10 }, callback: v => v + '°F' }, grid: { color: 'rgba(60,60,67,0.06)' }, border: { display: false } },
            y2: { position: 'right', ticks: { color: '#FF9500', font: { size: 10 }, callback: v => v + 'mph' }, grid: { display: false }, border: { display: false } },
          },
        },
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════
// STATS / PERCENTILE
// ═══════════════════════════════════════════════════════════
function renderPctScenarios() {
  const pairs = [
    { id: 'gf',  scenarios: GF_SCENARIOS,  showTarget: true  },
    { id: 'mom', scenarios: MOM_SCENARIOS, showTarget: false },
  ];
  pairs.forEach(({ id, scenarios, showTarget }) => {
    const el = document.getElementById(id + '-pct-rows');
    if (!el) return;
    const rows = scenarios.map(s => {
      const sec = scenarioFinishSec(s);
      const pct = getPercentile(sec);
      const r = REG.find(r => r.id === id);
      return `<div class="pct-row">
        <span style="color:${s.color}">${s.emoji} ${s.label}</span>
        <span><strong style="font-family:var(--font-mono)">${fmtHMS(sec)}</strong> · Top ${pct}%</span>
      </div>`;
    });
    if (showTarget) {
      const sec90 = Math.round(PROFILE_90.at(-1).sec);
      rows.push(`<div class="pct-row">
        <span style="color:#FF3B30">🎯 Sub-90 goal</span>
        <span><strong style="font-family:var(--font-mono)">${fmtHMS(sec90)}</strong> · Top ${getPercentile(sec90)}%</span>
      </div>`);
    }
    el.innerHTML = rows.join('');

    // Main pct display
    const best = scenarioFinishSec(scenarios[0]);
    const bestEl = document.getElementById(id + '-pct-big');
    if (bestEl) {
      bestEl.textContent = 'Top ' + getPercentile(best) + '%';
      bestEl.style.color = scenarios[0].color;
    }
  });
}

// ═══════════════════════════════════════════════════════════
// SIMULATOR
// ═══════════════════════════════════════════════════════════
function initSim() {
  const slider = document.getElementById('sim-slider');
  if (!slider) return;

  slider.addEventListener('input', e => {
    simPct = +e.target.value;
    applySimulation(simPct);
    updateSimDisplay();
  });

  // Play/pause
  document.getElementById('sim-play')?.addEventListener('click', toggleSimPlay);
  document.getElementById('sim-reset')?.addEventListener('click', () => {
    simPct = 0; slider.value = 0;
    applySimulation(0); updateSimDisplay();
  });
}

let simInterval = null;
let simPlaying  = false;

function toggleSimPlay() {
  const btn = document.getElementById('sim-play');
  if (simPlaying) {
    clearInterval(simInterval); simPlaying = false;
    if (btn) btn.textContent = '▶ Play';
  } else {
    simPlaying = true;
    if (btn) btn.textContent = '⏸ Pause';
    simInterval = setInterval(() => {
      simPct = Math.min(100, simPct + 0.3); // ~0.3% per tick
      const slider = document.getElementById('sim-slider');
      if (slider) slider.value = simPct;
      applySimulation(simPct);
      updateSimDisplay();
      if (simPct >= 100) { clearInterval(simInterval); simPlaying = false; if (btn) btn.textContent = '▶ Play'; }
    }, 100);
  }
}

// Target pace = 6:52/mi (sub-90 on this course)
const SIM_TARGET_PACE = PROFILE_90.at(-1).sec / TOTAL_MI;
const SIM_SCENARIOS   = {
  best:   { pace: 6 * 60 + 25, label: 'Best Day',     color: '#34C759' },
  on90:   { pace: null,         label: 'On 90-min',    color: '#007AFF' },
  tough:  { pace: 7 * 60 + 15, label: 'Tough Day',    color: '#FF9500' },
  actual: { pace: null,         label: 'Your Pace',    color: '#FF3B30' },
};

function applySimulation(pct) {
  // Race is locked forward only — can't go backward once past current live position
  const gfLive = STATE.gf?.pct || 0;
  const actualPct = Math.max(pct, gfLive); // can't simulate behind reality
  const distMi = (actualPct / 100) * TOTAL_MI;

  // Simulate state for display
  const simState = {
    distMi,
    elapsedSec: Math.round(SIM_TARGET_PACE * distMi),
    pct: actualPct,
  };

  // Update sim map marker if map open
  if (mapInited) {
    const simMarker = markerMap['sim'];
    if (simMarker) {
      const idx = Math.min(Math.floor(actualPct / 100 * (COURSE_LATLNGS.length - 1)), COURSE_LATLNGS.length - 1);
      simMarker.setLatLng(COURSE_LATLNGS[idx]);
    }
  }
}

function updateSimDisplay() {
  const slider = document.getElementById('sim-slider');
  if (!slider) return;
  const pct    = +slider.value;
  const distMi = (pct / 100) * TOTAL_MI;

  setEl('sim-pct',  pct.toFixed(1) + '%');
  setEl('sim-dist', distMi.toFixed(2) + ' mi');

  // Show all 4 scenario ETAs at this point
  const rows = Object.entries(SIM_SCENARIOS).map(([key, sc]) => {
    const pace = sc.pace || SIM_TARGET_PACE;
    const elapsed = Math.round(pace * distMi);
    const remSec  = Math.round((TOTAL_MI - distMi) * pace);
    const finSec  = elapsed + remSec;
    return `<div class="pct-row">
      <span style="color:${sc.color}">${sc.label}</span>
      <span style="font-family:var(--font-mono)">Elapsed: ${fmtHMS(elapsed)} · ETA finish: ${fmtHMS(finSec)}</span>
    </div>`;
  }).join('');

  const el = document.getElementById('sim-scenarios');
  if (el) el.innerHTML = rows;

  // On/off track for sub-90
  const onPace90 = PROFILE_90.find(p => p.mi >= distMi)?.sec || PROFILE_90.at(-1).sec;
  const actualElapsed = Math.round(SIM_TARGET_PACE * distMi);
  const diff = actualElapsed - onPace90;
  const trackEl = document.getElementById('sim-on-track');
  if (trackEl) {
    if (pct < 1) { trackEl.textContent = 'Start the simulation to see pace analysis'; trackEl.className = 'on-track-banner on-track-neutral'; }
    else if (Math.abs(diff) < 30) { trackEl.textContent = '🎯 Exactly on 90-min pace!'; trackEl.className = 'on-track-banner on-track-neutral'; }
    else if (diff < 0) { trackEl.textContent = `✅ ${fmtHMS(Math.abs(diff))} ahead of 90-min goal`; trackEl.className = 'on-track-banner on-track-ahead'; }
    else { trackEl.textContent = `⚠️ ${fmtHMS(diff)} behind 90-min goal`; trackEl.className = 'on-track-banner on-track-behind'; }
  }
}

// ═══════════════════════════════════════════════════════════
// CHEER FEATURE
// ═══════════════════════════════════════════════════════════
async function sendCheer(id) {
  const r = REG.find(r => r.id === id);
  if (!r) return;
  const btn = document.getElementById('cheer-btn-' + id);
  if (btn) { btn.textContent = '🎉 Cheer sent!'; btn.className = 'cheer-btn cheer-sent'; }
  // RTRT cheer endpoint (opens official cheer page)
  window.open(`https://rtrt.me/bkh2026/track/${r.trackId}#cheer`, '_blank');
  notify(`Cheer sent to ${r.name}! 🎉`);
  setTimeout(() => {
    if (btn) { btn.innerHTML = `<span>📣</span> Send Cheer to ${r.name.split(' ')[0]}`; btn.className = 'cheer-btn'; }
  }, 5000);
}

// ═══════════════════════════════════════════════════════════
// LEAD BANNER
// ═══════════════════════════════════════════════════════════
function updateLeadBanner() {
  const gf = STATE.gf, mom = STATE.mom;
  if (!gf || !mom || (gf.status === 'pre' && mom.status === 'pre')) return;
  const el = document.getElementById('lead-banner');
  if (!el) return;
  if (gf.distMi > 0 || mom.distMi > 0) {
    const d = gf.distMi - mom.distMi;
    const rg = REG.find(r => r.id === 'gf'), rm = REG.find(r => r.id === 'mom');
    const who = d > 0 ? rg : rm;
    const col = who?.color || '#007AFF';
    el.querySelector('.lead-title').textContent = `${who?.emoji} ${who?.name?.split(' ')[0]} leads by ${Math.abs(d).toFixed(2)} miles`;
    el.querySelector('.lead-title').style.color = col;
  }
}

// ═══════════════════════════════════════════════════════════
// SETTINGS MODAL
// ═══════════════════════════════════════════════════════════
function openSettings() {
  renderRLI();
  document.getElementById('settings-modal').classList.add('open');
}
function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
}
function renderRLI() {
  const el = document.getElementById('rli-list');
  if (!el) return;
  el.innerHTML = REG.map(r => `
    <div class="runner-list-item">
      <span>${r.emoji || '🏃'}</span>
      <span class="rli-name">${r.name}</span>
      <span class="rli-id">${r.trackId}</span>
      ${r.fixed
        ? '<span style="font-size:11px;color:var(--text-quaternary)">core</span>'
        : `<button class="rli-del" onclick="removeRunner('${r.id}')">✕</button>`}
    </div>`).join('');
}
window.addRunner = function() {
  const name  = document.getElementById('new-name')?.value?.trim();
  const tid   = document.getElementById('new-tid')?.value?.trim()?.toUpperCase();
  const emoji = document.getElementById('new-emoji')?.value?.trim() || '🏃';
  const color = document.getElementById('new-color')?.value || '#007AFF';
  if (!name || !tid) { notify('Name and tracker ID required'); return; }
  const id = 'r_' + Date.now();
  REG.push({ id, name, trackId: tid, emoji, color, fixed: false });
  saveRegistry(REG);
  STATE[id] = makeRunnerState(REG.at(-1));
  buildTabs();
  buildPanes();
  renderRLI();
  ['new-name','new-tid','new-emoji'].forEach(fid => { const f = document.getElementById(fid); if (f) f.value = ''; });
  notify(`${name} added!`);
};
window.removeRunner = function(id) {
  REG = REG.filter(r => r.id !== id);
  saveRegistry(REG);
  delete STATE[id];
  document.getElementById('tab-' + id)?.remove();
  document.getElementById('pane-' + id)?.remove();
  tabOrder = tabOrder.filter(t => t !== id);
  saveTabOrder();
  renderRLI();
  showTab('gf');
};
window.closeSettings = closeSettings;

// ═══════════════════════════════════════════════════════════
// REFRESH + FETCH
// ═══════════════════════════════════════════════════════════
async function doRefresh(silent = true) {
  const ring = document.getElementById('spinRing');
  if (ring) ring.classList.add('on');
  await Promise.all(REG.map(async r => {
    const changed = await fetchRunnerData(STATE[r.id]);
    if (changed) renderRunner(r.id);
  }));
  lastRefresh = Date.now();
  if (ring) ring.classList.remove('on');
  updateRefreshLabel();
}

function updateRefreshLabel() {
  if (!lastRefresh) return;
  const sec = Math.round((Date.now() - lastRefresh) / 1000);
  setEl('lastUpd', sec < 5 ? 'Just updated' : `Updated ${sec}s ago`);
}

function startAutoRefresh() {
  setInterval(() => doRefresh(true), 60000);
}

window.manualRefresh = async function() {
  const btn = document.getElementById('refreshBtn');
  if (btn) btn.textContent = '↻ Loading…';
  await doRefresh(false);
  if (btn) btn.textContent = '↻ Refresh';
  notify('Refreshed ⚡');
};

// ═══════════════════════════════════════════════════════════
// COUNTDOWN
// ═══════════════════════════════════════════════════════════
function updateClock() {
  const diff = RACE_START - new Date();
  if (diff <= 0) {
    ['d','h','m','s'].forEach(k => setEl('cd-' + k, '🏃'));
    return;
  }
  setEl('cd-d', String(Math.floor(diff / 86400000)).padStart(2, '0'));
  setEl('cd-h', String(Math.floor(diff % 86400000 / 3600000)).padStart(2, '0'));
  setEl('cd-m', String(Math.floor(diff % 3600000 / 60000)).padStart(2, '0'));
  setEl('cd-s', String(Math.floor(diff % 60000 / 1000)).padStart(2, '0'));
}

// ═══════════════════════════════════════════════════════════
// PERCENTILE LOOKUP
// ═══════════════════════════════════════════════════════════
window.lookupPct = function() {
  const t = document.getElementById('lookup-time')?.value;
  if (!t) return;
  const p = t.split(':').map(Number);
  const sec = p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p[0]*3600+p[1]*60;
  setEl('pct-result', `Top ${getPercentile(sec)}% 🏅`);
};

// ═══════════════════════════════════════════════════════════
// NOTIFICATION TOAST
// ═══════════════════════════════════════════════════════════
let notifTimeout;
function notify(msg) {
  const el = document.getElementById('notif');
  const txt = document.getElementById('notif-text');
  if (!el || !txt) return;
  txt.textContent = msg;
  el.classList.add('show');
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => el.classList.remove('show'), 3000);
}

// Expose functions for HTML onclick
window.showTab = showTab;
window.openSettings = openSettings;
window.sendCheer = sendCheer;
