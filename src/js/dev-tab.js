// ============================================================
// dev-tab.js — Developer Database Tab
// Only mounted when dev mode is active
// Features: CSV upload/download, manual race entry, runner management
// GitHub Gist as database backend
// ============================================================
import {
  CSV_HEADERS, parseCSV, racesToCSV, loadRaces, saveRaces,
  SAMPLE_RACES, computePRs, computeCareerTotals, timeToSec, fmtPaceFromSec
} from '../data/race-history.js';
import { loadGoals, saveGoals, DEFAULT_GOALS, fmtHMS, fmtPace } from '../data/runners.js';

const GIST_TOKEN_KEY = 'blizzard_gist_token';
const GIST_ID_KEY    = 'blizzard_gist_id';

// ── Mount / Unmount ──────────────────────────────────────
export function mountDevTab(REG, GOALS) {
  // Add tab
  if (document.getElementById('tab-dev')) return;
  const bar = document.getElementById('tab-bar');
  const addBtn = bar.querySelector('.tab-add-btn');
  const tab = document.createElement('div');
  tab.className = 'tab'; tab.id = 'tab-dev';
  tab.setAttribute('data-tab-id','dev');
  tab.innerHTML = '🛠 Database';
  tab.style.cssText = 'color:var(--orange);font-weight:600';
  tab.addEventListener('click', () => showDevTab());
  bar.insertBefore(tab, addBtn);

  // Add pane
  if (!document.getElementById('pane-dev')) {
    const pane = document.createElement('div');
    pane.className = 'pane'; pane.id = 'pane-dev';
    pane.innerHTML = buildDevPaneHTML(REG);
    document.querySelector('main').appendChild(pane);
    initDevPaneEvents(REG, GOALS);
  }
}

export function unmountDevTab() {
  document.getElementById('tab-dev')?.remove();
  document.getElementById('pane-dev')?.remove();
}

function showDevTab() {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-dev')?.classList.add('active');
  document.getElementById('pane-dev')?.classList.add('active');
  refreshDevTables();
}

