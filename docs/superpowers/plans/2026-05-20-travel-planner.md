# 旅遊規劃工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file `tour-planner.html` travel planner with day/spot management, Google Maps links, drag-and-drop reordering (within-day and cross-day), and dark/light theme switching.

**Architecture:** Single `tour-planner.html` with embedded CSS (CSS custom properties for theming, `data-theme`/`data-layout` on `<html>`) and vanilla JS. State is a plain object; `setState(updater)` mutates then calls `saveToLocalStorage()` + `render()`. `render()` replaces `#app` innerHTML. All DOM event listeners use event delegation and are attached **once** in `init()` — never inside `render()` — to avoid listener accumulation. Drag-and-drop also uses event delegation on `#app`.

**Tech Stack:** HTML5, CSS3 custom properties, Vanilla JavaScript ES6+, HTML5 Drag and Drop API, localStorage API, File API (export/import)

---

## File Map

| File | Purpose |
|------|---------|
| `tour-planner.html` | Single deliverable — all CSS in `<style>`, all JS in `<script>` |

---

## Task 1: HTML Skeleton + Full CSS System

**Files:**
- Create: `tour-planner.html`

- [ ] **Step 1: Create file with complete CSS**

Create `tour-planner.html`:

```html
<!DOCTYPE html>
<html lang="zh-TW" data-theme="dark" data-layout="A">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>旅遊規劃工具</title>
  <style>
    /* ===== CSS Variables ===== */
    :root {
      --bg:           #0f172a;
      --surface:      #1e293b;
      --header-bg:    #1e293b;
      --text:         #f1f5f9;
      --text-muted:   #94a3b8;
      --accent:       #7dd3fc;
      --accent-bg:    #1e3a5f;
      --accent-bd:    #3b82f6;
      --border:       #334155;
      --border-dash:  #334155;
      --time-color:   #fbbf24;
      --shadow:       none;
      --input-bg:     #0f172a;
    }
    [data-theme="light"] {
      --bg:           #f8fafc;
      --surface:      #ffffff;
      --header-bg:    #3b82f6;
      --text:         #1e293b;
      --text-muted:   #94a3b8;
      --accent:       #2563eb;
      --accent-bg:    #dbeafe;
      --accent-bd:    #93c5fd;
      --border:       #e2e8f0;
      --border-dash:  #cbd5e1;
      --time-color:   #f59e0b;
      --shadow:       0 1px 3px rgba(0,0,0,0.08);
      --input-bg:     #f8fafc;
    }

    /* ===== Reset ===== */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      font-size: 14px;
    }
    button { cursor: pointer; font-family: inherit; font-size: inherit; }
    input, select { font-family: inherit; font-size: inherit; }
    a { text-decoration: none; }

    /* ===== Layout ===== */
    #app { display: flex; flex-direction: column; min-height: 100vh; }

    /* ===== Header ===== */
    .app-header {
      background: var(--header-bg);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-right { display: flex; gap: 6px; align-items: center; }
    .trip-name {
      background: transparent;
      border: none;
      color: var(--text);
      font-size: 15px;
      font-weight: 600;
      outline: none;
      border-bottom: 1px dashed transparent;
      transition: border-color 0.2s;
      min-width: 120px;
    }
    .trip-name:hover, .trip-name:focus { border-bottom-color: var(--border); }

    /* ===== Buttons ===== */
    .btn {
      background: var(--input-bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 5px;
      padding: 4px 10px;
      font-size: 12px;
    }
    .btn:hover { opacity: 0.8; }
    .btn-icon {
      background: var(--input-bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 5px;
      padding: 4px 8px;
      font-size: 14px;
    }
    .btn-accent {
      background: var(--accent-bg);
      color: var(--accent);
      border: 1px solid var(--accent-bd);
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 11px;
      white-space: nowrap;
    }
    .btn-accent[disabled] { opacity: 0.4; pointer-events: none; }
    .btn-ghost {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 2px 4px;
      font-size: 13px;
      opacity: 0.5;
    }
    .btn-ghost:hover { opacity: 1; color: #f87171; }
    .btn-add {
      width: 100%;
      background: transparent;
      border: 1px dashed var(--border);
      color: var(--accent);
      border-radius: 6px;
      padding: 8px;
      font-size: 12px;
      margin-top: 6px;
    }

    /* ===== Settings Overlay ===== */
    .settings-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: none;
    }
    .settings-overlay.open { display: block; }
    .settings-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
    .settings-panel {
      position: absolute;
      top: 50px; right: 16px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      width: 260px;
      z-index: 1;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    .settings-title { font-size: 13px; font-weight: 600; margin-bottom: 14px; color: var(--text-muted); }
    .settings-group { margin-bottom: 14px; }
    .settings-label {
      font-size: 10px;
      color: var(--text-muted);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .toggle-group { display: flex; gap: 4px; flex-wrap: wrap; }
    .toggle-btn {
      background: var(--input-bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
    }
    .toggle-btn.active {
      background: var(--accent-bg);
      color: var(--accent);
      border-color: var(--accent-bd);
    }

    /* ===== Day Tabs (Layout A) ===== */
    .day-tabs {
      background: var(--input-bg);
      padding: 8px 16px 0;
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--border);
      overflow-x: auto;
    }
    .day-tab {
      padding: 6px 14px;
      border-radius: 5px 5px 0 0;
      font-size: 12px;
      border: 1px solid transparent;
      border-bottom: none;
      cursor: pointer;
      white-space: nowrap;
      background: transparent;
      color: var(--text-muted);
    }
    .day-tab.active {
      background: var(--surface);
      color: var(--accent);
      border-color: var(--border);
      border-bottom-color: var(--surface);
      margin-bottom: -1px;
    }
    .day-tab-add {
      padding: 6px 12px;
      color: var(--accent);
      font-size: 16px;
      background: transparent;
      border: none;
      cursor: pointer;
      line-height: 1;
    }

    /* ===== Layout B: Sidebar ===== */
    .layout-b-wrap { display: flex; flex: 1; }
    .day-sidebar {
      width: 110px;
      min-width: 110px;
      background: var(--input-bg);
      border-right: 1px solid var(--border);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sidebar-day-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 5px;
      text-align: left;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sidebar-day-btn.active { background: var(--accent-bg); color: var(--accent); }
    .sidebar-day-add {
      color: var(--accent);
      font-size: 12px;
      padding: 4px 8px;
      background: transparent;
      border: none;
      cursor: pointer;
      text-align: left;
    }

    /* ===== Day Content ===== */
    .day-content { flex: 1; padding: 14px 16px; max-width: 700px; }
    .day-content-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .day-name-input {
      background: transparent;
      border: none;
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      outline: none;
      border-bottom: 1px dashed transparent;
      transition: border-color 0.2s;
    }
    .day-name-input:hover, .day-name-input:focus { border-bottom-color: var(--border); }

    /* ===== Layout C: Scroll ===== */
    .layout-c-wrap { padding: 16px; max-width: 720px; margin: 0 auto; }
    .day-section { margin-bottom: 28px; }
    .day-section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    /* ===== Spot Card ===== */
    .spot-card {
      background: var(--surface);
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 4px;
      border: 1px solid transparent;
      box-shadow: var(--shadow);
    }
    .spot-card.drag-over { border-color: var(--accent); background: var(--accent-bg); }
    .spot-card.dragging { opacity: 0.35; }
    .spot-row { display: flex; align-items: center; gap: 6px; }
    .drag-handle { color: var(--text-muted); font-size: 14px; cursor: grab; padding: 0 2px; user-select: none; }
    .spot-name {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text);
      font-size: 13px;
      font-weight: 500;
      outline: none;
      min-width: 0;
    }
    .spot-duration {
      background: var(--input-bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 3px;
      padding: 2px 6px;
      width: 72px;
      font-size: 11px;
    }
    .spot-notes {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 11px;
      width: 100%;
      outline: none;
      padding-left: 22px;
      margin-top: 4px;
    }

    /* ===== Drop Zone ===== */
    .day-drop-zone { min-height: 8px; border-radius: 6px; transition: background 0.15s, border 0.15s; }
    .day-drop-zone.drag-over-zone {
      outline: 2px dashed var(--accent);
      background: var(--accent-bg);
      min-height: 40px;
    }

    /* ===== Route Connector ===== */
    .route-connector {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px;
      margin-bottom: 4px;
    }
    .route-line { flex: 1; border-top: 1px dashed var(--border-dash); }
    .route-transport {
      background: var(--input-bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 3px;
      padding: 2px 4px;
      font-size: 11px;
    }
    .route-time {
      background: var(--input-bg);
      border: 1px solid var(--border);
      color: var(--time-color);
      border-radius: 3px;
      padding: 2px 6px;
      width: 72px;
      font-size: 11px;
    }
    .route-time.filled { border-color: #34d399; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    // JS injected in Task 2+
    document.getElementById('app').innerHTML =
      '<p style="padding:20px;color:var(--text)">載入中…</p>';
  </script>
</body>
</html>
```

