# 座標儲存與匯出確認功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在景點卡片加入座標儲存（🔍 查座標按鈕 + 狀態圖示），改善 KML 匯出精準度，並新增匯出前預覽 Dialog 與 CSV 匯出功能。

**Architecture:** 純瀏覽器單檔案 app，所有變更集中於 `tour-planner.html`。Spot 物件新增 `lat/lng/resolvedAddress` 欄位；geocoding 由 Places Autocomplete（有 API key）或 Nominatim（無 key）提供；KML 與 CSV 匯出前共用 `buildCoordMap` + `showExportPreviewDialog` 流程。

**Tech Stack:** 純瀏覽器 JavaScript，無框架。Google Maps Places API（選用），Nominatim geocoding API（免費）。

---

## 檔案異動總覽

| 檔案 | 說明 |
|------|------|
| `tour-planner.html` | 唯一修改目標：新增函數、修改渲染、修改 action handler |

---

## Task 1：Spot 資料模型 + 名稱變更清除座標

**Files:**
- Modify: `tour-planner.html:3333`（`addSpotAndFocus`）
- Modify: `tour-planner.html:3867`（`input` event 的 `spot-name` handler）
- Modify: `tour-planner.html:4010`（`blur` event 的 `spot-name` handler）

- [ ] **Step 1：修改 `addSpotAndFocus`，新增座標欄位預設值**

  找到第 3333 行：
  ```javascript
  if (day) day.spots.push({ id: genId(), name: '', stayDuration: 0, notes: '', category: null });
  ```
  改為：
  ```javascript
  if (day) day.spots.push({ id: genId(), name: '', stayDuration: 0, notes: '', category: null, lat: null, lng: null, resolvedAddress: null });
  ```

- [ ] **Step 2：`input` event handler — 名稱變更時清除座標**

  找到第 3867 行的 `spot-name` handler（在 `app.addEventListener('input', ...)` 區塊內）：
  ```javascript
        if (action === 'spot-name') {
          const spot = state.days.find(d => d.id === e.target.dataset.dayId)
            ?.spots.find(sp => sp.id === e.target.dataset.spotId);
          if (spot) { spot.name = e.target.value; save(); }
          return;
        }
  ```
  改為：
  ```javascript
        if (action === 'spot-name') {
          const spot = state.days.find(d => d.id === e.target.dataset.dayId)
            ?.spots.find(sp => sp.id === e.target.dataset.spotId);
          if (spot) {
            spot.name = e.target.value;
            spot.lat = null; spot.lng = null; spot.resolvedAddress = null;
            save();
          }
          return;
        }
  ```

- [ ] **Step 3：`blur` event handler — 名稱變更時清除座標並重繪**

  找到第 4010 行的 `spot-name` handler（在 `app.addEventListener('blur', ...)` 區塊內）：
  ```javascript
        if (action === 'spot-name') {
          const { spotId, dayId } = e.target.dataset;
          setState(s => {
            const spot = s.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
            if (spot) spot.name = e.target.value;
          });
          return;
        }
  ```
  改為：
  ```javascript
        if (action === 'spot-name') {
          const { spotId, dayId } = e.target.dataset;
          setState(s => {
            const spot = s.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
            if (spot) {
              spot.name = e.target.value;
              spot.lat = null; spot.lng = null; spot.resolvedAddress = null;
            }
          });
          return;
        }
  ```

- [ ] **Step 4：瀏覽器驗證資料模型**

  開啟 `tour-planner.html`，在 console 執行：
  ```javascript
  // 新增一個景點
  addSpotAndFocus(state.days[0].id);
  const spot = state.days[0].spots.at(-1);
  console.assert(spot.lat === null, 'lat 應為 null');
  console.assert(spot.lng === null, 'lng 應為 null');
  console.assert(spot.resolvedAddress === null, 'resolvedAddress 應為 null');
  console.log('Task 1 OK');
  ```

