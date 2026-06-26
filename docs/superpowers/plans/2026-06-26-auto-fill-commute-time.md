# Auto-Fill Commute Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增「一鍵自動填通勤時間」功能，透過 Nominatim + OSRM（免費）或 Google Maps Directions API（有 key）自動查詢行程中各路線段的通勤時間並批次填入。

**Architecture:** 所有程式碼集中於 `tour-planner.html` 單一檔案。新功能包含：(1) state 新增 `googleMapsApiKey` 欄位；(2) 一個確認對話框 overlay（仿既有 share-dialog 模式，由 `autoFillDialogState` 控制）；(3) 非同步 API 查詢函式；(4) 每天標題的 per-day 按鈕與設定面板的全域按鈕；(5) toast 通知系統（直接操作 DOM，不走 render()）。

**Tech Stack:** 純 HTML/CSS/JS，無框架。外部 API：Nominatim（geocoding）、OSRM（路線）、Google Maps Directions API（可選）。

---

## 檔案異動

- 修改：`tour-planner.html`（唯一檔案）
  - CSS（`<style>` 區塊，~L958 前）：新增 toast + auto-fill overlay CSS
  - L1677：`defaultState()` 新增 `googleMapsApiKey: 'NONE'`
  - L1718-1720：`migrateState()` 新增欄位初始化
  - L1791 附近：新增 `autoFillDialogState` 模組變數 + `autoFillLoadingDayId`
  - L2112：`renderDaySpots()` 新增 per-day ⏱ 按鈕
  - L2140-2235：`renderSettingsPanel()` 新增 Google Maps 區塊 + 工具區塊
  - L2770-2790：`render()` 新增 `renderAutoFillOverlay()` 呼叫
  - L2811+：`attachEvents()` 新增所有 auto-fill 相關 action handler
  - L2462+：`renderHelpOverlay()` 新增功能說明文字

---

## Task 1：State — 新增 googleMapsApiKey 欄位

**Files:**
- Modify: `tour-planner.html:1677`（defaultState）
- Modify: `tour-planner.html:1718`（migrateState）

- [ ] **Step 1: 在 `defaultState()` 的 settings 物件加入新欄位**

找到 L1677 的 settings 物件：
```js
settings: { layout: 'A', theme: 'cream', defaultTransport: 'driving', fontSize: 'normal', weatherCity: '', weatherGeo: null, weatherModel: null },
```
改為：
```js
settings: { layout: 'A', theme: 'cream', defaultTransport: 'driving', fontSize: 'normal', weatherCity: '', weatherGeo: null, weatherModel: null, googleMapsApiKey: 'NONE' },
```

- [ ] **Step 2: 在 `migrateState()` 補上遷移邏輯**

找到 L1720 的 `if (s.settings.weatherModel === undefined)` 那行之後，新增：
```js
if (s.settings.googleMapsApiKey === undefined) s.settings.googleMapsApiKey = 'NONE';
```

- [ ] **Step 3: 在瀏覽器開啟 tour-planner.html，開啟 DevTools Console，執行 `state.settings.googleMapsApiKey`，確認回傳 `'NONE'`（對舊資料需先清除 localStorage）**