// ── HTML ──────────────────────────────────────────────────
function buildDevPaneHTML(REG) {
  return `
<div style="max-width:1200px;margin:0 auto">
  <!-- Header -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">
    <div>
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.4px;color:var(--text-primary)">🛠 Developer Database</div>
      <div style="font-size:12px;color:var(--text-tertiary);margin-top:2px">Manage race history, runner profiles · data saves locally + to GitHub Gist</div>
    </div>
    <div style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-sm btn-ghost" onclick="devDownloadSampleCSV()">⬇ Sample CSV</button>
      <button class="btn btn-sm" id="dev-gist-btn" onclick="devOpenGistSetup()" style="background:var(--orange)">☁ GitHub Sync</button>
    </div>
  </div>

  <!-- Tabs within dev pane -->
  <div class="dev-sub-tabs" id="dev-sub-tabs">
    <button class="dev-sub-tab active" data-panel="races">📊 Race History</button>
    <button class="dev-sub-tab" data-panel="runners">🏃 Runner Profiles</button>
    <button class="dev-sub-tab" data-panel="upload">📤 CSV Import</button>
    <button class="dev-sub-tab" data-panel="gist">☁ GitHub Sync</button>
  </div>

  <!-- PANEL: Race History -->
  <div class="dev-panel active" id="dev-panel-races">
    <!-- Runner selector -->
    <div style="display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
      <select id="dev-runner-sel" class="form-input" style="width:200px" onchange="refreshDevTables()">
        ${REG.map(r => `<option value="${r.id}">${r.emoji} ${r.name}</option>`).join('')}
      </select>
      <button class="btn btn-sm" onclick="devOpenAddRace()">+ Add Race</button>
      <button class="btn btn-sm btn-ghost" onclick="devResetRaces()">↺ Reset to sample</button>
      <span id="dev-race-count" style="font-size:12px;color:var(--text-tertiary)"></span>
    </div>

    <!-- Stats summary -->
    <div id="dev-stats-summary" style="margin-bottom:14px"></div>

    <!-- Race table -->
    <div class="card" style="overflow:auto">
      <table id="dev-race-table" style="width:100%;border-collapse:collapse;font-size:13px;min-width:700px">
        <thead>
          <tr style="border-bottom:1px solid var(--separator);background:var(--blue-xxlight)">
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Date</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Race</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Type</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Dist</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Time</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Pace/mi</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Location</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Actions</th>
          </tr>
        </thead>
        <tbody id="dev-race-tbody"></tbody>
      </table>
    </div>
  </div>

  <!-- PANEL: Runner Profiles -->
  <div class="dev-panel" id="dev-panel-runners">
    <div style="margin-bottom:14px;display:flex;gap:8px;align-items:center">
      <div style="font-size:14px;font-weight:600;color:var(--text-primary)">All Runners</div>
      <button class="btn btn-sm" onclick="devOpenAddRunner()">+ Add Runner</button>
    </div>
    <div id="dev-runner-cards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px"></div>
  </div>

  <!-- PANEL: CSV Import -->
  <div class="dev-panel" id="dev-panel-upload">
    <div class="card" style="padding:24px;margin-bottom:14px">
      <div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px">📤 Import Race Data via CSV</div>
      <div style="font-size:13px;color:var(--text-tertiary);margin-bottom:16px;line-height:1.6">
        Upload a CSV with race history. Expected columns: <code style="background:var(--fill-blue);padding:1px 5px;border-radius:4px;font-size:11px">runner_id, date, name, dist, time, location, type</code><br>
        Also supports <strong>Strava export format</strong> — we'll auto-detect and map the columns.
      </div>
      <div id="dev-drop-zone" style="border:2px dashed var(--border-strong);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:16px" onclick="document.getElementById('dev-csv-file').click()">
        <div style="font-size:28px;margin-bottom:8px">📄</div>
        <div style="font-size:14px;font-weight:500;color:var(--text-secondary)">Drop CSV here or click to browse</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Supports standard & Strava export format</div>
        <input type="file" id="dev-csv-file" accept=".csv,.txt" style="display:none" onchange="devHandleCSVUpload(this)">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-ghost" onclick="devDownloadSampleCSV()">⬇ Download sample CSV</button>
        <button class="btn btn-sm btn-ghost" onclick="devDownloadCurrentCSV()">⬇ Export current data</button>
      </div>
    </div>

    <!-- Preview table after upload -->
    <div id="dev-csv-preview" style="display:none">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-size:14px;font-weight:600;color:var(--text-primary)">Preview — <span id="dev-preview-count"></span> rows</div>
        <div style="margin-left:auto;display:flex;gap:8px">
          <select id="dev-preview-runner" class="form-input" style="width:200px">
            ${REG.map(r => `<option value="${r.id}">${r.emoji} ${r.name}</option>`).join('')}
          </select>
          <button class="btn btn-sm" onclick="devImportPreview('replace')">Import (replace)</button>
          <button class="btn btn-sm btn-ghost" onclick="devImportPreview('merge')">Import (merge)</button>
        </div>
      </div>
      <div class="card" style="overflow:auto">
        <table id="dev-preview-table" style="width:100%;border-collapse:collapse;font-size:12px;min-width:600px">
          <thead id="dev-preview-thead"></thead>
          <tbody id="dev-preview-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- PANEL: GitHub Sync -->
  <div class="dev-panel" id="dev-panel-gist">
    <div class="card" style="padding:24px;margin-bottom:14px">
      <div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px">☁ GitHub Gist Database</div>
      <div style="font-size:13px;color:var(--text-tertiary);margin-bottom:16px;line-height:1.6">
        Save your race data to a private GitHub Gist so it persists across devices and reloads. 
        Only you can write (with your token); the app reads it publicly.
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">GitHub Personal Access Token (gist scope)</label>
        <div style="display:flex;gap:8px">
          <input type="password" class="form-input" id="dev-gh-token" placeholder="ghp_xxxxxxxxxxxx" style="flex:1;font-family:var(--font-mono);font-size:13px">
          <button class="btn btn-sm btn-ghost" onclick="document.getElementById('dev-gh-token').type=document.getElementById('dev-gh-token').type==='password'?'text':'password'">👁</button>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Token stored in localStorage (dev-only). Generate at github.com/settings/tokens with <code>gist</code> scope.</div>
      </div>
      <div class="form-group" style="margin-bottom:12px">
        <label class="form-label">Gist ID (leave blank to create new)</label>
        <input type="text" class="form-input" id="dev-gist-id" placeholder="e.g. abc123def456..." style="font-family:var(--font-mono);font-size:13px">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" onclick="devSaveToGist()">☁ Save to Gist</button>
        <button class="btn btn-ghost" onclick="devLoadFromGist()">⬇ Load from Gist</button>
        <button class="btn btn-ghost" onclick="devSaveGistConfig()">💾 Save config</button>
      </div>
      <div id="dev-gist-status" style="margin-top:12px;font-size:12px;color:var(--text-tertiary)"></div>
    </div>
    <div class="card" style="padding:20px">
      <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px">📋 Data snapshot (read-only preview)</div>
      <pre id="dev-gist-preview" style="font-size:11px;font-family:var(--font-mono);color:var(--text-secondary);overflow:auto;max-height:300px;background:var(--fill-subtle);padding:10px;border-radius:8px;border:1px solid var(--border)">(save or load data to see preview)</pre>
    </div>
  </div>

  <!-- Add/Edit Race Modal -->
  <div class="modal-overlay" id="dev-race-modal" onclick="if(event.target===this)closeDevRaceModal()">
    <div class="modal-sheet" style="position:relative;max-width:500px">
      <div class="modal-handle"></div>
      <button class="modal-close-btn" onclick="closeDevRaceModal()">✕</button>
      <div class="modal-title" id="dev-race-modal-title">Add Race</div>
      <input type="hidden" id="dev-race-edit-id">
      <input type="hidden" id="dev-race-edit-runner">
      <div class="rs-grid">
        <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" id="dev-race-date"></div>
        <div class="form-group"><label class="form-label">Type</label>
          <select class="form-input" id="dev-race-type">
            <option value="marathon">Marathon (26.2)</option>
            <option value="half">Half Marathon (13.1)</option>
            <option value="10k">10K (6.2)</option>
            <option value="5k">5K (3.1)</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Race Name</label><input type="text" class="form-input" id="dev-race-name" placeholder="e.g. Boston Marathon"></div>
      <div class="rs-grid">
        <div class="form-group"><label class="form-label">Finish Time (H:MM:SS)</label><input type="text" class="form-input" id="dev-race-time" placeholder="3:22:18"></div>
        <div class="form-group"><label class="form-label">Distance (miles)</label><input type="text" class="form-input" id="dev-race-dist" placeholder="26.2"></div>
      </div>
      <div class="form-group"><label class="form-label">Location</label><input type="text" class="form-input" id="dev-race-loc" placeholder="Boston, MA"></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn" style="flex:1" onclick="devSaveRace()">Save Race</button>
        <button class="btn btn-ghost" onclick="closeDevRaceModal()">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Add/Edit Runner Modal -->
  <div class="modal-overlay" id="dev-runner-modal" onclick="if(event.target===this)closeDevRunnerModal()">
    <div class="modal-sheet" style="position:relative;max-width:500px;max-height:88vh;overflow-y:auto">
      <div class="modal-handle"></div>
      <button class="modal-close-btn" onclick="closeDevRunnerModal()">✕</button>
      <div class="modal-title" id="dev-runner-modal-title">Add Runner</div>
      <input type="hidden" id="dev-runner-edit-id">
      <div class="rs-grid">
        <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="dev-rn-name" placeholder="Full Name"></div>
        <div class="form-group"><label class="form-label">RTRT Tracker ID</label><input class="form-input" id="dev-rn-tid" placeholder="RMGBEVSK" style="text-transform:uppercase"></div>
      </div>
      <div class="rs-grid">
        <div class="form-group"><label class="form-label">Emoji</label><input class="form-input" id="dev-rn-emoji" placeholder="💙" maxlength="2"></div>
        <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="dev-rn-color" type="color" value="#007AFF" style="height:40px;padding:4px"></div>
      </div>
      <div class="rs-grid">
        <div class="form-group"><label class="form-label">Gender</label>
          <select class="form-input" id="dev-rn-gender"><option value="F">Female</option><option value="M">Male</option><option value="NB">Non-binary</option></select>
        </div>
        <div class="form-group"><label class="form-label">Date of Birth</label><input class="form-input" type="date" id="dev-rn-dob"></div>
      </div>
      <div class="rs-grid">
        <div class="form-group"><label class="form-label">Hometown / City</label><input class="form-input" id="dev-rn-city" placeholder="New York, NY"></div>
        <div class="form-group"><label class="form-label">Goal Label</label><input class="form-input" id="dev-rn-goal-label" placeholder="Sub-90"></div>
      </div>
      <div class="form-group"><label class="form-label">Goal Time (H:MM:SS)</label><input class="form-input" id="dev-rn-goal-time" placeholder="1:30:00"></div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn" style="flex:1" onclick="devSaveRunner()">Save Runner</button>
        <button class="btn btn-ghost" onclick="closeDevRunnerModal()">Cancel</button>
      </div>
    </div>
  </div>
</div>`;
}