- [ ] **Step 2: Open in browser and verify**

Open `tour-planner.html`. Expected:
- Dark `#0f172a` background
- White "載入中…" text
- No console errors

---

## Task 2: App State + Persistence + Utility Functions

**Files:**
- Modify: `tour-planner.html` (replace `<script>` content)

- [ ] **Step 1: Replace `<script>` block with full state infrastructure**

Replace everything between `<script>` and `</script>`:

```javascript
// ===== Utilities =====
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== Google Maps URLs =====
function mapsNavUrl(name) {
  const q = name.trim() || '景點';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function mapsDirectionsUrl(from, to, mode) {
  const o = from.trim() || '出發地';
  const d = to.trim() || '目的地';
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}&travelmode=${mode}`;
}

// ===== Route key helpers =====
function routeKey(fromId, toId) { return `${fromId}→${toId}`; }

function getRoute(fromId, toId) {
  return state.routes[routeKey(fromId, toId)] || {};
}

function clearRoutesForSpot(s, spotId) {
  Object.keys(s.routes).forEach(k => {
    if (k.includes(spotId)) delete s.routes[k];
  });
}

// ===== Default state =====
function makeDay(n) {
  return { id: genId(), label: `第${n}天`, spots: [] };
}

function defaultState() {
  const d = makeDay(1);
  return {
    tripName: '新旅程',
    activeDayId: d.id,
    settings: { layout: 'A', theme: 'dark', defaultTransport: 'driving' },
    days: [d],
    routes: {}
  };
}

