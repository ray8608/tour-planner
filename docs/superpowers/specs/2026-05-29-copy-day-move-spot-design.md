# 天數複製 & 景點跨天移動 設計規格

**日期：** 2026-05-29
**功能：** 複製整天行程、景點移動或複製到其他天

---

## 1. 概述

### 功能目的

使用者規劃多天行程時常有兩種需求：

1. **複製整天**：某天的結構（飯店、出發時間、景點順序）想套用到另一天，只需小幅調整，避免從零開始重建。
2. **景點跨天移動**：行程調整時需要把某個景點從第一天移到第三天，或複製到多天共用。

目前拖曳排序僅限同一天內，跨天操作只能手動刪除再重建。

### 使用情境

- 東京五天行程，第2天與第3天出發飯店相同、結構類似 → 複製第2天再修改
- 計劃中把「築地市場」從第1天移到第2天
- 「淺草寺」兩天都想去 → 複製景點到兩天

---

## 2. UI 設計

### 2-1. 複製整天

#### 操作入口

在 `renderDayHeader()` 的 `day-content-header` 尾端，緊接在刪除按鈕之前，新增複製按鈕：

```
[第1天名稱輸入框]  [6/15(日)]  [⎘ 複製]  [🗑 刪除]
```

按鈕 HTML 模式（與現有 `btn-ghost` 風格一致）：

```html
<button class="btn-ghost" data-action="copy-day"
  data-day-id="${day.id}" title="複製此天">⎘</button>
```

Layout C 的 `day-section-header` 同樣插入此按鈕（`renderDeleteDayBtn` 旁邊）。

#### 互動流程

1. 點「⎘」按鈕
2. 立即執行，無需確認對話框
3. 新天插入於原天**之後**
4. 新天自動成為 activeDayId（Layout A/B 切換到新天頁籤）
5. 新天標籤為「第N天（複製）」，N 為新天在 days 陣列中的序號

#### 複製內容

| 欄位 | 複製行為 |
|------|---------|
| `label` | `第N天（複製）` |
| `startTime` | 複製原值 |
| `startHotelName` | 複製原值 |
| `endHotelName` | 複製原值 |
| `spots[]` | 深複製，每個 spot 產生**新 id**（`genId()`） |
| `routes` | 複製原天涉及的路線（見 2-1 資料層說明） |

---

### 2-2. 景點跨天移動（快捷選單）

#### 問題

現有拖曳可跨天（`moveSpotToDay` 已支援），但 Layout A 只顯示一天，看不到其他天的 drop zone；Layout B 同樣如此。視覺上無從操作。

#### 操作入口

在每張景點卡片的 `spot-row` 最右側，刪除按鈕（✕）左邊，新增一個「→」選單觸發按鈕：

```
[⠿]  [景點名稱輸入]  [時長]  [🗺 導航]  [→]  [✕]
```

按鈕：

```html
<button class="btn-ghost spot-move-btn"
  data-action="toggle-spot-menu"
  data-spot-id="${spot.id}" data-day-id="${dayId}"
  title="移動／複製到其他天">→</button>
```

#### 下拉選單（spot context menu）

點「→」後，在按鈕下方展開一個小型浮層選單，列出「移動到」與「複製到」兩區：

```
┌────────────────────────────┐
│ 移動到                      │
│   第1天                     │  ← 若本身在第1天則顯示為灰色禁用
│   第2天  ← 目前所在天        │  ← 不顯示，或顯示灰色
│   第3天                     │
│ ──────────────────────────  │
│ 複製到                      │
│   第1天                     │
│   第2天（目前）              │  ← 允許複製到同天
│   第3天                     │
└────────────────────────────┘
```

規則：
- 「移動到」區：本天選項灰色禁用（`disabled`）
- 「複製到」區：所有天可選，包含本天（在本天尾部新增一份複本）
- 若只有一天，整個選單顯示「目前只有一天，新增天數後即可跨天移動」提示文字
- 點任一選項立即執行，關閉選單
- 點選單外（透明背景層）關閉選單

#### 選單定位