- [ ] **Step 4: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add googleMapsApiKey to state settings"
```

---

## Task 2：Toast 通知系統

**Files:**
- Modify: `tour-planner.html` — CSS 區塊（L958 前）+ JS 函式區

- [ ] **Step 1: 在 `</style>` 標籤（L958）之前新增 toast CSS**

```css
/* ===== Toast ===== */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 18px;
  font-size: 13px;
  color: var(--text);
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: none;
  max-width: 90vw;
  text-align: center;
}
.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.toast.toast-warn { border-color: #f59e0b; }
.toast.toast-ok   { border-color: #34d399; }
```

- [ ] **Step 2: 在 JS `<script>` 區塊頂部（`// ===== Firebase Config =====` 之前的適當位置，例如 `attachEvents` 之後）新增 `showToast` 函式**

找到 `function init()` 附近（L2792），在其前方插入：

```js
// ===== Toast =====
function showToast(msg, type = 'ok') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'app-toast';
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('show'));
  });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 3500);
}
```

- [ ] **Step 3: 開啟瀏覽器 Console 執行 `showToast('測試通知', 'ok')`，確認畫面底部出現 toast 並在約 3.5 秒後消失**

- [ ] **Step 4: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add toast notification system"
```

---

## Task 3：Auto-fill 對話框 — state + CSS + renderAutoFillOverlay()

**Files:**
- Modify: `tour-planner.html` — CSS、模組變數、render 函式

- [ ] **Step 1: 新增 Auto-fill overlay CSS（在 `</style>` 之前）**

```css
/* ===== Auto-fill overlay ===== */
.autofill-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  display: none;
}
.autofill-overlay.open { display: block; }
.autofill-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
}
.autofill-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 20px;
  min-width: 280px;
  max-width: 340px;
  width: calc(100% - 40px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  z-index: 1;
}
.autofill-dialog-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 14px;
}
.autofill-dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
}
```

- [ ] **Step 2: 在模組變數區（L1791 附近，`let settingsOpen = false;` 前後）新增**

```js
let autoFillDialogState = null;
// null = closed; { segments, loadingDayId } = open
let autoFillLoadingDayId = null;  // 'all' or day.id while fetching
```

- [ ] **Step 3: 在 `renderSettingsPanel()` 之前（L2139 附近）插入 `renderAutoFillOverlay()` 函式**

```js
// ===== Auto-fill Overlay =====
function renderAutoFillOverlay() {
  if (!autoFillDialogState) {
    return `<div class="autofill-overlay" id="autofill-overlay"></div>`;
  }
  const segs = autoFillDialogState.segments;
  const hasExisting = segs.some(s => s.hasTime);
  const total = segs.length;
  const transitSkipped = state.settings.googleMapsApiKey === 'NONE'
    ? segs.filter(s => s.transport === 'transit').length
    : 0;
  const fillable = total - transitSkipped;

  return `
    <div class="autofill-overlay open" id="autofill-overlay">
      <div class="autofill-backdrop" data-action="close-autofill-dialog"></div>
      <div class="autofill-dialog">
        <div class="autofill-dialog-title">⏱ 自動填通勤時間</div>
        <div style="font-size:13px;margin-bottom:10px">
          找到 <b>${fillable}</b> 條路線待填入
          ${transitSkipped > 0
            ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">※ ${transitSkipped} 條大眾運輸路線略過（未設定 Google Maps key）</div>`
            : ''}
        </div>
        ${hasExisting ? `
          <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px;cursor:pointer">
            <input type="checkbox" id="autofill-overwrite" checked>
            <span>覆蓋已有時間的路線</span>
          </label>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">若不勾選，已有時間的路線將略過</div>
        ` : ''}
        <div style="font-size:13px;margin-bottom:6px">緩衝時間</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <input type="number" id="autofill-buffer" value="0" min="0" max="120"
            style="width:70px;border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:13px;background:var(--input-bg);color:var(--text)">
          <span style="font-size:13px;color:var(--text-muted)">分鐘</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">每段通勤時間自動加上此緩衝</div>
        <div class="autofill-dialog-actions">
          <button class="btn" data-action="close-autofill-dialog">取消</button>
          <button class="btn-accent" data-action="confirm-autofill"
            ${fillable === 0 ? 'disabled' : ''}>開始填入</button>
        </div>
      </div>
    </div>`;
}
```

- [ ] **Step 4: 在 `render()` 函式（L2777）的 innerHTML 字串中加入 `renderAutoFillOverlay()`**