- [ ] **Step 5：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add lat/lng/resolvedAddress fields to spot model"
  ```

---

## Task 2：`nominatimGeocode` 回傳 `address` 欄位

**Files:**
- Modify: `tour-planner.html:3172`

`geocodeSpotByButton` 需要 display_name 顯示於卡片，需修改現有 `nominatimGeocode` 函數（現在只回傳 `lat/lng`）。

- [ ] **Step 1：修改 `nominatimGeocode` 回傳值加入 `address`**

  找到第 3172 行的 `nominatimGeocode` 函數：
  ```javascript
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
  改為：
  ```javascript
      async function nominatimGeocode(name) {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`;
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'tour-planner', 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' }
          });
          if (!res.ok) return null;
          const data = await res.json();
          if (!data.length) return null;
          return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), address: data[0].display_name };
        } catch { return null; }
      }
  ```

  說明：`geocodeForKML`、`geocodeCity` 等現有呼叫者只讀取 `lat/lng`，不受影響。

- [ ] **Step 2：瀏覽器驗證**

  在 console 執行：
  ```javascript
  nominatimGeocode('台北101').then(r => {
    console.assert(r.lat > 0, '應有 lat');
    console.assert(r.lng > 0, '應有 lng');
    console.assert(typeof r.address === 'string', '應有 address 字串');
    console.log('nominatimGeocode address:', r.address);
  });
  ```
  預期：印出包含地址的字串（如 `台北101, 信義路五段7號...`）。

- [ ] **Step 3：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add address field to nominatimGeocode return value"
  ```

---

## Task 3：`attachSpotAutocomplete` + `geocodeSpotByButton` 函數

**Files:**
- Modify: `tour-planner.html:1890`（在 `exportKML` 結尾後、`importJSON` 前插入）

- [ ] **Step 1：插入 `attachSpotAutocomplete`**

  在第 1890 行（`exportKML` 函數結尾的 `}` 後的空行）插入：

  ```javascript
    function attachSpotAutocomplete(el, spotId, dayId) {
      if (!window.google?.maps?.places) return;
      el._autocomplete = true;
      const ac = new google.maps.places.Autocomplete(el, { fields: ['geometry', 'formatted_address'] });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry?.location) return;
        setState(s => {
          const spot = s.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
          if (spot) {
            spot.lat = place.geometry.location.lat();
            spot.lng = place.geometry.location.lng();
            spot.resolvedAddress = place.formatted_address || null;
          }
        });
      });
    }
  ```

- [ ] **Step 2：插入 `geocodeSpotByButton`**

  緊接在 `attachSpotAutocomplete` 後插入：

  ```javascript
    async function geocodeSpotByButton(spotId, dayId) {
      const spot = state.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
      if (!spot || !spot.name?.trim()) return;
      const geo = await nominatimGeocode(spot.name.trim());
      setState(s => {
        const sp = s.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
        if (sp) {
          sp.lat = geo?.lat ?? null;
          sp.lng = geo?.lng ?? null;
          sp.resolvedAddress = geo?.address ?? null;
        }
      });
    }
  ```

- [ ] **Step 3：瀏覽器驗證 `geocodeSpotByButton`**

  在行程中加入景點「台北101」，在 console 執行：
  ```javascript
  const spot = state.days[0].spots.find(s => s.name === '台北101');
  geocodeSpotByButton(spot.id, state.days[0].id).then(() => {
    const updated = state.days[0].spots.find(s => s.id === spot.id);
    console.assert(updated.lat != null, '應有 lat');
    console.assert(updated.lng != null, '應有 lng');
    console.assert(updated.resolvedAddress, '應有 resolvedAddress');
    console.log('geocodeSpotByButton OK:', updated.lat, updated.lng, updated.resolvedAddress);
  });
  ```