// ===== Persistence =====
const STORAGE_KEY = 'travel-planner-v1';

function save(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

// ===== App state =====
let state = load() || defaultState();
let settingsOpen = false;

function setState(updater) {
  updater(state);
  // Ensure activeDayId is valid
  if (!state.days.find(d => d.id === state.activeDayId)) {
    state.activeDayId = state.days[0]?.id ?? null;
  }
  save(state);
  render();
}

// ===== Apply html attributes =====
function applySettings(s) {
  document.documentElement.dataset.theme  = s.theme;
  document.documentElement.dataset.layout = s.layout;
  document.title = `${state.tripName} — 旅遊規劃`;
}

// ===== Render stub =====
function render() {
  applySettings(state.settings);
  document.getElementById('app').textContent =
    `State OK — days: ${state.days.length}, routes: ${Object.keys(state.routes).length}`;
}

render();
```

- [ ] **Step 2: Verify in browser console**

Open browser devtools console and run:

```javascript
// Verify state loaded
console.log(state.tripName);          // "新旅程"
console.log(state.days.length);       // 1
console.log(state.settings.theme);    // "dark"

// Verify setState persists
setState(s => { s.tripName = 'Test'; });
console.log(state.tripName);          // "Test"
console.log(localStorage.getItem('travel-planner-v1')); // contains "Test"
```

Refresh page, run `state.tripName` — should still be `"Test"`.

- [ ] **Step 3: Commit**

```bash
git init
git add tour-planner.html
git commit -m "feat: html skeleton, css system, state management, localStorage"
```

---

## Task 3: Render Engine + Header + Settings Panel

**Files:**
- Modify: `tour-planner.html`

- [ ] **Step 1: Add render functions before the `render()` stub**

Add the following functions before the `render()` function:

```javascript
// ===== Settings Panel =====
function renderSettingsPanel() {
  const { layout, theme, defaultTransport } = state.settings;

  function tb(key, val, label) {
    const active = state.settings[key] === val;
    return `<button class="toggle-btn ${active ? 'active' : ''}"
      data-action="setting" data-key="${key}" data-val="${val}">${label}</button>`;
  }

  return `
    <div class="settings-overlay ${settingsOpen ? 'open' : ''}" id="settings-overlay">
      <div class="settings-backdrop" data-action="close-settings"></div>
      <div class="settings-panel" onclick="event.stopPropagation()">
        <div class="settings-title">⚙️ 設定</div>
        <div class="settings-group">
          <div class="settings-label">版面配置</div>
          <div class="toggle-group">
            ${tb('layout','A','A 頁籤')}
            ${tb('layout','B','B 側欄')}
            ${tb('layout','C','C 捲動')}
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-label">顏色主題</div>
          <div class="toggle-group">
            ${tb('theme','dark','🌙 Dark')}
            ${tb('theme','light','☀️ Light')}
          </div>
        </div>
        <div class="settings-group">
          <div class="settings-label">預設交通方式</div>
          <div class="toggle-group">
            ${tb('defaultTransport','driving','🚗 開車')}
            ${tb('defaultTransport','transit','🚌 大眾')}
            ${tb('defaultTransport','walking','🚶 步行')}
          </div>
        </div>
      </div>
    </div>`;
}

// ===== Header =====
function renderHeader() {
  return `
    <header class="app-header">
      <div class="header-left">
        <span>✈️</span>
        <input class="trip-name" value="${escHtml(state.tripName)}"
          data-action="trip-name" placeholder="旅程名稱">
      </div>
      <div class="header-right">
        <button class="btn" data-action="export-json">📤 匯出</button>
        <label class="btn" style="cursor:pointer">📥 匯入
          <input type="file" accept=".json" data-action="import-json" style="display:none">
        </label>
        <button class="btn-icon" data-action="toggle-settings" title="設定">⚙️</button>
      </div>
    </header>`;
}
```

- [ ] **Step 2: Add export/import functions**

Add after `clearRoutesForSpot`:

```javascript
// ===== Export / Import =====
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${state.tripName}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.days) || !data.settings) throw new Error();
      if (!confirm('匯入將覆蓋目前行程，確定嗎？')) return;
      state = data;
      save(state);
      render();
    } catch (_) { alert('JSON 格式錯誤，無法匯入'); }
  };
  reader.readAsText(file);
}
```

- [ ] **Step 3: Replace `render()` with full version + `init()`**

Replace the existing `render()` stub and the final `render()` call:

```javascript
function render() {
  applySettings(state.settings);
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    ${renderSettingsPanel()}
    <main id="main-area" style="flex:1;display:flex;flex-direction:column">
      <p style="padding:20px;color:var(--text-muted)">
        天數 ${state.days.length}（景點 UI 即將加入）
      </p>
    </main>`;
}

function init() {
  render();
  attachEvents(); // attached once — not inside render()
}

// ===== Event Delegation (attached ONCE in init) =====
function attachEvents() {
  const app = document.getElementById('app');

  // --- Click ---
  app.addEventListener('click', e => {
    const el     = e.target.closest('[data-action]');
    const action = el?.dataset.action;
    if (!action) return;

    if (action === 'toggle-settings') { settingsOpen = !settingsOpen; render(); return; }
    if (action === 'close-settings')  { settingsOpen = false; render(); return; }
    if (action === 'export-json')     { exportJSON(); return; }

    if (action === 'setting') {
      setState(s => { s.settings[el.dataset.key] = el.dataset.val; });
      return;
    }

    if (action === 'add-day') {
      setState(s => {
        const d = makeDay(s.days.length + 1);
        s.days.push(d);
        s.activeDayId = d.id;
      });
      return;
    }

    if (action === 'select-day') {
      const dayId = el.closest('[data-day-id]').dataset.dayId;
      setState(s => { s.activeDayId = dayId; });
      return;
    }

    if (action === 'delete-day') {
      const dayId = el.dataset.dayId;
      if (!confirm('確定刪除這一天？')) return;
      setState(s => { s.days = s.days.filter(d => d.id !== dayId); });
      return;
    }

    if (action === 'add-spot') {
      const dayId = el.dataset.dayId;
      setState(s => {
        const day = s.days.find(d => d.id === dayId);
        if (day) day.spots.push({ id: genId(), name: '', stayDuration: '', notes: '' });
      });
      return;
    }

    if (action === 'delete-spot') {
      const { spotId, dayId } = el.dataset;
      setState(s => {
        const day = s.days.find(d => d.id === dayId);
        if (!day) return;
        clearRoutesForSpot(s, spotId);
        day.spots = day.spots.filter(sp => sp.id !== spotId);
      });
      return;
    }
  });

  // --- Change ---
  app.addEventListener('change', e => {
    const action = e.target.dataset.action;

    if (action === 'import-json' && e.target.files[0]) {
      importJSON(e.target.files[0]);
      return;
    }

    if (action === 'route-transport') {
      const { from, to } = e.target.dataset;
      setState(s => {
        const k = routeKey(from, to);
        if (!s.routes[k]) s.routes[k] = {};
        s.routes[k].transport = e.target.value;
      });
      return;
    }
  });

  // --- Blur (capture) — save text inputs on focus-out ---
  app.addEventListener('blur', e => {
    const { action } = e.target.dataset;
    if (!action) return;

    if (action === 'trip-name') {
      setState(s => { s.tripName = e.target.value.trim() || '新旅程'; });
      return;
    }
    if (action === 'day-name') {
      const { dayId } = e.target.dataset;
      setState(s => {
        const day = s.days.find(d => d.id === dayId);
        if (day) day.label = e.target.value.trim() || day.label;
      });
      return;
    }
    if (action === 'spot-name') {
      const { spotId, dayId } = e.target.dataset;
      setState(s => {
        const spot = s.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
        if (spot) spot.name = e.target.value;
      });
      return;
    }
    if (action === 'spot-duration') {
      const { spotId, dayId } = e.target.dataset;
      setState(s => {
        const spot = s.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
        if (spot) spot.stayDuration = e.target.value;
      });
      return;
    }
    if (action === 'spot-notes') {
      const { spotId, dayId } = e.target.dataset;
      setState(s => {
        const spot = s.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
        if (spot) spot.notes = e.target.value;
      });
      return;
    }
    if (action === 'route-time') {
      const { from, to } = e.target.dataset;
      setState(s => {
        const k = routeKey(from, to);
        if (!s.routes[k]) s.routes[k] = {};
        s.routes[k].recordedTime = e.target.value;
      });
      return;
    }
  }, true); // capture phase required for blur

  // --- Drag and Drop (delegated on #app) ---
  let dragState = null;

  app.addEventListener('dragstart', e => {
    const card = e.target.closest('[data-spot-id]');
    if (!card) return;
    dragState = { spotId: card.dataset.spotId, fromDayId: card.dataset.dayId };
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  app.addEventListener('dragend', () => {
    document.querySelectorAll('.dragging, .drag-over, .drag-over-zone')
      .forEach(el => el.classList.remove('dragging', 'drag-over', 'drag-over-zone'));
  });

  app.addEventListener('dragover', e => {
    if (!dragState) return;
    const card = e.target.closest('[data-spot-id]');
    const zone = e.target.closest('[data-drop-zone]');
    if (card || zone) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      document.querySelectorAll('.drag-over-zone').forEach(el => el.classList.remove('drag-over-zone'));
      if (card) card.classList.add('drag-over');
      else zone.classList.add('drag-over-zone');
    }
  });

  app.addEventListener('dragleave', e => {
    const card = e.target.closest('[data-spot-id]');
    const zone = e.target.closest('[data-drop-zone]');
    if (card) card.classList.remove('drag-over');
    if (zone) zone.classList.remove('drag-over-zone');
  });

  app.addEventListener('drop', e => {
    if (!dragState) return;
    const card = e.target.closest('[data-spot-id]');
    const zone = e.target.closest('[data-drop-zone]');

    if (card && card.dataset.spotId !== dragState.spotId) {
      e.preventDefault();
      moveSpotBefore(dragState.spotId, dragState.fromDayId, card.dataset.spotId, card.dataset.dayId);
    } else if (zone && !card) {
      e.preventDefault();
      moveSpotToDay(dragState.spotId, dragState.fromDayId, zone.dataset.dayId);
    }
    dragState = null;
  });
}

init();
```

- [ ] **Step 4: Add drag move functions after `clearRoutesForSpot`**

```javascript
function moveSpotBefore(spotId, fromDayId, beforeSpotId, toDayId) {
  setState(s => {
    const fromDay = s.days.find(d => d.id === fromDayId);
    const toDay   = s.days.find(d => d.id === toDayId);
    if (!fromDay || !toDay) return;

    const idx = fromDay.spots.findIndex(sp => sp.id === spotId);
    if (idx === -1) return;
    const [spot] = fromDay.spots.splice(idx, 1);
    clearRoutesForSpot(s, spotId);

    const targetIdx = toDay.spots.findIndex(sp => sp.id === beforeSpotId);
    toDay.spots.splice(targetIdx === -1 ? toDay.spots.length : targetIdx, 0, spot);
  });
}

function moveSpotToDay(spotId, fromDayId, toDayId) {
  if (fromDayId === toDayId) return;
  setState(s => {
    const fromDay = s.days.find(d => d.id === fromDayId);
    const toDay   = s.days.find(d => d.id === toDayId);
    if (!fromDay || !toDay) return;

    const idx = fromDay.spots.findIndex(sp => sp.id === spotId);
    if (idx === -1) return;
    const [spot] = fromDay.spots.splice(idx, 1);
    clearRoutesForSpot(s, spotId);
    toDay.spots.push(spot);
  });
}
```

- [ ] **Step 5: Verify in browser**

- Header appears with trip name, 📤/📥/⚙️
- Click ⚙️ → settings panel opens
- Click backdrop → closes
- Toggle A/B/C → `document.documentElement.dataset.layout` changes (check console)
- Toggle Dark/Light → background changes
- Edit trip name, click away → name persists on refresh
- 📤 click → downloads JSON file

- [ ] **Step 6: Commit**

```bash
git add tour-planner.html
git commit -m "feat: header, settings panel, export/import, event delegation"
```

---

## Task 4: Spot Cards + Route Connectors + Day Content Renderers

**Files:**
- Modify: `tour-planner.html`

- [ ] **Step 1: Add spot and route renderers before `renderSettingsPanel`**

```javascript
// ===== Spot Card =====
function renderSpotCard(spot, dayId) {
  const hasName  = spot.name.trim() !== '';
  const navUrl   = hasName ? mapsNavUrl(spot.name) : '#';
  const navAttrs = hasName
    ? `href="${navUrl}" target="_blank" rel="noopener"`
    : `href="#" onclick="return false" title="請先輸入景點名稱" disabled`;

  return `
    <div class="spot-card" data-spot-id="${spot.id}" data-day-id="${dayId}" draggable="true">
      <div class="spot-row">
        <span class="drag-handle" title="拖拉排序">⠿</span>
        <input class="spot-name" value="${escHtml(spot.name)}" placeholder="景點名稱"
          data-action="spot-name" data-spot-id="${spot.id}" data-day-id="${dayId}">
        <input class="spot-duration" value="${escHtml(spot.stayDuration)}" placeholder="停留時間"
          data-action="spot-duration" data-spot-id="${spot.id}" data-day-id="${dayId}">
        <a class="btn-accent" ${navAttrs}>🗺 導航</a>
        <button class="btn-ghost" data-action="delete-spot"
          data-spot-id="${spot.id}" data-day-id="${dayId}" title="刪除景點">✕</button>
      </div>
      <input class="spot-notes" value="${escHtml(spot.notes)}" placeholder="備註（選填）"
        data-action="spot-notes" data-spot-id="${spot.id}" data-day-id="${dayId}">
    </div>`;
}

// ===== Route Connector =====
function renderRouteConnector(fromSpot, toSpot) {
  const route     = getRoute(fromSpot.id, toSpot.id);
  const transport = route.transport || state.settings.defaultTransport;
  const recorded  = route.recordedTime || '';
  const hasFilled = recorded.trim() !== '';
  const mapsUrl   = mapsDirectionsUrl(
    fromSpot.name || '出發地',
    toSpot.name   || '目的地',
    transport
  );

  return `
    <div class="route-connector">
      <div class="route-line"></div>
      <select class="route-transport" data-action="route-transport"
        data-from="${fromSpot.id}" data-to="${toSpot.id}">
        <option value="driving" ${transport === 'driving' ? 'selected' : ''}>🚗 開車</option>
        <option value="transit" ${transport === 'transit' ? 'selected' : ''}>🚌 大眾</option>
        <option value="walking" ${transport === 'walking' ? 'selected' : ''}>🚶 步行</option>
      </select>
      <a class="btn-accent" href="${mapsUrl}" target="_blank" rel="noopener">查看路線 ↗</a>
      <input class="route-time ${hasFilled ? 'filled' : ''}"
        value="${escHtml(recorded)}" placeholder="填入時間"
        data-action="route-time" data-from="${fromSpot.id}" data-to="${toSpot.id}">
      <div class="route-line"></div>
    </div>`;
}

// ===== Day spots area (shared by all layouts) =====
function renderDaySpots(day) {
  let html = `<div class="day-drop-zone" data-drop-zone data-day-id="${day.id}">`;
  day.spots.forEach((spot, i) => {
    html += renderSpotCard(spot, day.id);
    if (i < day.spots.length - 1) {
      html += renderRouteConnector(spot, day.spots[i + 1]);
    }
  });
  html += `</div>`;
  html += `<button class="btn-add" data-action="add-spot" data-day-id="${day.id}">＋ 新增景點</button>`;
  return html;
}

// ===== Day header (inline editable label + delete) =====
function renderDayHeader(day) {
  const canDelete = state.days.length > 1;
  return `
    <div class="day-content-header">
      <input class="day-name-input" value="${escHtml(day.label)}"
        data-action="day-name" data-day-id="${day.id}">
      ${canDelete
        ? `<button class="btn-ghost" data-action="delete-day" data-day-id="${day.id}" title="刪除此天">🗑</button>`
        : ''}
    </div>`;
}
```

- [ ] **Step 2: Add layout renderers before `render()`**

```javascript
// ===== Layout A: Tabs =====
function renderLayoutA() {
  const active = state.days.find(d => d.id === state.activeDayId) || state.days[0];
  const tabs = state.days.map(d => `
    <button class="day-tab ${d.id === active?.id ? 'active' : ''}"
      data-action="select-day" data-day-id="${d.id}">${escHtml(d.label)}</button>
  `).join('');

  return `
    <div class="day-tabs">
      ${tabs}
      <button class="day-tab-add" data-action="add-day" title="新增天數">＋</button>
    </div>
    <div class="day-content">
      ${active ? renderDayHeader(active) + renderDaySpots(active) : ''}
    </div>`;
}

// ===== Layout B: Sidebar =====
function renderLayoutB() {
  const active = state.days.find(d => d.id === state.activeDayId) || state.days[0];
  const items  = state.days.map(d => `
    <button class="sidebar-day-btn ${d.id === active?.id ? 'active' : ''}"
      data-action="select-day" data-day-id="${d.id}">${escHtml(d.label)}</button>
  `).join('');

  return `
    <div class="layout-b-wrap">
      <div class="day-sidebar">
        ${items}
        <button class="sidebar-day-add" data-action="add-day">＋ 新增天</button>
      </div>
      <div class="day-content">
        ${active ? renderDayHeader(active) + renderDaySpots(active) : ''}
      </div>
    </div>`;
}

// ===== Layout C: Vertical Scroll =====
function renderLayoutC() {
  const sections = state.days.map(day => `
    <div class="day-section">
      <div class="day-section-header">
        <span style="color:var(--accent)">📅</span>
        <input class="day-name-input" value="${escHtml(day.label)}"
          data-action="day-name" data-day-id="${day.id}">
        ${state.days.length > 1
          ? `<button class="btn-ghost" data-action="delete-day" data-day-id="${day.id}" title="刪除此天">🗑</button>`
          : ''}
      </div>
      ${renderDaySpots(day)}
    </div>
  `).join('');

  return `
    <div class="layout-c-wrap">
      ${sections}
      <button class="btn-add" style="max-width:260px" data-action="add-day">＋ 新增天數</button>
    </div>`;
}
```

- [ ] **Step 3: Update `render()` to use layout renderers**

Replace the `render()` function:

```javascript
function render() {
  applySettings(state.settings);

  const { layout } = state.settings;
  const mainContent = layout === 'B' ? renderLayoutB()
    : layout === 'C' ? renderLayoutC()
    : renderLayoutA();

  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    ${renderSettingsPanel()}
    <main id="main-area" style="flex:1;display:flex;flex-direction:column">
      ${mainContent}
    </main>`;
}
```

- [ ] **Step 4: Verify in browser**

- Add spots → cards appear with name/duration/notes/delete button
- Fill in spot name, click away → persists
- Route connectors appear between adjacent spots
- Select transit in route connector → immediately saved
- Fill "25分鐘" in time input, click away → green border, persists on refresh
- Click 查看路線 → Google Maps directions opens in new tab
- Click 🗺 導航 → Google Maps search opens
- Empty spot name → 導航 button is unclickable
- Layout A tabs: switching days works
- Layout B sidebar: switching days works
- Layout C: all days visible, editable

- [ ] **Step 5: Commit**

```bash
git add tour-planner.html
git commit -m "feat: spot cards, route connectors, layout A/B/C rendering"
```

---

## Task 5: Verify Drag and Drop

**Files:**
- Read: `tour-planner.html` (confirm DnD handlers from Task 3 are present)

The drag-and-drop handlers were added in Task 3's `attachEvents()` and the move functions added after `clearRoutesForSpot`. This task verifies they work end-to-end now that spot cards are rendered.

- [ ] **Step 1: Verify within-day drag and drop**

1. Add 3 spots to Day 1: A, B, C
2. Fill route times: A→B "10分鐘", B→C "20分鐘"
3. Drag spot C (grab the ⠿ handle) and drop it onto spot A
4. Expected: order becomes C, A, B — and all route times are cleared (C's routes were reset)
5. Verify: `state.routes` in console should be empty `{}`

- [ ] **Step 2: Verify cross-day drag**

1. Add Day 2
2. Switch to Layout C (shows both days)
3. Drag spot A from Day 1, drop it into the Day 2 area (below Day 2's spots or onto the dashed drop zone)
4. Expected: A appears in Day 2, Day 1 shows only 2 spots
5. Verify routes involving A's id are cleared

- [ ] **Step 3: Verify route rebuild after move**

After moving spot A to Day 2:
1. The route connector between Day 2's spots (if any) uses the correct spot ids
2. Click 查看路線 on the new connector → correct Google Maps link (origin/destination updated)

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add tour-planner.html
git commit -m "fix: drag-and-drop verified and adjusted"
```

