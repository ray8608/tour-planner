# 行程統計摘要設計文件

**日期：** 2026-05-29
**功能：** 每日與全程統計數據，整合於現有 UI，無需額外頁面

---

## 概述

在現有的行程時間軸 UI 中，新增統計摘要資訊，讓使用者不需要手動換算就能快速掌握行程密度。統計分為兩層：每日統計（顯示在每天的底部）與全程統計（顯示在設定面板或頁首）。

計算完全基於已有的 `computeTimeline(day)` 回傳值，不需要額外的資料欄位，也不影響現有 state 結構。

---

## 統計數據清單

### 每日統計

以下數字均可從 `computeTimeline(day)` 的回傳 `slots` 與 `day.spots`、`state.routes` 推導。

| 統計項目 | 定義 | 計算方式 |
|---------|------|---------|
| 景點數量 | 當天 spots 陣列的長度 | `day.spots.length` |
| 總停留時間 | 所有景點 `stayDuration` 的總和 | `day.spots.reduce((s, sp) => s + (sp.stayDuration \|\| 0), 0)` |
| 總交通時間 | 所有 route 的 `recordedTime` 總和，含返回飯店那段 | 遍歷 `day.spots` 間所有 `routeKey` 對應的 `state.routes[rk].recordedTime`，共 `spots.length + 1` 段（含飯店出發與返回） |
| 行程總時長 | 出發時間到返回飯店的總分鐘數 | `slots[hotelEndId(day.id)].start` 換算為分鐘 − `day.startTime` 換算為分鐘；若跨午夜則加 1440 |
| 空閒時間 | 行程總時長 − 總停留時間 − 總交通時間 | `totalMins - stayTotal - transitTotal`；若無 startTime 或計算結果 < 0 則為 null |

**備註：**
- 「總交通時間」僅計入已填入 `recordedTime > 0` 的路線段；尚未填寫的段不納入。
- `hotelEndId` 的 `slots[he_*].start` 即最終返回時間（HH:MM 字串），轉換方式：`parseInt(hhmm.split(':')[0]) * 60 + parseInt(hhmm.split(':')[1])`。
- 空閒時間為負數時表示行程超時，顯示為警示（非錯誤）。

### 全程統計

| 統計項目 | 定義 | 計算方式 |
|---------|------|---------|
| 總天數 | `state.days.length` | 直接取值 |
| 總景點數 | 所有天的 `spots.length` 加總 | `state.days.reduce((s, d) => s + d.spots.length, 0)` |
| 步行次數 | 所有 route 中 `transport === 'walking'` 的數量 | 遍歷 `Object.values(state.routes)`，計 `transport === 'walking'` |
| 開車次數 | 所有 route 中 `transport === 'driving'` 的數量 | 同上，`transport === 'driving'` |
| 大眾運輸次數 | 所有 route 中 `transport === 'transit'` 的數量 | 同上，`transport === 'transit'` |
| 總旅程天數範圍 | 第一天與最後一天的日期（若有設 tripStartDate） | `state.tripStartDate` + `state.days.length - 1` |

**備註：**
- 交通方式計數以實際填入的 route key 為準（`state.routes` 的 key 數量），不含「尚未連結」的空段。
- 若 `state.routes` 為空物件，三項計數均顯示 0。

---

## UI 設計

### 方案 A：每日統計列（推薦）

**位置：** `renderDaySpots()` 底部、「＋ 新增景點」按鈕之前。

**外觀：**

```
┌─────────────────────────────────────────┐
│  3 個景點  ·  停留 4h 30m  ·  交通 1h 10m  ·  共 6h 30m  │
└─────────────────────────────────────────┘
```

- 單行橫向排列，以中間點（·）分隔
- 若無 startTime 或景點為 0，顯示「尚未設定出發時間」或不顯示
- 字體：`font-size: 12px; color: var(--text-muted)`
- 背景：`background: var(--surface2); border-radius: 6px; padding: 6px 10px`
- 空閒時間為負數時（行程超時），附加紅色小提示：`⚠ 超時 Xm`

**HTML 範例：**

```html
<div class="day-stats-bar">
  <span>3 個景點</span>
  <span class="day-stats-sep">·</span>
  <span>停留 4h 30m</span>
  <span class="day-stats-sep">·</span>
  <span>交通 1h 10m</span>
  <span class="day-stats-sep">·</span>
  <span>共 6h 30m</span>
  <!-- 超時時附加： -->
  <span class="day-stats-overtime">⚠ 超時 20m</span>
</div>
```

**全程統計：** 顯示在設定面板（`renderSettingsPanel()`）底部，用一個摺疊式小區塊，標題「📊 行程統計」，內容為表格或兩欄 grid。

```
📊 行程統計
─────────────────────
總天數         3 天
總景點數        11 個
🚗 開車         5 次
🚌 大眾         2 次
🚶 步行         3 次
```

---

### 方案 B：天數 tab / sidebar 顯示景點數徽章

**位置：** Layout A 的天數 tab、Layout B 的 sidebar 按鈕、Layout C 的 section header，各自在天數名稱後附加景點數。

**外觀（Layout A tab）：**

```
第1天  ③
```

- 以小圓角 badge 顯示景點數：`<span class="day-badge">3</span>`
- 景點為 0 時不顯示 badge
- 字體：`font-size: 10px; background: var(--accent); color: white; border-radius: 10px; padding: 1px 5px`

此方案與方案 A 可並行實作，互不衝突。方案 B 視覺干擾小，適合快速掃覽。