找到：
```js
document.getElementById('app').innerHTML = `
  ${renderPrintHeader()}
  ${renderHeader()}
  ${renderSettingsPanel()}
  <main id="main-area" style="flex:1;display:flex;flex-direction:column">
    ${mainContent}
  </main>
  ${renderShareOverlay()}
  ${renderHelpOverlay()}
  ${renderTripsOverlay()}
  ${renderMobileBottomBar()}`;
```
改為（新增 `${renderAutoFillOverlay()}`）：
```js
document.getElementById('app').innerHTML = `
  ${renderPrintHeader()}
  ${renderHeader()}
  ${renderSettingsPanel()}
  <main id="main-area" style="flex:1;display:flex;flex-direction:column">
    ${mainContent}
  </main>
  ${renderShareOverlay()}
  ${renderAutoFillOverlay()}
  ${renderHelpOverlay()}
  ${renderTripsOverlay()}
  ${renderMobileBottomBar()}`;
```

- [ ] **Step 5: 開啟瀏覽器，於 Console 執行：**
```js
autoFillDialogState = { segments: [{rk:'a→b', fromName:'台北101', toName:'故宮', transport:'driving', hasTime: false}] };
render();
```
確認對話框出現，顯示「找到 1 條路線待填入」。

- [ ] **Step 6: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add auto-fill dialog overlay"
```

---

## Task 4：核心 API 函式

**Files:**
- Modify: `tour-planner.html` — 新增四個函式於 `// ===== Toast =====` 區塊附近

- [ ] **Step 1: 插入 `collectRouteSegments(days)` 函式**

```js
// ===== Auto-fill Commute: helpers =====
function collectRouteSegments(days) {
  const dayList = Array.isArray(days) ? days : [days];
  const segments = [];
  dayList.forEach(day => {
    if (day.spots.length === 0) return;
    const fromNodes = [
      { id: hotelStartId(day.id), name: day.startHotelName || '' },
      ...day.spots.slice(0, -1)
    ];
    const toNodes = [
      ...day.spots,
      { id: hotelEndId(day.id), name: day.endHotelName || '' }
    ];
    fromNodes.forEach((from, i) => {
      const to = toNodes[i];
      const rk = routeKey(from.id, to.id);
      const route = state.routes[rk] || {};
      const transport = route.transport || state.settings.defaultTransport;
      segments.push({
        rk,
        fromName: from.name || '',
        toName: to.name || '',
        transport,
        hasTime: (route.recordedTime || 0) > 0
      });
    });
  });
  return segments;
}
```

- [ ] **Step 2: 插入 `nominatimGeocode(name)` 函式**

```js
async function nominatimGeocode(name) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'tour-planner', 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}
```

- [ ] **Step 3: 插入 `osrmRoute(from, to, profile)` 函式**

```js
// from, to: { lat, lng }; profile: 'driving' | 'foot'
async function osrmRoute(from, to, profile) {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    return data.routes[0].duration; // seconds
  } catch { return null; }
}
```

- [ ] **Step 4: 插入 `googleMapsRoute(fromName, toName, mode, key)` 函式**

```js
async function googleMapsRoute(fromName, toName, mode, key) {
  const params = new URLSearchParams({ origin: fromName, destination: toName, mode, key });
  const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.routes?.length) return null;
    return data.routes[0].legs[0].duration.value; // seconds
  } catch { return null; }
}
```

- [ ] **Step 5: 開啟瀏覽器 Console，執行下列驗證（需網路）：**
```js
// 驗證 nominatimGeocode
nominatimGeocode('台北101').then(r => console.log('geocode result:', r));
// 預期：{ lat: 25.0339..., lng: 121.5645... }
```
若有結果（非 null）則繼續；若 null 表示 API 呼叫失敗（確認網路）。