- [ ] **Step 4：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add attachSpotAutocomplete and geocodeSpotByButton"
  ```

---

## Task 4：`focusin` 事件監聽（Places Autocomplete）

**Files:**
- Modify: `tour-planner.html:3342`（`attachEvents` 函數末尾前插入）

- [ ] **Step 1：在 `attachEvents` 末尾（L4203 後、L4204 `}` 前）插入 focusin 監聽**

  找到第 4203 行（keyboard redo handler 最後一行）：
  ```javascript
        if (mod && e.shiftKey && e.key === 'z') { e.preventDefault(); redo(); }
      });
    }
  ```
  在 `});` 與 `}` 之間（即 `});` 後、`}` 前）插入：

  ```javascript
      // Places Autocomplete：首次 focus .spot-name 時懶加載 attach
      document.addEventListener('focusin', e => {
        const key = state.settings.googleMapsApiKey;
        if (!key || key === 'NONE') return;
        if (!e.target.classList.contains('spot-name')) return;
        if (e.target._autocomplete) return;
        const { spotId, dayId } = e.target.dataset;
        if (!spotId || !dayId) return;
        loadGoogleMapsAPI(key).then(() => attachSpotAutocomplete(e.target, spotId, dayId));
      });
  ```

- [ ] **Step 3：瀏覽器驗證（需有 Google Maps API key）**

  在設定面板填入有效的 Google Maps API key，在行程中加入一個景點，點擊景點名稱輸入框。預期：Google 地點建議下拉清單出現。選取後，在 console 執行：
  ```javascript
  const spot = state.days[0].spots[0];
  console.log('lat:', spot.lat, 'lng:', spot.lng, 'address:', spot.resolvedAddress);
  ```
  預期：三個欄位均非 null。

  若無 API key，此步驟跳過，改在 Task 5 驗證 Nominatim 路徑。

- [ ] **Step 4：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: attach Places Autocomplete on spot-name focus when API key set"
  ```

---

## Task 5：Action handlers — geocode-spot / focus-spot-autocomplete / open-spot-map

**Files:**
- Modify: `tour-planner.html:3627`（click action handler，在 `export-kml` 分支後插入）

- [ ] **Step 1：插入三個新 action 分支**

  找到第 3627 行：
  ```javascript
        if (action === 'export-kml')      { localMenuOpen = false; render(); exportKML(); return; }
  ```
  在其後插入：
  ```javascript
        if (action === 'geocode-spot') {
          const { spotId, dayId } = el.dataset;
          el.disabled = true; el.textContent = '…';
          geocodeSpotByButton(spotId, dayId);
          return;
        }
        if (action === 'focus-spot-autocomplete') {
          const { spotId, dayId } = el.dataset;
          const input = document.querySelector(`.spot-name[data-spot-id="${spotId}"]`);
          input?.focus();
          return;
        }
        if (action === 'open-spot-map') {
          const { spotId, dayId } = el.dataset;
          const spot = state.days.find(d => d.id === dayId)?.spots.find(sp => sp.id === spotId);
          if (!spot) return;
          const url = (spot.lat != null)
            ? `https://maps.google.com/?q=${spot.lat},${spot.lng}`
            : `https://maps.google.com/?q=${encodeURIComponent(spot.name)}`;
          window.open(url, '_blank', 'noopener');
          return;
        }
  ```

- [ ] **Step 2：瀏覽器驗證 `geocode-spot`**

  確認景點卡片上的 🔍 按鈕可見（需先完成 Task 6 的 renderSpotCard 修改）。點擊 🔍 後景點應獲得座標，狀態圖示從 🔴 變為 🟢。

  在 console 執行：
  ```javascript
  // 手動觸發 action（模擬按鈕點擊）
  const spot = state.days[0].spots[0];
  geocodeSpotByButton(spot.id, state.days[0].id).then(() => {
    console.log('座標:', state.days[0].spots[0].lat, state.days[0].spots[0].lng);
  });
  ```

- [ ] **Step 3：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add geocode-spot, focus-spot-autocomplete, open-spot-map action handlers"
  ```

---

## Task 6：`renderSpotCard` — 🔍 按鈕、狀態圖示、地址小字

**Files:**
- Modify: `tour-planner.html:2245`（`renderSpotCard` 函數）