使用 `position: absolute` 相對於 `.spot-card` 容器，配合 `z-index: 60`（高於 day-dropdown 的 50）。

---

### 2-3. 行動裝置考量

- 「⎘ 複製天」按鈕與「→ 移動景點」按鈕均為觸控友善目標（最小 `32px × 32px`）
- spot context menu 寬度固定 `160px`，足以顯示「移動到」「複製到」標題與天數列表
- 手機版 Layout B 使用 dropdown 切換天，複製後自動切換到新天，dropdown 也需顯示新天

---

## 3. 資料結構變更

### 無需新增頂層欄位

所有新操作均在現有 `state.days[]` 與 `state.routes{}` 結構內操作。

### 複製天時的路線處理

原天景點之間的路線 key 格式為 `spotId→spotId`（舊 id）。複製時所有 spot 取得新 id，因此路線需要重新映射：

```
原路線 key: oldSpot1.id → oldSpot2.id
新路線 key: newSpot1.id → newSpot2.id  (value 結構相同)
```

飯店相關路線 key（`hs_{dayId}` / `he_{dayId}`）使用新天的 dayId 重建，值從原天對應路線複製。

### `shareState` 無需變更

spot context menu 的開關狀態使用現有 `shareState` 物件新增兩個欄位：

```js
shareState.spotMenuOpen   // boolean，預設 false
shareState.spotMenuSpotId // string | null，目前展開選單的 spot id
```

---

## 4. 行為規範

### 複製天

| 情境 | 行為 |
|------|------|
| 正常複製 | 新天插入原天後，立即 activate |
| 原天無景點 | 複製空天（含飯店與出發時間） |
| 只有一天 | 允許複製（複製後變兩天） |
| 複製後總天數上限 | 無上限限制 |
| Layout C | 不切換 activeDayId（C 為全捲動），只插入新天區塊 |

### 移動景點（跨天）

| 情境 | 行為 |
|------|------|
| 移動到目標天 | 景點從原天移除，附加到目標天尾部；原天涉及的路線清除（呼叫現有 `clearRoutesForSpot`） |
| 移動到自身天 | 按鈕灰色禁用，不可點擊 |
| 複製到任意天 | 原天景點不動；目標天尾部新增 spot（新 id、相同 name/notes/stayDuration）；不複製路線 |
| 複製到自身天 | 允許，在同天尾部新增複本 |
| 目標天不存在 | 防禦性檢查，靜默忽略（不應發生） |

### 路線清除策略

移動景點時呼叫現有 `clearRoutesForSpot(s, spotId)`，行為已正確（刪除所有含該 spotId 的路線 key）。複製景點時不需處理路線（新 spot id 在 routes 中無對應記錄，即空路線）。

### 選單關閉時機

- 點選單外透明背景層
- 點任何「移動到」或「複製到」選項執行後
- `render()` 重繪時（若 `shareState.spotMenuOpen` 為 false 則不渲染選單）
- 點同一景點的「→」按鈕再次點擊（toggle）

---

## 5. 實作要點

### 5-1. 複製整天：`copyDay(dayId)`

新增函式，在 `moveSpotToDay` 下方實作：

```js
function copyDay(dayId) {
  setState(s => {
    const srcIdx = s.days.findIndex(d => d.id === dayId);
    if (srcIdx === -1) return;
    const src = s.days[srcIdx];

    // 建立 old→new spot id 映射
    const idMap = {};
    const newSpots = src.spots.map(sp => {
      const newId = genId();
      idMap[sp.id] = newId;
      return { ...sp, id: newId };
    });

    const newDayId = genId();
    const newDay = {
      id:              newDayId,
      label:           `第${s.days.length + 1}天（複製）`,
      startTime:       src.startTime,
      startHotelName:  src.startHotelName,
      endHotelName:    src.endHotelName,
      spots:           newSpots,
    };

    // 複製路線（remapping ids）
    const srcHs = hotelStartId(dayId);
    const srcHe = hotelEndId(dayId);
    const newHs = hotelStartId(newDayId);
    const newHe = hotelEndId(newDayId);
    const remapId = id => {
      if (id === srcHs) return newHs;
      if (id === srcHe) return newHe;
      return idMap[id] ?? id;
    };

    Object.entries(s.routes).forEach(([k, v]) => {
      const [fromId, toId] = k.split('→');
      // 只複製與原天相關的路線
      const involvedIds = [srcHs, srcHe, ...src.spots.map(sp => sp.id)];
      if (involvedIds.includes(fromId) || involvedIds.includes(toId)) {
        const newKey = routeKey(remapId(fromId), remapId(toId));
        s.routes[newKey] = { ...v };
      }
    });

    s.days.splice(srcIdx + 1, 0, newDay);
    s.activeDayId = newDayId;
  });
}
```