---

## 與 computeTimeline 的整合方式

`computeTimeline(day)` 已在 `renderDaySpots(day)` 中被呼叫，回傳 `slots`。只需在同一個函式中計算統計，不需要重複呼叫。

**新增輔助函式 `computeDayStats(day, slots)`：**

```javascript
function computeDayStats(day, slots) {
  const spotCount = day.spots.length;

  // 總停留時間（分鐘）
  const stayTotal = day.spots.reduce((s, sp) => s + (sp.stayDuration || 0), 0);

  // 總交通時間（分鐘）：包含 飯店→第1景點、各景點間、最後景點→飯店
  let transitTotal = 0;
  const allFromIds = day.spots.length > 0
    ? [hotelStartId(day.id), ...day.spots.slice(0, -1).map(s => s.id)]
    : [];
  const allToIds = day.spots.length > 0
    ? [...day.spots.map(s => s.id), hotelEndId(day.id)]
    : [];
  allFromIds.forEach((fromId, i) => {
    const rk = routeKey(fromId, allToIds[i]);
    transitTotal += (state.routes[rk] || {}).recordedTime || 0;
  });

  // 行程總時長（分鐘）：需要 startTime 且最終返回時間有值
  let totalMins = null;
  const endSlot = slots[hotelEndId(day.id)];
  if (day.startTime && endSlot && endSlot.start) {
    const toMins = t => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
    let diff = toMins(endSlot.start) - toMins(day.startTime);
    if (diff < 0) diff += 1440; // 跨午夜
    totalMins = diff;
  }

  // 空閒時間
  const freeMins = (totalMins !== null) ? (totalMins - stayTotal - transitTotal) : null;

  return { spotCount, stayTotal, transitTotal, totalMins, freeMins };
}
```

**在 `renderDaySpots(day)` 末尾調用：**

```javascript
function renderDaySpots(day) {
  const slots = computeTimeline(day);
  // ... 現有邏輯 ...

  const stats = computeDayStats(day, slots);
  html += renderDayStatsBar(stats);
  html += `<button class="btn-add" data-action="add-spot" data-day-id="${day.id}">＋ 新增景點</button>`;
  return html;
}
```

**全程統計輔助函式 `computeTripStats()`：**

```javascript
function computeTripStats() {
  const totalDays = state.days.length;
  const totalSpots = state.days.reduce((s, d) => s + d.spots.length, 0);
  const routes = Object.values(state.routes);
  const walkCount    = routes.filter(r => r.transport === 'walking').length;
  const driveCount   = routes.filter(r => r.transport === 'driving').length;
  const transitCount = routes.filter(r => r.transport === 'transit').length;
  return { totalDays, totalSpots, walkCount, driveCount, transitCount };
}
```

---

## 行為規範

### 無景點時

- `spotCount === 0`：`day-stats-bar` 不渲染（或顯示「尚未新增景點」灰色提示）
- `stayTotal === 0` 且 `transitTotal === 0`：總時長顯示「—」

### 無 startTime 時

- `totalMins` 為 null：不顯示「共 Xh Xm」，以「設定出發時間後顯示總時長」替代
- `freeMins` 為 null：不顯示空閒時間欄位

### 部分路線未填時

- 未填 `recordedTime`（= 0）的路線段不納入 `transitTotal`，也不影響顯示
- `totalMins` 依賴 `slots[hotelEndId].start`，若任一路線段或景點時長為 0，`cursor` 會變成 null，`endSlot.start` 也為 null，此時 `totalMins` 同樣為 null

### 超時（freeMins < 0）

- 顯示紅色 `⚠ 超時 Xm`，不阻止操作，僅提示

### 格式化

- 時間統一以「Xh Ym」格式（小時為 0 時省略，如「30m」；分鐘為 0 時省略，如「2h」）
- 景點數：「X 個景點」
- 全程交通方式計數為 0 時仍顯示（「0 次」），不隱藏

---

## 實作要點

1. **新增函式**（插入 `computeTimeline` 之後）
   - `computeDayStats(day, slots)` — 純計算，無副作用
   - `renderDayStatsBar(stats)` — 回傳 HTML 字串
   - `computeTripStats()` — 純計算，直接讀 `state`

2. **修改 `renderDaySpots(day)`**
   - 在 `html += renderHotelEndMarker(...)` 之後、`html += btn-add` 之前，插入 `renderDayStatsBar`

3. **修改 `renderSettingsPanel()`**
   - 在面板最底部新增一個 `<div class="settings-group">` 區塊，呼叫 `computeTripStats()` 渲染全程統計

4. **新增 CSS**（插入既有 `.route-connector` 區塊附近）
   ```css
   .day-stats-bar {
     display: flex;
     flex-wrap: wrap;
     gap: 4px 8px;
     align-items: center;
     font-size: 12px;
     color: var(--text-muted);
     background: var(--surface2);
     border-radius: 6px;
     padding: 6px 10px;
     margin: 4px 0 8px;
   }
   .day-stats-sep { opacity: 0.4; }
   .day-stats-overtime { color: var(--danger, #e05); font-size: 11px; }
   ```

5. **不需要**
   - 新增 state 欄位
   - 修改 localStorage schema
   - 修改事件處理器
   - 修改三種 Layout 函式（統計在 `renderDaySpots` 內部，三種 layout 共用）

6. **跨 Layout 一致性**
   - Layout A、B、C 都呼叫 `renderDaySpots(day)`，因此每日統計列在三種 layout 下自動出現，無需分別處理