- [ ] **Step 1：在 `renderSpotCard` 開頭加入 geocode 相關計算**

  找到第 2245 行的 `renderSpotCard` 函數，在現有的 `hasName`、`navUrl` 等計算之後（約 L2260 `return \`` 之前），插入：

  ```javascript
      const hasCoords = spot.lat != null && spot.lng != null;
      const hasKey = state.settings.googleMapsApiKey && state.settings.googleMapsApiKey !== 'NONE';
      const geocodeAction = hasKey ? 'focus-spot-autocomplete' : 'geocode-spot';
      const statusIcon = hasName
        ? (hasCoords ? '🟢' : '🔴')
        : '';
  ```

- [ ] **Step 2：修改 `spot-row` div，加入 🔍 按鈕與狀態圖示**

  找到 `renderSpotCard` 的 return 字串中的 `<div class="spot-row">` 區塊（約 L2271）：
  ```html
              <div class="spot-row">
                <span class="drag-handle" title="拖拉排序">⠿</span>
                <button class="spot-cat-btn" ${catBtnStyle}
                  data-action="open-cat-picker"
                  data-spot-id="${spot.id}" data-day-id="${dayId}"
                  title="選擇分類">${catBtnEmoji}</button>
                <input class="spot-name" value="${escHtml(spot.name)}" placeholder="景點名稱"
                  data-action="spot-name" data-spot-id="${spot.id}" data-day-id="${dayId}">
                ${stayHtml}
                <a class="btn-accent" ${navAttrs}>🗺 導航</a>
  ```
  改為：
  ```html
              <div class="spot-row">
                <span class="drag-handle" title="拖拉排序">⠿</span>
                <button class="spot-cat-btn" ${catBtnStyle}
                  data-action="open-cat-picker"
                  data-spot-id="${spot.id}" data-day-id="${dayId}"
                  title="選擇分類">${catBtnEmoji}</button>
                ${hasName ? `<button class="btn-ghost"
                  data-action="${geocodeAction}"
                  data-spot-id="${spot.id}" data-day-id="${dayId}"
                  title="${hasKey ? '以 Google Maps 搜尋座標' : '以 Nominatim 查詢座標'}"
                  style="font-size:13px;padding:2px 6px">🔍</button>` : ''}
                <input class="spot-name" value="${escHtml(spot.name)}" placeholder="景點名稱"
                  data-action="spot-name" data-spot-id="${spot.id}" data-day-id="${dayId}">
                ${stayHtml}
                <a class="btn-accent" ${navAttrs}>🗺 導航</a>
  ```

- [ ] **Step 3：在 `spot-row` 關閉 div 後，加入狀態圖示與地址小字**

  找到 `renderSpotCard` return 字串中 `<div class="spot-row">` 區塊的結尾 `</div>`（在刪除按鈕 ✕ 之後），加入：

  在 `</div>` 後（`.spot-row` 的結尾 div）、`<input class="spot-notes"` 之前插入：
  ```html
              ${hasName ? `<div style="display:flex;align-items:center;gap:6px;padding:0 4px 2px">
                <button data-action="open-spot-map"
                  data-spot-id="${spot.id}" data-day-id="${dayId}"
                  style="background:none;border:none;cursor:pointer;font-size:13px;padding:0;line-height:1"
                  title="${hasCoords ? '在 Google Maps 查看此座標' : '在 Google Maps 搜尋此名稱'}">${statusIcon}</button>
                ${spot.resolvedAddress ? `<span style="font-size:11px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px">${escHtml(spot.resolvedAddress)}</span>` : ''}
              </div>` : ''}
  ```

- [ ] **Step 4：瀏覽器驗證 UI**

  1. 開啟 `tour-planner.html`，確認有名稱的景點卡片出現 🔍 按鈕
  2. 無名稱景點（placeholder 顯示「景點名稱」）：🔍 按鈕不顯示
  3. 點 🔍 按鈕（無 key 環境）：呼叫 Nominatim，完成後卡片顯示 🟢 + 地址小字
  4. 點 🟢/🔴 圖示：新分頁開啟 Google Maps
  5. 修改景點名稱後 blur：狀態圖示回到 🔴、地址小字消失