- [ ] **Step 6: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add nominatimGeocode, osrmRoute, googleMapsRoute, collectRouteSegments"
```

---

## Task 5：autoFillCommuteTime() 主流程

**Files:**
- Modify: `tour-planner.html` — 新增 `autoFillCommuteTime` 函式

- [ ] **Step 1: 在 Task 4 新增的函式之後插入 `autoFillCommuteTime`**

```js
// opts: { bufferMins: number, overwrite: boolean }
async function autoFillCommuteTime(segments, opts) {
  const { bufferMins, overwrite } = opts;
  const key = state.settings.googleMapsApiKey;
  const hasKey = key && key !== 'NONE';
  const osrmProfile = { driving: 'driving', walking: 'foot', transit: 'driving' };
  const delay = ms => new Promise(r => setTimeout(r, ms));

  let success = 0, skipped = 0, failed = 0;
  const skippedTransitKeys = [];
  const updates = {};

  for (const seg of segments) {
    const { rk, fromName, toName, transport, hasTime } = seg;

    if (!overwrite && hasTime) { skipped++; continue; }
    if (transport === 'transit' && !hasKey) {
      skipped++;
      skippedTransitKeys.push(rk);
      continue;
    }
    if (!fromName.trim() || !toName.trim()) { skipped++; continue; }

    let secs = null;

    if (hasKey) {
      secs = await googleMapsRoute(fromName, toName, transport, key);
    } else {
      const fromGeo = await nominatimGeocode(fromName);
      await delay(1100);
      if (!fromGeo) { failed++; continue; }
      const toGeo = await nominatimGeocode(toName);
      await delay(1100);
      if (!toGeo) { failed++; continue; }
      const profile = osrmProfile[transport] || 'driving';
      secs = await osrmRoute(fromGeo, toGeo, profile);
    }

    if (secs !== null) {
      updates[rk] = Math.ceil(secs / 60) + bufferMins;
      success++;
    } else {
      failed++;
    }
  }

  if (Object.keys(updates).length > 0) {
    setState(s => {
      Object.entries(updates).forEach(([rk, mins]) => {
        if (!s.routes[rk]) s.routes[rk] = { transport: state.settings.defaultTransport };
        s.routes[rk].recordedTime = mins;
      });
    });
  }

  let msg = `通勤時間填入完成：成功 ${success} 條`;
  if (skipped > 0) {
    const transitMsg = skippedTransitKeys.length > 0 ? `（含 ${skippedTransitKeys.length} 條大眾運輸需 key）` : '';
    msg += `、略過 ${skipped} 條${transitMsg}`;
  }
  if (failed > 0) msg += `、失敗 ${failed} 條（找不到地點）`;
  showToast(msg, failed > 0 ? 'warn' : 'ok');
}
```

- [ ] **Step 2: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add autoFillCommuteTime main execution function"
```

---

## Task 6：設定面板 — Google Maps 區塊 + 工具區塊

**Files:**
- Modify: `tour-planner.html:2216` — `renderSettingsPanel()` 函式結尾

- [ ] **Step 1: 在 `renderSettingsPanel()` 的結尾，找到關閉 `</div>` 的地方（行程統計區塊後、最後的 `</div></div>` 前）插入兩個新設定群組**

找到行程統計區塊結尾（`</div>\`;` 之前，L2233 附近）：
```js
            </div>
            </div>
          </div>
        </div>`;
```
在倒數第三個 `</div>` 前插入：

```js
            <div class="settings-group">
              <div class="settings-label">Google Maps</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                  <input type="radio" name="gmaps-key-mode" value="NONE"
                    ${state.settings.googleMapsApiKey === 'NONE' ? 'checked' : ''}
                    data-action="gmaps-key-mode" data-val="NONE">
                  沒有 key（大眾運輸路線將略過）
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer">
                  <input type="radio" name="gmaps-key-mode" value="KEY"
                    ${state.settings.googleMapsApiKey !== 'NONE' ? 'checked' : ''}
                    data-action="gmaps-key-mode" data-val="KEY">
                  使用 API Key
                </label>
                ${state.settings.googleMapsApiKey !== 'NONE' ? `
                  <input type="text"
                    style="width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;background:var(--input-bg);color:var(--text)"
                    placeholder="Google Maps Directions API key"
                    value="${escHtml(state.settings.googleMapsApiKey)}"
                    data-action="gmaps-api-key-input">
                ` : ''}
              </div>
            </div>
            <div class="settings-group">
              <div class="settings-label">工具</div>
              <button class="btn-accent" data-action="auto-fill-all"
                ${autoFillLoadingDayId === 'all' ? 'disabled' : ''}
                style="width:100%">
                ${autoFillLoadingDayId === 'all' ? '查詢中…' : '⏱ 自動填所有天的通勤時間'}
              </button>
            </div>