### 5-2. 複製景點：`copySpotToDay(spotId, fromDayId, toDayId)`

```js
function copySpotToDay(spotId, fromDayId, toDayId) {
  setState(s => {
    const fromDay = s.days.find(d => d.id === fromDayId);
    const toDay   = s.days.find(d => d.id === toDayId);
    if (!fromDay || !toDay) return;
    const src = fromDay.spots.find(sp => sp.id === spotId);
    if (!src) return;
    toDay.spots.push({ ...src, id: genId() });
    // 不複製路線；新 spot 與鄰居路線預設空白
  });
}
```

### 5-3. 修改 `renderDayHeader(day)`

在 `renderDeleteDayBtn(day)` 之前插入複製按鈕：

```js
function renderDayHeader(day) {
  const dayIndex = state.days.findIndex(d => d.id === day.id);
  const dateStr  = getDayDate(dayIndex);
  return `
    <div class="day-content-header">
      <input class="day-name-input" value="${escHtml(day.label)}"
        data-action="day-name" data-day-id="${day.id}">
      ${dateStr ? `<span style="font-size:12px;color:var(--text-muted)">${escHtml(dateStr)}</span>` : ''}
      <button class="btn-ghost" data-action="copy-day"
        data-day-id="${day.id}" title="複製此天">⎘</button>
      ${renderDeleteDayBtn(day)}
    </div>`;
}
```

Layout C 的 `day-section-header`（在 `renderLayoutC()` 內的 inline HTML）同步加入相同按鈕。

### 5-4. 修改 `renderSpotCard(spot, dayId, slot)`

在刪除按鈕 `✕` 前插入移動按鈕，並在卡片尾部條件渲染選單：

```js
// spot-row 尾端
<button class="btn-ghost spot-move-btn"
  data-action="toggle-spot-menu"
  data-spot-id="${spot.id}" data-day-id="${dayId}"
  title="移動／複製到其他天">→</button>
<button class="btn-ghost" data-action="delete-spot"
  data-spot-id="${spot.id}" data-day-id="${dayId}" title="刪除景點">✕</button>

// spot-card 底部，notes 輸入框之後
${shareState.spotMenuSpotId === spot.id ? renderSpotMenu(spot.id, dayId) : ''}
```

### 5-5. 新增 `renderSpotMenu(spotId, dayId)`

```js
function renderSpotMenu(spotId, dayId) {
  if (state.days.length === 1) {
    return `
      <div class="spot-menu-backdrop" data-action="close-spot-menu"></div>
      <div class="spot-menu">
        <div class="spot-menu-empty">目前只有一天，新增天數後即可跨天移動</div>
      </div>`;
  }

  const moveTo = state.days.map(d => {
    const disabled = d.id === dayId;
    return `<button class="spot-menu-item ${disabled ? 'disabled' : ''}"
      ${disabled ? 'disabled' : `data-action="move-spot-to-day" data-spot-id="${spotId}" data-from-day-id="${dayId}" data-to-day-id="${d.id}"`}>
      ${escHtml(d.label)}${disabled ? '（目前）' : ''}
    </button>`;
  }).join('');

  const copyTo = state.days.map(d => `
    <button class="spot-menu-item"
      data-action="copy-spot-to-day"
      data-spot-id="${spotId}"
      data-from-day-id="${dayId}"
      data-to-day-id="${d.id}">
      ${escHtml(d.label)}${d.id === dayId ? '（目前）' : ''}
    </button>`).join('');

  return `
    <div class="spot-menu-backdrop" data-action="close-spot-menu"></div>
    <div class="spot-menu">
      <div class="spot-menu-section-title">移動到</div>
      ${moveTo}
      <div class="spot-menu-divider"></div>
      <div class="spot-menu-section-title">複製到</div>
      ${copyTo}
    </div>`;
}
```