- [ ] **Step 5：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add geocode button, status icon, and resolved address to spot card"
  ```

---

## Task 7：`buildCoordMap` — 共用座標彙整函數

**Files:**
- Modify: `tour-planner.html:1890`（在 `geocodeSpotByButton` 後插入）

- [ ] **Step 1：插入 `buildCoordMap`**

  緊接在 `geocodeSpotByButton` 函數後插入：

  ```javascript
    async function buildCoordMap() {
      // 第一步：收集 spot 已儲存的座標
      const coordMap = {};
      state.days.forEach(day => {
        day.spots.forEach(spot => {
          if (spot.name?.trim() && spot.lat != null)
            coordMap[spot.name.trim()] = { lat: spot.lat, lng: spot.lng };
        });
      });

      // 第二步：找出還需要 geocode 的名稱
      const needsGeocode = new Set();
      state.days.forEach(day => {
        if (day.startHotelName?.trim() && !coordMap[day.startHotelName.trim()])
          needsGeocode.add(day.startHotelName.trim());
        if (day.endHotelName?.trim() && !coordMap[day.endHotelName.trim()])
          needsGeocode.add(day.endHotelName.trim());
        day.spots.forEach(spot => {
          if (spot.name?.trim() && !coordMap[spot.name.trim()])
            needsGeocode.add(spot.name.trim());
        });
      });

      // 第三步：批次 Nominatim geocode 缺失名稱
      const names = [...needsGeocode];
      if (names.length > 0) {
        showKmlProgress(0, names.length);
        try {
          for (let i = 0; i < names.length; i++) {
            showKmlProgress(i + 1, names.length);
            const geo = await geocodeForKML(names[i]);
            if (geo) coordMap[names[i]] = { lat: geo.lat, lng: geo.lng };
          }
        } finally {
          hideKmlProgress();
        }
      }

      return coordMap;
    }
  ```

- [ ] **Step 2：瀏覽器驗證**

  在行程中加入「台北101」（未查座標）與「故宮博物院」（已查座標），然後在 console 執行：
  ```javascript
  // 手動設定一個景點座標
  state.days[0].spots[0].lat = 25.033;
  state.days[0].spots[0].lng = 121.565;
  state.days[0].spots[0].name = '台北101';
  save();

  buildCoordMap().then(map => {
    console.log('台北101 from stored:', map['台北101']); // 應為 {lat:25.033, lng:121.565}
    console.log('keys:', Object.keys(map));
  });
  ```
  預期：台北101 直接用儲存值（無網路請求），其他景點透過 Nominatim 查詢。

- [ ] **Step 3：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add buildCoordMap shared helper using stored coords + Nominatim fallback"
  ```

---

## Task 8：`showExportPreviewDialog` — 共用匯出確認 Dialog

**Files:**
- Modify: `tour-planner.html`（緊接在 `buildCoordMap` 後插入）