```

- [ ] **Step 2: 開啟瀏覽器，點選齒輪圖示，確認設定面板底部出現「Google Maps」和「工具」兩個新區塊，且切換 radio button 時 API Key 輸入框正確顯示/隱藏（事件處理在 Task 8 加入，此時切換不會有反應，僅確認 UI 渲染正確）**

- [ ] **Step 3: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add Google Maps key settings and tools section to settings panel"
```

---

## Task 7：Per-day 按鈕

**Files:**
- Modify: `tour-planner.html:2112` — `renderDaySpots()` 函式底部

- [ ] **Step 1: 找到 `renderDaySpots()` 末尾（L2112），修改新增景點按鈕那行，在其前方加入 per-day 按鈕**

找到：
```js
html += `<button class="btn-add" data-action="add-spot" data-day-id="${day.id}">＋ 新增景點</button>`;
```
改為：
```js
html += `
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
    <button class="btn-add" data-action="add-spot" data-day-id="${day.id}">＋ 新增景點</button>
    ${day.spots.length > 0 ? `
      <button class="btn-accent" data-action="auto-fill-day" data-day-id="${day.id}"
        ${autoFillLoadingDayId === day.id ? 'disabled' : ''}
        style="font-size:12px;padding:5px 10px">
        ${autoFillLoadingDayId === day.id ? '查詢中…' : '⏱ 自動填通勤'}
      </button>
    ` : ''}
  </div>`;
```

- [ ] **Step 2: 開啟瀏覽器，確認每天（有景點時）出現「⏱ 自動填通勤」按鈕，且在沒有景點的天不出現該按鈕**

- [ ] **Step 3: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add per-day auto-fill commute button"
```

---

## Task 8：Event Handlers

**Files:**
- Modify: `tour-planner.html` — `attachEvents()` 函式（L2811+）

- [ ] **Step 1: 在 `attachEvents()` 的 click handler 中，找到最後一個 `if (action === ...)` 區塊之後，加入以下處理器**

```js
// --- Auto-fill: open dialog ---
if (action === 'auto-fill-day') {
  const dayId = el.dataset.dayId;
  const day = state.days.find(d => d.id === dayId);
  if (!day) return;
  const segments = collectRouteSegments(day);
  const fillable = segments.filter(s =>
    !(s.transport === 'transit' && state.settings.googleMapsApiKey === 'NONE')
  );
  if (fillable.length === 0) {
    showToast('此天無可填入的路線段', 'warn');
    return;
  }
  autoFillDialogState = { segments, scope: dayId };
  render();
  return;
}

if (action === 'auto-fill-all') {
  const segments = collectRouteSegments(state.days);
  const fillable = segments.filter(s =>
    !(s.transport === 'transit' && state.settings.googleMapsApiKey === 'NONE')
  );
  if (fillable.length === 0) {
    showToast('無可填入的路線段', 'warn');
    return;
  }
  autoFillDialogState = { segments, scope: 'all' };
  render();
  return;
}

// --- Auto-fill: close dialog ---
if (action === 'close-autofill-dialog') {
  autoFillDialogState = null;
  render();
  return;
}