### 5-6. 事件處理器（新增至 click handler）

```js
if (action === 'copy-day') {
  copyDay(el.dataset.dayId);
  return;
}

if (action === 'toggle-spot-menu') {
  const { spotId } = el.dataset;
  const isOpen = shareState.spotMenuOpen && shareState.spotMenuSpotId === spotId;
  setShareState({ spotMenuOpen: !isOpen, spotMenuSpotId: isOpen ? null : spotId });
  return;
}

if (action === 'close-spot-menu') {
  setShareState({ spotMenuOpen: false, spotMenuSpotId: null });
  return;
}

if (action === 'move-spot-to-day') {
  const { spotId, fromDayId, toDayId } = el.dataset;
  setShareState({ spotMenuOpen: false, spotMenuSpotId: null });
  moveSpotToDay(spotId, fromDayId, toDayId);
  return;
}

if (action === 'copy-spot-to-day') {
  const { spotId, fromDayId, toDayId } = el.dataset;
  setShareState({ spotMenuOpen: false, spotMenuSpotId: null });
  copySpotToDay(spotId, fromDayId, toDayId);
  return;
}
```

### 5-7. CSS 新增（加在現有 `.day-dropdown-*` 區塊附近）

```css
/* Spot context menu */
.spot-menu-backdrop {
  position: fixed; inset: 0; z-index: 59; background: transparent;
}
.spot-menu {
  position: absolute; right: 0; top: calc(100% + 4px);
  z-index: 60; width: 160px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  padding: 4px 0; overflow: hidden;
}
.spot-menu-section-title {
  font-size: 10px; color: var(--text-muted);
  padding: 6px 12px 2px; text-transform: uppercase; letter-spacing: 0.04em;
}
.spot-menu-item {
  display: block; width: 100%; text-align: left;
  padding: 6px 12px; font-size: 13px;
  background: none; border: none; color: var(--text); cursor: pointer;
}
.spot-menu-item:hover { background: var(--accent-bg); color: var(--accent); }
.spot-menu-item.disabled { color: var(--text-muted); cursor: default; }
.spot-menu-item.disabled:hover { background: none; color: var(--text-muted); }
.spot-menu-divider { height: 1px; background: var(--border); margin: 4px 0; }
.spot-menu-empty { font-size: 12px; color: var(--text-muted); padding: 8px 12px; }

/* spot-card 需要 position: relative 以定位選單 */
.spot-card { position: relative; /* 已有其他樣式，僅補此一行 */ }
```

### 5-8. 需修改的程式碼區域彙整

| 函式 / 區域 | 修改類型 |
|------------|---------|
| `renderDayHeader()` | 新增複製按鈕 |
| `renderLayoutC()` 內的 `day-section-header` | 新增複製按鈕 |
| `renderSpotCard()` | 新增「→」按鈕，底部加選單 |
| `renderSpotMenu()` | 新增函式 |
| `copyDay()` | 新增函式 |
| `copySpotToDay()` | 新增函式 |
| click handler（`app.addEventListener('click', ...)`）| 新增 5 個 action |
| CSS `<style>` 區塊 | 新增 `.spot-menu-*` 樣式，`.spot-card` 補 `position: relative` |
| `shareState` 初始值 | 補 `spotMenuOpen: false, spotMenuSpotId: null` |

### 5-9. shareState 初始值

找到 `shareState` 物件定義處，補上：

```js
let shareState = {
  // ... 現有欄位 ...
  spotMenuOpen:   false,
  spotMenuSpotId: null,
};
```