- [ ] **Step 1：插入 `showExportPreviewDialog`**

  緊接在 `buildCoordMap` 函數後插入：

  ```javascript
    function showExportPreviewDialog(coordMap, onConfirm) {
      // 收集所有節點（飯店 + 景點）
      const items = [];
      state.days.forEach((day, i) => {
        const dayLabel = `第${i + 1}天`;
        if (day.startHotelName?.trim())
          items.push({ name: day.startHotelName.trim(), dayLabel });
        day.spots.forEach(spot => {
          if (spot.name?.trim()) items.push({ name: spot.name.trim(), dayLabel });
        });
        if (day.endHotelName?.trim())
          items.push({ name: day.endHotelName.trim(), dayLabel });
      });

      const rowsHtml = items.length === 0
        ? '<div style="color:var(--text-muted);text-align:center;padding:12px 0">（無景點）</div>'
        : items.map(item => {
            const hasCoord = !!coordMap[item.name];
            const icon = hasCoord ? '🟢' : '🔴';
            const addrHtml = hasCoord ? '' :
              '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">（未找到座標）</div>';
            return `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:16px;line-height:1.4">${icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(item.name)}</div>
                ${addrHtml}
              </div>
              <div style="font-size:12px;color:var(--text-muted);white-space:nowrap">${escHtml(item.dayLabel)}</div>
            </div>`;
          }).join('');

      const hasRed = items.some(item => !coordMap[item.name]);
      const infoHtml = hasRed
        ? '<div style="font-size:12px;color:var(--text-muted);margin-top:12px">ℹ️ 紅色地點將略過定位，其餘正常匯出</div>'
        : '';

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center';

      const panel = document.createElement('div');
      panel.style.cssText = [
        'background:var(--surface)', 'border:1px solid var(--border)',
        'border-radius:10px', 'padding:20px 24px',
        'width:min(480px,90vw)', 'max-height:80vh',
        'display:flex', 'flex-direction:column',
        'box-shadow:0 8px 32px rgba(0,0,0,0.35)',
        'color:var(--text)',
      ].join(';');

      panel.innerHTML = `
        <div style="font-size:15px;font-weight:600;margin-bottom:12px">確認地點座標</div>
        <div style="overflow-y:auto;flex:1;margin-bottom:12px">${rowsHtml}</div>
        ${infoHtml}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button id="export-preview-cancel" style="padding:7px 16px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text);font-size:13px;cursor:pointer">取消</button>
          <button id="export-preview-confirm" style="padding:7px 16px;border-radius:6px;border:none;background:var(--color-accent,#2563eb);color:#fff;font-size:13px;cursor:pointer;font-weight:500">確認匯出</button>
        </div>`;

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      const close = () => overlay.remove();
      panel.querySelector('#export-preview-cancel').addEventListener('click', close);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
      panel.querySelector('#export-preview-confirm').addEventListener('click', () => {
        close();
        onConfirm();
      });
    }
  ```

- [ ] **Step 2：瀏覽器驗證**

  在 console 執行：
  ```javascript
  showExportPreviewDialog(
    { '台北101': { lat: 25.033, lng: 121.565 } },
    () => console.log('confirmed!')
  );
  ```
  預期：
  - Dialog 出現在畫面中央
  - 台北101 顯示 🟢
  - 其他景點顯示 🔴 + 「（未找到座標）」
  - 點「取消」：Dialog 消失
  - 點「確認匯出」：console 印出 `confirmed!`，Dialog 消失