// --- Auto-fill: confirm ---
if (action === 'confirm-autofill') {
  if (!autoFillDialogState) return;
  const overwriteEl = document.getElementById('autofill-overwrite');
  const bufferEl = document.getElementById('autofill-buffer');
  const overwrite = overwriteEl ? overwriteEl.checked : true;
  const bufferMins = Math.max(0, parseInt(bufferEl?.value || '0', 10) || 0);
  const segments = autoFillDialogState.segments;
  const scope = autoFillDialogState.scope;

  autoFillDialogState = null;
  autoFillLoadingDayId = scope;
  render();

  autoFillCommuteTime(segments, { bufferMins, overwrite }).finally(() => {
    autoFillLoadingDayId = null;
    render();
  });
  return;
}
```

- [ ] **Step 2: 在既有的 `change` handler（L3298）中加入 Google Maps key 模式切換**

找到 L3298 的 `app.addEventListener('change', e => {` 區塊，在其內部最後一個 `if` 區塊之後加入：

```js
if (action === 'gmaps-key-mode') {
  const val = el.dataset.val;
  setState(s => {
    if (val === 'NONE') {
      s.settings.googleMapsApiKey = 'NONE';
    } else {
      // 切換到 KEY 模式時先設空字串，讓 key input 顯示
      if (s.settings.googleMapsApiKey === 'NONE') s.settings.googleMapsApiKey = '';
    }
  });
  return;
}
```

- [ ] **Step 3: 在既有的 `input` handler（L3251）中加入 API key 輸入處理**

找到 L3251 的 `app.addEventListener('input', e => {` 區塊，在其內部最後一個 `if` 區塊之後加入：

```js
if (action === 'gmaps-api-key-input') {
  const key = e.target.value.trim();
  setState(s => { s.settings.googleMapsApiKey = key || ''; });
  return;
}
```

- [ ] **Step 4: 開啟瀏覽器測試完整流程**

1. 加入 2 個以上景點（如「台北101」、「故宮博物院」）
2. 點選「⏱ 自動填通勤」按鈕
3. 確認對話框出現，顯示正確的路線數量
4. 緩衝時間填入 5
5. 點「開始填入」
6. 等候查詢完成（free path 需要每段約 2–3 秒）
7. 確認 toast 出現「成功 N 條」
8. 確認各路線段的時間已填入（且時間 = API 結果 + 5 分鐘）

- [ ] **Step 5: Commit**

```bash
git add tour-planner.html
git commit -m "feat: wire auto-fill event handlers and Google Maps key setting"
```

---

## Task 9：更新說明頁面（Help Overlay）

**Files:**
- Modify: `tour-planner.html` — `renderHelpOverlay()` 函式

- [ ] **Step 1: 在 `renderHelpOverlay()` 中找到「🗓 行程規劃」section 的最後一個 help-item（景點之間可設定交通方式那行），在其後新增說明**

找到（L2480 附近）：
```html
<div class="help-item">• 景點之間可設定<b>交通方式</b>與<b>交通時間</b>，時間軸會自動計算每個景點的抵達與離開時間</div>
```
在其後加入：
```html
<div class="help-item">• 點 <b>⏱ 自動填通勤</b> 可一鍵透過 OpenStreetMap（免費）或 Google Maps（需在設定填入 API key）自動查詢並填入所有交通時間；可在設定面板的「工具」區選擇填入所有天</div>
```

- [ ] **Step 2: 找到 Help Overlay 底部的「最後更新」欄位，更新日期為當天（2026-06-26）**

- [ ] **Step 3: Commit**

```bash
git add tour-planner.html
git commit -m "docs: update help overlay with auto-fill commute feature description"
```

---

## 驗收測試

完成所有 Task 後，執行以下完整驗收流程：

1. **免費路徑測試**：設定 googleMapsApiKey = 'NONE'，加入 3 個景點（使用真實地名如「台北101」、「故宮博物院」、「士林夜市」），點「⏱ 自動填通勤」，確認 3 條路線時間均填入，toast 顯示「成功 3 條」
2. **緩衝時間**：再次執行，緩衝時間設 10 分鐘，確認填入的時間比上一次各多 10 分鐘
3. **覆蓋邏輯**：再次執行，取消勾選「覆蓋已有時間」，確認 toast 顯示「略過 3 條」且路線時間不變
4. **Transit 略過**：將某條路線改為「大眾運輸」，在無 key 狀態執行，確認 transit 那條計入「略過」
5. **全域按鈕**：設定面板中點「⏱ 自動填所有天的通勤時間」，確認對所有天的路線均有效
6. **無景點天**：沒有景點的天不顯示 per-day 按鈕
7. **空名稱景點**：景點名稱為空時，對應路線略過（不失敗）