(Skip commit if no changes were needed.)

---

## Task 6: Final Polish + Edge Cases

**Files:**
- Modify: `tour-planner.html`

- [ ] **Step 1: Add missing `activeDayId` to defaultState for import compatibility**

Ensure `importJSON` always sets a valid `activeDayId` after import. In `importJSON`, after `state = data;` add:

```javascript
if (!state.days?.find(d => d.id === state.activeDayId)) {
  state.activeDayId = state.days?.[0]?.id ?? null;
}
```

- [ ] **Step 2: Prevent settings panel overlap issue on Layout C scroll**

The settings panel uses `position: fixed` overlay — already handled by CSS. Verify by scrolling Layout C and opening settings: panel should remain pinned at top-right.

Open browser, switch to Layout C, add enough spots to scroll. Click ⚙️ while scrolled down. Panel should appear near top-right. ✓ No code change needed if already correct.

- [ ] **Step 3: End-to-end test**

Plan a 2-day Kyoto trip:

1. Open `tour-planner.html`
2. Edit name → "京都 2 日遊"
3. Day 1: add 金閣寺、嵐山竹林、錦市場
4. Day 1 金閣寺→嵐山: select 🚌, click 查看路線, fill "35分鐘"
5. Day 1 嵐山→錦市場: select 🚗, fill "20分鐘"
6. Add Day 2: add 伏見稻荷、清水寺
7. Drag 錦市場 from Day 1 to Day 2 — route times involving 錦市場 cleared
8. Layout B: switch days via sidebar ✓
9. Layout C: both days visible, all spots with connectors ✓
10. Light theme: all cards white, header blue ✓
11. 📤 匯出 → download file ✓
12. 📥 匯入 → re-import → data restored ✓
13. Refresh → all data persists ✓

- [ ] **Step 4: Final commit**

```bash
git add tour-planner.html
git commit -m "feat: travel planner complete - all requirements verified"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|---|---|
| 行程名稱可編輯 | Task 3 |
| 新增/刪除/重命名天數 | Task 3 (events) + Task 4 (render) |
| 景點拖拉排序（同天） | Task 3 (DnD events) |
| 景點跨天拖拉 | Task 3 (`moveSpotToDay`) |
| 移動後路線清空 | Task 3 (`clearRoutesForSpot`) |
| 景點名稱/停留時間/備註 | Task 4 |
| 路線連接器 + 交通方式 | Task 4 |
| Google Maps 導航連結 | Task 4 |
| Google Maps 路線連結 | Task 4 |
| 手動填入車程時間 | Task 4 |
| 設定面板：版面 A/B/C | Task 3 |
| 設定面板：Dark/Light | Task 3 |
| 設定面板：預設交通方式 | Task 3 |
| localStorage 自動儲存 | Task 2 |
| 匯出 JSON | Task 3 |
| 匯入 JSON | Task 3 |