- [ ] **Step 3：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add showExportPreviewDialog shared export confirmation UI"
  ```

---

## Task 9：重構 `exportKML` 使用儲存座標 + Dialog

**Files:**
- Modify: `tour-planner.html:1855`（`exportKML` 函數）

- [ ] **Step 1：重寫 `exportKML`**

  找到第 1855 行的 `exportKML` 函數，**整個替換**：

  ```javascript
    async function exportKML() {
      const coordMap = await buildCoordMap();
      showExportPreviewDialog(coordMap, () => {
        const kml  = generateKML(state.days, coordMap);
        const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${state.tripName}-${new Date().toISOString().slice(0, 10)}.kml`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      });
    }
  ```

- [ ] **Step 2：瀏覽器驗證 KML 匯出流程**

  1. 建立含 2 天、各 2 個景點的行程（部分已有座標，部分未查）
  2. 點 **💾 本地 ▾ → 🗺 匯出地圖 (.kml)**
  3. 確認進度 overlay 出現（針對未有座標的景點）
  4. 確認 Dialog 出現，顯示所有地點與 🟢/🔴 狀態
  5. 點「確認匯出」：`.kml` 檔案下載，用文字編輯器確認 XML 格式正確

- [ ] **Step 3：commit**

  ```bash
  git add tour-planner.html
  git commit -m "refactor: exportKML uses stored coords + buildCoordMap + preview dialog"
  ```

---

## Task 10：`generateCSV` + `exportCSV`

**Files:**
- Modify: `tour-planner.html`（在 `showExportPreviewDialog` 後插入）

- [ ] **Step 1：插入 `generateCSV`**

  緊接在 `showExportPreviewDialog` 後插入：

  ```javascript
    function generateCSV(days, coordMap) {
      const BOM = '﻿';
      const header = ['景點名稱', '天', '抵達時間', '離開時間', '停留時間(分)', '備註', '緯度', '經度'].join(',');
      const rows = [];
      days.forEach((day, i) => {
        const slots = computeTimeline(day);
        const dayLabel = `第${i + 1}天`;
        day.spots.forEach(spot => {
          if (!spot.name?.trim()) return;
          const sl = slots[spot.id] || {};
          const coord = coordMap[spot.name.trim()];
          const csvRow = [
            spot.name.trim(),
            dayLabel,
            sl.start || '',
            sl.end   || '',
            spot.stayDuration ?? '',
            (spot.notes || '').replace(/"/g, '""'),
            coord?.lat ?? '',
            coord?.lng ?? '',
          ].map(v => `"${v}"`).join(',');
          rows.push(csvRow);
        });
      });
      return BOM + header + '\n' + rows.join('\n');
    }
  ```

- [ ] **Step 2：插入 `exportCSV`**

  緊接在 `generateCSV` 後插入：

  ```javascript
    async function exportCSV() {
      const coordMap = await buildCoordMap();
      showExportPreviewDialog(coordMap, () => {
        const csv  = generateCSV(state.days, coordMap);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${state.tripName}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      });
    }
  ```

- [ ] **Step 3：瀏覽器驗證 CSV 內容**

  在 console 執行：
  ```javascript
  buildCoordMap().then(coordMap => {
    const csv = generateCSV(state.days, coordMap);
    console.log(csv);
    // 驗證 header
    console.assert(csv.includes('景點名稱'), '應有景點名稱欄');
    console.assert(csv.includes('緯度'), '應有緯度欄');
  });
  ```
  預期：印出含 BOM 的 CSV 字串，header 與資料行格式正確。

- [ ] **Step 4：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add generateCSV and exportCSV"
  ```

---

## Task 11：UI 接線 — 下拉選單 CSV 按鈕 + action handler

**Files:**
- Modify: `tour-planner.html:2948`（export dropdown，KML 按鈕後）
- Modify: `tour-planner.html:3627`（action handler）

- [ ] **Step 1：在匯出下拉選單加入 CSV 按鈕**

  找到第 2948 行的 KML 按鈕：
  ```html
                    <button data-action="export-kml"
                      style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;
                             color:var(--text);font-size:13px;cursor:pointer">
                      🗺 匯出地圖 (.kml)
                    </button>
  ```
  在其後插入：
  ```html
                    <button data-action="export-csv"
                      style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;
                             color:var(--text);font-size:13px;cursor:pointer">
                      📊 匯出試算表 (.csv)
                    </button>
  ```

- [ ] **Step 2：在 action handler 加入 `export-csv` 分支**

  找到第 3627 行（現在含新的 geocode-spot 等分支之後）的 `export-kml` 分支：
  ```javascript
        if (action === 'export-kml')      { localMenuOpen = false; render(); exportKML(); return; }
  ```
  在其後插入：
  ```javascript
        if (action === 'export-csv')      { localMenuOpen = false; render(); exportCSV(); return; }
  ```

- [ ] **Step 3：瀏覽器完整流程測試**

  1. 點 **💾 本地 ▾**，確認選單出現「📊 匯出試算表 (.csv)」按鈕
  2. 點擊，確認進度 overlay（若有缺失座標）→ Dialog → 下載 `.csv`
  3. 用 Excel 或 Google Sheets 開啟 CSV，確認欄位正確、中文不亂碼（BOM 應已處理）

- [ ] **Step 4：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: wire export-csv button and action handler"
  ```

---

## Task 12：Help overlay + 最後更新

**Files:**
- Modify: `tour-planner.html:2829`（💾 本地 section）
- Modify: `tour-planner.html:2882`（最後更新）

- [ ] **Step 1：更新 💾 本地 section 標題列**

  找到第 2829 行：
  ```html
                <div class="help-item">• 點 <b>💾 本地 ▾</b> 展開選單，可選擇 <b>📤 匯出 JSON</b>、<b>📥 匯入 JSON</b>、<b>🗺 匯出地圖 (.kml)</b> 等功能</div>
  ```
  改為：
  ```html
                <div class="help-item">• 點 <b>💾 本地 ▾</b> 展開選單，可選擇 <b>📤 匯出 JSON</b>、<b>📥 匯入 JSON</b>、<b>🗺 匯出地圖 (.kml)</b>、<b>📊 匯出試算表 (.csv)</b> 等功能</div>
  ```

- [ ] **Step 2：在 KML 說明行後加入 CSV 與 🔍 說明**

  找到第 2834 行（KML 說明結尾的 `</div>`）：
  ```html
                <div class="help-item">• <b>匯出地圖 (.kml)</b>：下載 .kml 檔案，可匯入 <a href="https://mymaps.google.com" target="_blank" rel="noopener">Google My Maps</a>；每天為獨立圖層，包含景點 Pin 與路線折線。匯出時會自動查詢各景點座標（需連網）</div>
  ```
  在其後插入：
  ```html
                <div class="help-item">• <b>匯出試算表 (.csv)</b>：下載含景點名稱、時間、備註與座標的試算表，可用 Excel 或 Google Sheets 開啟</div>
                <div class="help-item">• 景點卡片上的 <b>🔍 按鈕</b>：點擊可查詢並永久儲存該景點的地理座標（有 Google Maps API key 時使用 Places 搜尋，否則使用 Nominatim）；座標儲存後匯出 KML／CSV 時定位更精準；更改景點名稱後座標會自動清除</div>
  ```

- [ ] **Step 3：更新「最後更新」欄位**

  找到第 2882 行：
  ```html
                <b style="color:var(--text)">最後更新</b>：新增匯出地圖 (.kml) 功能——支援將行程匯出為 KML 檔，可直接匯入 Google My Maps；每天為獨立圖層，包含景點 Pin 與路線折線（2026-07-14）
  ```
  改為：
  ```html
                <b style="color:var(--text)">最後更新</b>：新增景點座標儲存（🔍 查座標按鈕）、匯出前預覽確認 Dialog、匯出試算表 (.csv) 功能（2026-07-14）
  ```

- [ ] **Step 4：瀏覽器驗證**

  1. 點 **❓ 說明**，確認 💾 本地 section 出現 CSV 與 🔍 說明
  2. 確認「最後更新」顯示正確日期與描述

- [ ] **Step 5：commit**

  ```bash
  git add tour-planner.html
  git commit -m "docs: update help overlay with CSV export and geocode button info"
  ```

---

## 完整端對端測試清單

完成所有 Task 後，在瀏覽器執行完整驗收：

- [ ] 新增景點 → 景點物件含 `lat: null, lng: null, resolvedAddress: null`
- [ ] 無名稱景點：不顯示 🔍 按鈕與狀態圖示
- [ ] 有名稱景點：顯示 🔍 按鈕，狀態圖示 🔴
- [ ] 點 🔍（無 API key）→ Nominatim 查詢 → 🟢 + 地址小字顯示
- [ ] 點 🔍（有 API key）→ 聚焦 input → Places 下拉 → 選取 → 🟢 + 地址小字
- [ ] 修改景點名稱 → blur → 🔴 + 地址小字消失
- [ ] 點 🟢 → 新分頁開啟 `maps.google.com/?q=lat,lng`
- [ ] 點 🔴 → 新分頁開啟 `maps.google.com/?q=景點名稱`
- [ ] 匯出 KML → 進度 overlay → Dialog → 確認 → .kml 下載
- [ ] 匯出 CSV → 進度 overlay → Dialog → 確認 → .csv 下載，用 Sheets 驗證欄位
- [ ] Dialog「取消」→ 不下載
- [ ] Help 說明頁面包含 CSV 與 🔍 說明