// ── Sub-tab navigation ─────────────────────────────────────
function initDevPaneEvents(REG, GOALS) {
  // Sub-tab switching
  document.querySelectorAll('.dev-sub-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dev-sub-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.dev-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('dev-panel-' + btn.dataset.panel);
      if (panel) panel.classList.add('active');
      if (btn.dataset.panel === 'races') refreshDevTables();
      if (btn.dataset.panel === 'runners') refreshRunnerCards(REG, GOALS);
      if (btn.dataset.panel === 'gist') refreshGistPanel();
    });
  });

  // Drop zone
  const dz = document.getElementById('dev-drop-zone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor='var(--blue)'; dz.style.background='var(--fill-blue)'; });
    dz.addEventListener('dragleave', () => { dz.style.borderColor=''; dz.style.background=''; });
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.style.borderColor=''; dz.style.background='';
      const file = e.dataTransfer.files[0];
      if (file) processCSVFile(file);
    });
  }

  // Load saved gist config
  const tok = localStorage.getItem(GIST_TOKEN_KEY);
  const gid = localStorage.getItem(GIST_ID_KEY);
  if (tok) { const el = document.getElementById('dev-gh-token'); if(el) el.value = tok; }
  if (gid) { const el = document.getElementById('dev-gist-id');  if(el) el.value = gid; }

  // Auto-detect race type from dist
  const raceType = document.getElementById('dev-race-type');
  if (raceType) raceType.addEventListener('change', () => {
    const distMap = { marathon:'26.2', half:'13.1', '10k':'6.2', '5k':'3.1' };
    const distEl = document.getElementById('dev-race-dist');
    if (distEl && distMap[raceType.value]) distEl.value = distMap[raceType.value];
  });

  refreshDevTables();
  refreshRunnerCards(REG, GOALS);
}

// ── Race table ─────────────────────────────────────────────
let _devREG = null, _devGOALS = null;

function refreshDevTables() {
  const sel = document.getElementById('dev-runner-sel');
  if (!sel) return;
  const id = sel.value;
  const races = loadRaces(id).sort((a,b) => b.date.localeCompare(a.date));
  const tbody = document.getElementById('dev-race-tbody');
  const countEl = document.getElementById('dev-race-count');
  if (countEl) countEl.textContent = `${races.length} races`;

  // Stats summary
  const statsEl = document.getElementById('dev-stats-summary');
  if (statsEl && races.length > 0) {
    const totals = computeCareerTotals(races);
    const prs = computePRs(races);
    statsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:4px">
        ${[
          { label:'Total Races', val: totals.totalRaces },
          { label:'Total Miles', val: totals.totalMiles.toLocaleString() + ' mi' },
          { label:'Marathons', val: totals.marathons },
          { label:'Half Marathons', val: totals.halfs },
          { label:'Marathon PR', val: prs.marathon?.time || '—', sub: prs.marathon?.name },
          { label:'Half PR', val: prs.half?.time || '—', sub: prs.half?.name },
        ].map(s => `<div class="hist-card">
          <div class="hist-val" style="font-size:20px">${s.val}</div>
          <div class="hist-lbl">${s.label}</div>
          ${s.sub ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${s.sub}</div>` : ''}
        </div>`).join('')}
      </div>`;
  } else if (statsEl) {
    statsEl.innerHTML = '<div style="font-size:12px;color:var(--text-tertiary);padding:8px 0">No race data. Add races or upload CSV.</div>';
  }

  if (!tbody) return;
  tbody.innerHTML = races.map((r, i) => {
    const pace = fmtPaceFromSec(timeToSec(r.time), r.dist);
    const isPR = (() => { const prs = computePRs(races); return Object.values(prs).some(p => p?.id === r.id); })();
    return `<tr style="border-bottom:1px solid var(--separator);${i%2===0?'':'background:var(--fill-subtle)'}">
      <td style="padding:8px 12px;font-family:var(--font-mono);font-size:12px;color:var(--text-secondary)">${r.date}</td>
      <td style="padding:8px 12px;font-weight:500;color:var(--text-primary)">
        ${isPR ? '<span style="font-size:10px;background:rgba(255,149,0,.15);color:var(--orange);padding:1px 5px;border-radius:4px;margin-right:5px;font-weight:600">PR</span>' : ''}
        ${r.name}
      </td>
      <td style="padding:8px 12px"><span style="font-size:10px;padding:2px 7px;border-radius:980px;background:var(--fill-blue);color:var(--accent)">${r.type||'—'}</span></td>
      <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-size:12px">${r.dist}</td>
      <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--accent)">${r.time}</td>
      <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text-tertiary)">${pace}</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--text-secondary)">${r.location||'—'}</td>
      <td style="padding:8px 12px;text-align:center">
        <button onclick="devEditRace('${id}','${r.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 5px;border-radius:4px;color:var(--blue)" title="Edit">✏️</button>
        <button onclick="devDeleteRace('${id}','${r.id}')" style="background:none;border:none;cursor:pointer;font-size:14px;padding:2px 5px;border-radius:4px;color:var(--red)" title="Delete">🗑</button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--text-tertiary);font-size:13px">No races yet. Add one or upload a CSV.</td></tr>`;
}

// ── Runner cards ──────────────────────────────────────────
function refreshRunnerCards(REG, GOALS) {
  const container = document.getElementById('dev-runner-cards'); if (!container) return;
  container.innerHTML = REG.map(r => {
    const goals = GOALS[r.id] || {};
    const races  = loadRaces(r.id);
    const totals = computeCareerTotals(races);
    const prs    = computePRs(races);
    const info   = JSON.parse(localStorage.getItem('blizzard_personal_'+r.id)||'{}');
    return `<div class="card" style="padding:0;overflow:hidden">
      <div style="height:6px;background:${r.color}"></div>
      <div style="padding:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="width:38px;height:38px;border-radius:50%;background:${r.color}18;color:${r.color};border:2px solid ${r.color}35;display:flex;align-items:center;justify-content:center;font-size:16px">${r.emoji}</div>
          <div>
            <div style="font-size:16px;font-weight:600;color:var(--text-primary)">${r.name}</div>
            <div style="font-size:11px;color:var(--text-tertiary)">ID: ${r.trackId} · ${info.gender||'—'} · DOB: ${info.dob||'—'}</div>
          </div>
          <button onclick="devOpenEditRunner('${r.id}')" class="btn btn-sm btn-ghost" style="margin-left:auto">✏️ Edit</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
          <div style="background:var(--fill-subtle);border-radius:8px;padding:10px">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Marathon PR</div>
            <div style="font-size:18px;font-weight:700;color:${r.color};margin-top:2px">${prs.marathon?.time||'—'}</div>
          </div>
          <div style="background:var(--fill-subtle);border-radius:8px;padding:10px">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary)">Half PR</div>
            <div style="font-size:18px;font-weight:700;color:${r.color};margin-top:2px">${prs.half?.time||'—'}</div>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);display:flex;gap:12px;flex-wrap:wrap">
          <span>🏃 ${totals.totalRaces} races</span>
          <span>🗺 ${totals.totalMiles.toLocaleString()} miles</span>
          <span>🏆 ${totals.marathons}M / ${totals.halfs}H</span>
          <span>🎯 Goal: ${goals.goalLabel||'—'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── CSV file handling ──────────────────────────────────────
let _csvRows = [];

function processCSVFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    _csvRows = parseCSV(text);
    // Auto-detect Strava format and remap
    if (_csvRows.length && _csvRows[0]['Activity Type'] !== undefined) {
      _csvRows = _csvRows
        .filter(r => ['Run'].includes(r['Activity Type']))
        .map((r, i) => ({
          id: 'strava_' + i,
          runner_id: '',
          date: r['Activity Date']?.split(',')[0]?.trim()?.replace(/(\w+) (\d+) (\d{4})/, '$3-'+monthNum('$1')+'-$2') || r['Activity Date'],
          name: r['Activity Name'] || 'Run',
          dist: ((parseFloat(r['Distance']||0) * (r['Distance'].includes('km') ? 0.621371 : 1))).toFixed(2),
          time: r['Elapsed Time'] ? secToHMS(parseInt(r['Elapsed Time'])) : '',
          location: r['Location'] || '',
          type: guessType(parseFloat(r['Distance'])),
        }));
    }
    renderCSVPreview(_csvRows);
  };
  reader.readAsText(file);
}

function renderCSVPreview(rows) {
  const preview = document.getElementById('dev-csv-preview');
  const count   = document.getElementById('dev-preview-count');
  const thead   = document.getElementById('dev-preview-thead');
  const tbody   = document.getElementById('dev-preview-tbody');
  if (!preview || !rows.length) return;
  preview.style.display = '';
  count.textContent = rows.length;
  const cols = CSV_HEADERS;
  thead.innerHTML = `<tr>${cols.map(c=>`<th style="padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-tertiary);background:var(--blue-xxlight);border-bottom:1px solid var(--separator)">${c}</th>`).join('')}</tr>`;
  tbody.innerHTML = rows.slice(0,20).map((r,i)=>`<tr style="border-bottom:1px solid var(--separator)">
    ${cols.map(c=>`<td style="padding:6px 10px;font-size:12px;color:var(--text-primary)">${r[c]||''}</td>`).join('')}
  </tr>`).join('');
}

function monthNum(m) {
  const months = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
  return months[m]||'01';
}
function secToHMS(s) { const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60; return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
function guessType(distMi) {
  if (distMi >= 25) return 'marathon';
  if (distMi >= 12) return 'half';
  if (distMi >= 5)  return '10k';
  return '5k';
}

// ── GitHub Gist ────────────────────────────────────────────
function refreshGistPanel() {
  const tok = localStorage.getItem(GIST_TOKEN_KEY);
  const gid = localStorage.getItem(GIST_ID_KEY);
  const el = document.getElementById('dev-gh-token'); if(el&&tok) el.value=tok;
  const el2= document.getElementById('dev-gist-id');  if(el2&&gid) el2.value=gid;
}

// ── Global exposed functions ───────────────────────────────
window.refreshDevTables = refreshDevTables;

window.devDownloadSampleCSV = function() {
  const sample = `runner_id,date,name,dist,time,location,type
gf,2026-05-16,RBC Brooklyn Half 2026,13.1,1:30:00,Brooklyn NY,half
mom,2026-05-16,RBC Brooklyn Half 2026,13.1,2:10:00,Brooklyn NY,half`;
  downloadText('blizzard-sample.csv', sample);
};

window.devDownloadCurrentCSV = function() {
  const sel = document.getElementById('dev-runner-sel');
  const id  = sel?.value || 'gf';
  const races = loadRaces(id);
  downloadText(`blizzard-races-${id}.csv`, racesToCSV(races));
};

window.devHandleCSVUpload = function(input) {
  const file = input.files[0]; if (!file) return;
  processCSVFile(file);
};

window.devImportPreview = function(mode) {
  if (!_csvRows.length) return;
  const sel = document.getElementById('dev-preview-runner');
  const id  = sel?.value || 'gf';
  const rows = _csvRows.map(r => ({...r, runner_id: id, id: r.id || 'r_'+Date.now()+'_'+Math.random().toString(36).slice(2)}));
  if (mode === 'replace') {
    saveRaces(id, rows);
  } else {
    const existing = loadRaces(id);
    const merged = [...existing, ...rows.filter(r => !existing.find(e => e.date===r.date&&e.name===r.name))];
    saveRaces(id, merged);
  }
  refreshDevTables();
  // Switch to races panel
  document.querySelector('[data-panel="races"]')?.click();
  window.notify?.('Imported ' + rows.length + ' races ✓');
};

window.devOpenAddRace = function() {
  const sel = document.getElementById('dev-runner-sel');
  document.getElementById('dev-race-edit-id').value = '';
  document.getElementById('dev-race-edit-runner').value = sel?.value || 'gf';
  document.getElementById('dev-race-modal-title').textContent = 'Add Race';
  document.getElementById('dev-race-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('dev-race-name').value = '';
  document.getElementById('dev-race-time').value = '';
  document.getElementById('dev-race-dist').value = '26.2';
  document.getElementById('dev-race-loc').value  = '';
  document.getElementById('dev-race-type').value = 'marathon';
  document.getElementById('dev-race-modal').classList.add('open');
};

window.devEditRace = function(runnerId, raceId) {
  const races = loadRaces(runnerId);
  const r = races.find(x => x.id === raceId); if (!r) return;
  document.getElementById('dev-race-edit-id').value = raceId;
  document.getElementById('dev-race-edit-runner').value = runnerId;
  document.getElementById('dev-race-modal-title').textContent = 'Edit Race';
  document.getElementById('dev-race-date').value = r.date||'';
  document.getElementById('dev-race-name').value = r.name||'';
  document.getElementById('dev-race-time').value = r.time||'';
  document.getElementById('dev-race-dist').value = r.dist||'';
  document.getElementById('dev-race-loc').value  = r.location||'';
  document.getElementById('dev-race-type').value = r.type||'marathon';
  document.getElementById('dev-race-modal').classList.add('open');
};

window.devSaveRace = function() {
  const id     = document.getElementById('dev-race-edit-runner').value;
  const editId = document.getElementById('dev-race-edit-id').value;
  const race = {
    id:       editId || 'r_' + Date.now(),
    runner_id:id,
    date:     document.getElementById('dev-race-date').value,
    name:     document.getElementById('dev-race-name').value,
    time:     document.getElementById('dev-race-time').value,
    dist:     document.getElementById('dev-race-dist').value,
    location: document.getElementById('dev-race-loc').value,
    type:     document.getElementById('dev-race-type').value,
  };
  const races = loadRaces(id);
  if (editId) {
    const idx = races.findIndex(r => r.id === editId);
    if (idx >= 0) races[idx] = race; else races.push(race);
  } else {
    races.push(race);
  }
  saveRaces(id, races);
  document.getElementById('dev-race-modal').classList.remove('open');
  refreshDevTables();
  window.notify?.('Race saved ✓');
};

window.devDeleteRace = function(runnerId, raceId) {
  if (!confirm('Delete this race?')) return;
  const races = loadRaces(runnerId).filter(r => r.id !== raceId);
  saveRaces(runnerId, races);
  refreshDevTables();
};

window.devResetRaces = function() {
  const sel = document.getElementById('dev-runner-sel');
  const id  = sel?.value || 'gf';
  if (!confirm('Reset ' + id + ' to sample data?')) return;
  localStorage.removeItem('blizzard_races_' + id);
  refreshDevTables();
};

window.closeDevRaceModal = () => document.getElementById('dev-race-modal')?.classList.remove('open');

window.devOpenAddRunner = function() {
  document.getElementById('dev-runner-edit-id').value = '';
  document.getElementById('dev-runner-modal-title').textContent = 'Add Runner';
  ['name','tid','emoji','city','goal-label','goal-time'].forEach(f => {
    const el = document.getElementById('dev-rn-'+f); if(el) el.value='';
  });
  document.getElementById('dev-rn-color').value = '#007AFF';
  document.getElementById('dev-runner-modal').classList.add('open');
};

window.devOpenEditRunner = function(id) {
  // This needs access to REG and GOALS — use globals
  const r = window._devREG?.find(r=>r.id===id); if(!r) return;
  const goals = window._devGOALS?.[id] || {};
  const info  = JSON.parse(localStorage.getItem('blizzard_personal_'+id)||'{}');
  document.getElementById('dev-runner-edit-id').value = id;
  document.getElementById('dev-runner-modal-title').textContent = 'Edit ' + r.name;
  document.getElementById('dev-rn-name').value = r.name||'';
  document.getElementById('dev-rn-tid').value  = r.trackId||'';
  document.getElementById('dev-rn-emoji').value= r.emoji||'🏃';
  document.getElementById('dev-rn-color').value= r.color||'#007AFF';
  document.getElementById('dev-rn-gender').value= info.gender||'F';
  document.getElementById('dev-rn-dob').value  = info.dob||'';
  document.getElementById('dev-rn-city').value = info.city||'';
  document.getElementById('dev-rn-goal-label').value = goals.goalLabel||'';
  document.getElementById('dev-rn-goal-time').value  = goals.goalTime ? fmtHMS(goals.goalTime) : '';
  document.getElementById('dev-runner-modal').classList.add('open');
};

window.devSaveRunner = function() {
  const editId = document.getElementById('dev-runner-edit-id').value;
  const name   = document.getElementById('dev-rn-name').value.trim();
  const tid    = document.getElementById('dev-rn-tid').value.trim().toUpperCase();
  const emoji  = document.getElementById('dev-rn-emoji').value.trim()||'🏃';
  const color  = document.getElementById('dev-rn-color').value;
  const gender = document.getElementById('dev-rn-gender').value;
  const dob    = document.getElementById('dev-rn-dob').value;
  const city   = document.getElementById('dev-rn-city').value;
  const goalLabel = document.getElementById('dev-rn-goal-label').value;
  const goalTimeStr = document.getElementById('dev-rn-goal-time').value;

  if (!name || !tid) { window.notify?.('Name and tracker ID required'); return; }

  // Save personal info
  localStorage.setItem('blizzard_personal_'+editId, JSON.stringify({gender,dob,city}));

  // Update goals
  if (editId && window._devGOALS?.[editId]) {
    const goals = window._devGOALS[editId];
    if (goalLabel) goals.goalLabel = goalLabel;
    if (goalTimeStr) {
      const p = goalTimeStr.split(':').map(Number);
      if (p.length===3) goals.goalTime = p[0]*3600+p[1]*60+p[2];
      else if (p.length===2) goals.goalTime = p[0]*3600+p[1]*60;
    }
    saveGoals(editId, goals);
  }

  // Update REG
  if (editId && window._devREG) {
    const r = window._devREG.find(r=>r.id===editId);
    if (r) { r.name=name; r.trackId=tid; r.emoji=emoji; r.color=color; }
    else { window._devREG.push({id:'r_'+Date.now(),name,trackId:tid,emoji,color,fixed:false}); }
    window.saveRegistry?.(window._devREG);
  } else if (window._devREG) {
    const newR = {id:'r_'+Date.now(),name,trackId:tid,emoji,color,fixed:false};
    window._devREG.push(newR);
    window.saveRegistry?.(window._devREG);
  }

  document.getElementById('dev-runner-modal').classList.remove('open');
  refreshRunnerCards(window._devREG||[], window._devGOALS||{});
  window.notify?.('Runner saved ✓');
};
window.closeDevRunnerModal = () => document.getElementById('dev-runner-modal')?.classList.remove('open');

window.devSaveGistConfig = function() {
  const tok = document.getElementById('dev-gh-token')?.value?.trim();
  const gid = document.getElementById('dev-gist-id')?.value?.trim();
  if (tok) localStorage.setItem(GIST_TOKEN_KEY, tok);
  if (gid) localStorage.setItem(GIST_ID_KEY, gid);
  window.notify?.('Gist config saved ✓');
};

window.devSaveToGist = async function() {
  const tok = document.getElementById('dev-gh-token')?.value?.trim() || localStorage.getItem(GIST_TOKEN_KEY);
  const gid = document.getElementById('dev-gist-id')?.value?.trim() || localStorage.getItem(GIST_ID_KEY);
  const statusEl = document.getElementById('dev-gist-status');

  if (!tok) { if(statusEl) statusEl.textContent = '⚠️ No GitHub token'; return; }
  if(statusEl) statusEl.textContent = '⏳ Saving to Gist…';

  // Build database payload
  const db = { lastUpdated: new Date().toISOString(), runners: {} };
  (window._devREG||[]).forEach(r => {
    db.runners[r.id] = {
      profile: r,
      goals: window._devGOALS?.[r.id] || {},
      personal: JSON.parse(localStorage.getItem('blizzard_personal_'+r.id)||'{}'),
      races: loadRaces(r.id),
    };
  });

  const content = JSON.stringify(db, null, 2);
  const payload = { description: 'Blizzard Tracker Race Database', public: false, files: { 'blizzard-db.json': { content } } };

  try {
    let res, data;
    if (gid) {
      res = await fetch(`https://api.github.com/gists/${gid}`, { method:'PATCH', headers:{'Authorization':'token '+tok,'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
      res = await fetch('https://api.github.com/gists', { method:'POST', headers:{'Authorization':'token '+tok,'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    data = await res.json();
    if (data.id) {
      localStorage.setItem(GIST_ID_KEY, data.id);
      const el = document.getElementById('dev-gist-id'); if(el) el.value = data.id;
      if(statusEl) statusEl.innerHTML = `✅ Saved! Gist ID: <code>${data.id}</code> · <a href="${data.html_url}" target="_blank">View on GitHub ↗</a>`;
      document.getElementById('dev-gist-preview').textContent = content.slice(0, 2000) + (content.length > 2000 ? '\n...' : '');
    } else {
      if(statusEl) statusEl.textContent = '❌ Error: ' + (data.message || 'unknown');
    }
  } catch(e) { if(statusEl) statusEl.textContent = '❌ ' + e.message; }
};

window.devLoadFromGist = async function() {
  const gid = document.getElementById('dev-gist-id')?.value?.trim() || localStorage.getItem(GIST_ID_KEY);
  const statusEl = document.getElementById('dev-gist-status');
  if (!gid) { if(statusEl) statusEl.textContent = '⚠️ No Gist ID'; return; }
  if(statusEl) statusEl.textContent = '⏳ Loading from Gist…';
  try {
    const res = await fetch(`https://api.github.com/gists/${gid}`);
    const data = await res.json();
    const content = data.files?.['blizzard-db.json']?.content;
    if (!content) { if(statusEl) statusEl.textContent = '❌ File not found in Gist'; return; }
    const db = JSON.parse(content);
    // Save races to localStorage
    Object.entries(db.runners||{}).forEach(([id, r]) => {
      if (r.races?.length) saveRaces(id, r.races);
      if (r.personal) localStorage.setItem('blizzard_personal_'+id, JSON.stringify(r.personal));
      if (r.goals) saveGoals(id, r.goals);
    });
    document.getElementById('dev-gist-preview').textContent = content.slice(0,2000)+(content.length>2000?'\n...':'');
    if(statusEl) statusEl.textContent = '✅ Loaded successfully! Last updated: ' + (db.lastUpdated||'—');
    refreshDevTables();
    window.notify?.('Data loaded from Gist ✓');
  } catch(e) { if(statusEl) statusEl.textContent = '❌ ' + e.message; }
};

window.devOpenGistSetup = function() {
  document.querySelector('[data-panel="gist"]')?.click();
};

// ── Helper ─────────────────────────────────────────────────
function downloadText(filename, text) {
  const a = document.createElement('a');
  a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
  a.download = filename; a.click();
}
