# 景點分類與顏色標籤設計規格

**日期：** 2026-05-29
**功能：** 每個景點可標記類別，類別對應顏色在時間軸與卡片上快速呈現視覺差異

---

## 1. 概述

使用者規劃行程時，常需要快速辨識一天之中餐廳、景點、購物等不同性質的安排是否平衡、交通節點是否合理。現有景點卡片一律相同外觀，無法一眼掌握行程組成。

本功能為每個 `spot` 增加一個可選的 `category` 欄位，並在景點卡片左側與時間軸 `time-badge` 旁以色條呈現。非破壞性：`category` 省略或為 `null` 時，外觀與現行完全相同。

---

## 2. 預設類別與顏色

共 7 個預設類別（含「無」）。顏色以彩度適中、明暗主題下對比足夠為準。

| id | 中文標籤 | Emoji | Dark 色條 | Light 色條 | Cream 色條 | Cyberpunk 色條 |
|----|---------|-------|-----------|-----------|-----------|---------------|
| `sightseeing` | 景點 | 🏛 | `#60a5fa` | `#2563eb` | `#8a6020` | `#00d4ff` |
| `food` | 餐廳 | 🍽 | `#f87171` | `#dc2626` | `#c04030` | `#ff2d9b` |
| `shopping` | 購物 | 🛍 | `#c084fc` | `#9333ea` | `#8050b0` | `#c87cff` |
| `transit` | 交通樞紐 | 🚉 | `#94a3b8` | `#64748b` | `#9a7a60` | `#3a5a7a` |
| `hotel` | 住宿 | 🏨 | `#34d399` | `#16a34a` | `#5a9a60` | `#00ff88` |
| `activity` | 體驗活動 | 🎯 | `#fb923c` | `#ea580c` | `#b05010` | `#ffaa00` |
| `other` | 其他 | 📌 | `#64748b` | `#94a3b8` | `#c0a080` | `#1a2050` |

「無分類」（`category: null`）不顯示色條，外觀與現行相同。

### CSS 變數方案

在 `:root` 及各主題 block 中新增 7 個變數（以 dark 為例）：

```css
:root {
  --cat-sightseeing: #60a5fa;
  --cat-food:        #f87171;
  --cat-shopping:    #c084fc;
  --cat-transit:     #94a3b8;
  --cat-hotel:       #34d399;
  --cat-activity:    #fb923c;
  --cat-other:       #64748b;
}
[data-theme="light"] {
  --cat-sightseeing: #2563eb;
  --cat-food:        #dc2626;
  --cat-shopping:    #9333ea;
  --cat-transit:     #64748b;
  --cat-hotel:       #16a34a;
  --cat-activity:    #ea580c;
  --cat-other:       #94a3b8;
}
[data-theme="cream"] {
  --cat-sightseeing: #8a6020;
  --cat-food:        #c04030;
  --cat-shopping:    #8050b0;
  --cat-transit:     #9a7a60;
  --cat-hotel:       #5a9a60;
  --cat-activity:    #b05010;
  --cat-other:       #c0a080;
}
[data-theme="cyberpunk"] {
  --cat-sightseeing: #00d4ff;
  --cat-food:        #ff2d9b;
  --cat-shopping:    #c87cff;
  --cat-transit:     #3a5a7a;
  --cat-hotel:       #00ff88;
  --cat-activity:    #ffaa00;
  --cat-other:       #1a2050;
}
```

JS 端維護一個常數 map，提供 emoji 與 label：

```js
const SPOT_CATEGORIES = [
  { id: 'sightseeing', label: '景點',     emoji: '🏛' },
  { id: 'food',        label: '餐廳',     emoji: '🍽' },
  { id: 'shopping',    label: '購物',     emoji: '🛍' },
  { id: 'transit',     label: '交通樞紐', emoji: '🚉' },
  { id: 'hotel',       label: '住宿',     emoji: '🏨' },
  { id: 'activity',    label: '體驗活動', emoji: '🎯' },
  { id: 'other',       label: '其他',     emoji: '📌' },
];
```

顏色從 CSS 變數讀取，不在 JS 中硬寫色碼：

```js
function getCatColor(categoryId) {
  if (!categoryId) return null;
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--cat-${categoryId}`)
    .trim() || null;
}
```

---

## 3. UI 設計

### 3.1 景點卡片

在 `.spot-card` 左邊加一條 3px 豎色條（`spot-cat-bar`）。無分類時不顯示（透明）。

```
┌── 3px 色條 ─────────────────────────────┐
│ ⠿  景點名稱         [停留時間]  🗺 導航 ✕ │
│     備註（選填）                          │
└──────────────────────────────────────────┘
```

現有 `.spot-card` 改為 `position: relative; overflow: hidden; padding-left: 15px`（增加 3px 色條寬 + 間距）。新增偽元素或子元素：

**方案：內嵌 `<span class="spot-cat-bar">` 子元素（優先，不依賴偽元素）**

```html
<div class="spot-card" ...>
  <span class="spot-cat-bar" style="background: var(--cat-food)"></span>
  <div class="spot-row">...</div>
  ...
</div>
```

```css
.spot-card {
  position: relative;
  padding-left: 15px;   /* 原 12px → 15px */
}
.spot-cat-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  border-radius: 6px 0 0 6px;
  background: transparent;
}
```

無分類時 `background: transparent`（或不輸出此元素），外觀與現行相同。

### 3.2 類別選擇入口（景點卡片內）

在 `.spot-row` 的拖拉把手（`⠿`）後、景點名稱輸入框前，加一個 emoji 按鈕作為類別選擇入口：

```
⠿  [🍽]  景點名稱 ...
```

- 無分類時顯示灰色 `📌`（或 `⊙`）
- 有分類時顯示對應 emoji，顏色與色條一致
- 點擊後展開類別選擇浮層（inline dropdown）

**浮層設計（`spot-cat-picker`）：**

```
┌─────────────────────────────┐
│ 🏛 景點   🍽 餐廳   🛍 購物 │
│ 🚉 交通   🏨 住宿   🎯 體驗 │
│ 📌 其他   ╳ 清除         │
└─────────────────────────────┘
```

- `position: absolute; z-index: 50`，定位於按鈕下方
- 每格寬約 64px，2 行 4 列排列
- 點選後設定分類並關閉浮層
- 「╳ 清除」按鈕清除分類（`category: null`）
- 點浮層外（透明背景層 `spot-cat-backdrop`）關閉

浮層透過 `shareState.catPickerOpenSpotId`（string | null）控制顯示，值為目前展開浮層的 `spot.id`。

### 3.3 時間軸呈現（`timeline-left`）

在 `time-badge` 左側或其下方加一個 3px 圓點（`cat-dot`），顏色與色條一致：

```
  ●         ←── 3px × 3px 圓點，顏色 = 分類色
  09:30      ←── 現有 time-badge
```

```css
.cat-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  display: block;
  margin: 0 auto 2px;
  background: transparent;
}
```

無分類或無 `time-badge` 時不輸出此元素。

---

## 4. 資料結構變更

### spot 物件新增欄位

```js
// 現有
{ id, name, stayDuration, notes }

// 新增後
{ id, name, stayDuration, notes, category: null }
```

| 欄位 | 型別 | 預設 | 說明 |
|------|------|------|------|
| `category` | `string \| null` | `null` | 分類 id，對應 `SPOT_CATEGORIES[].id`，null 表示無分類 |

### `migrateState` 補上預設值

現有 `migrateState(s)` 函數中，在處理 spot 欄位的迴圈加一行：

```js
if (spot.category === undefined) spot.category = null;
```

### `add-spot` 動作

新增景點時，`category` 預設 `null`：

```js
// 現有（第 2199 行附近）
genId(), name: '', stayDuration: 0, notes: ''

// 改為
genId(), name: '', stayDuration: 0, notes: '', category: null
```

### JSON 匯出格式（範例）

```json
{
  "id": "spot-abc123",
  "name": "淺草寺",
  "stayDuration": 90,
  "notes": "人潮多，早點去",
  "category": "sightseeing"
}
```

---

## 5. 自訂類別功能

**本版本不支援自訂類別。**

理由：
1. 7 個預設類別已涵蓋旅遊行程中 95% 的景點性質，自訂帶來的複雜度遠超實際效益。
2. 自訂類別需要持久化類別定義（新增至 `state.settings` 或全域），並在刪除自訂類別時處理已套用該類別的景點（設回 null 或遷移）。在單一 HTML 無框架的架構下，這會大幅增加 UI 複雜度與邊界情況。
3. `category` 欄位設計為 string id，未來若需擴充自訂類別只需新增 `state.settings.customCategories[]`，向後相容。

---

## 6. 實作要點

### 6.1 CSS（新增部分）

1. 在 4 個主題 block 各新增 7 個 `--cat-*` 變數（見第 2 節）。
2. 修改 `.spot-card`：`padding-left: 15px`（原 `12px`）、`position: relative`。
3. 新增 `.spot-cat-bar`（絕對定位，寬 3px）。
4. 新增 `.spot-cat-btn`（emoji 按鈕樣式，`background: none; border: none; cursor: pointer; font-size: 14px; padding: 0 2px; opacity: 0.6`；hover `opacity: 1`）。
5. 新增 `.spot-cat-picker`（浮層容器，`position: absolute; z-index: 50; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px; display: flex; flex-wrap: wrap; gap: 4px; width: 224px; box-shadow: var(--shadow)`）。
6. 新增 `.spot-cat-option`（每個分類選項按鈕，`width: 52px; padding: 4px 6px; border-radius: 4px; font-size: 12px; text-align: center; border: 1px solid transparent`；hover `border-color: var(--accent-bd); background: var(--accent-bg)`；`.active` 為目前選中）。
7. 新增 `.spot-cat-backdrop`（`position: fixed; inset: 0; z-index: 49; background: transparent`）。
8. 新增 `.cat-dot`（`width: 8px; height: 8px; border-radius: 50%; display: block; margin: 0 auto 2px`）。

### 6.2 JS — `renderSpotCard(spot, dayId, slot)` 修改

```js
function renderSpotCard(spot, dayId, slot) {
  // ...現有邏輯不變...
  const catColor = getCatColor(spot.category);
  const catBarStyle = catColor ? `style="background:${catColor}"` : '';
  const cat = spot.category
    ? SPOT_CATEGORIES.find(c => c.id === spot.category)
    : null;
  const catBtnEmoji = cat ? cat.emoji : '⊙';
  const catBtnStyle = catColor ? `style="color:${catColor};opacity:1"` : '';
  const pickerOpen = shareState.catPickerOpenSpotId === spot.id;

  return `
    <div class="timeline-row">
      <div class="timeline-left">
        ${catColor && badge ? `<span class="cat-dot" style="background:${catColor}"></span>` : ''}
        ${badge ? `<span class="time-badge">${escHtml(badge)}</span>` : ''}
      </div>
      <div class="timeline-right" style="position:relative">
        <div class="spot-card" data-spot-id="${spot.id}" data-day-id="${dayId}" draggable="true">
          <span class="spot-cat-bar" ${catBarStyle}></span>
          <div class="spot-row">
            <span class="drag-handle" title="拖拉排序">⠿</span>
            <button class="spot-cat-btn" ${catBtnStyle}
              data-action="open-cat-picker"
              data-spot-id="${spot.id}" data-day-id="${dayId}"
              title="選擇分類">${catBtnEmoji}</button>
            <input class="spot-name" ...>
            ...
          </div>
          <input class="spot-notes" ...>
        </div>
        ${pickerOpen ? renderCatPicker(spot) : ''}
      </div>
    </div>`;
}
```

### 6.3 新函式 `renderCatPicker(spot)`

```js
function renderCatPicker(spot) {
  const opts = SPOT_CATEGORIES.map(c => {
    const isActive = spot.category === c.id;
    return `<button class="spot-cat-option ${isActive ? 'active' : ''}"
      data-action="set-cat" data-spot-id="${spot.id}" data-cat="${c.id}"
      title="${c.label}">${c.emoji}<br><span style="font-size:10px">${c.label}</span></button>`;
  }).join('');
  return `
    <div class="spot-cat-backdrop" data-action="close-cat-picker"></div>
    <div class="spot-cat-picker">
      ${opts}
      <button class="spot-cat-option" data-action="set-cat"
        data-spot-id="${spot.id}" data-cat=""
        title="清除分類">╳<br><span style="font-size:10px">清除</span></button>
    </div>`;
}
```

### 6.4 事件處理器（事件委派）

| `data-action` | 行為 |
|---|---|
| `open-cat-picker` | `setShareState({ catPickerOpenSpotId: spotId })` |
| `close-cat-picker` | `setShareState({ catPickerOpenSpotId: null })` |
| `set-cat` | `setState(s => { findSpot(s, spotId).category = catId \|\| null }); setShareState({ catPickerOpenSpotId: null })` |

`catPickerOpenSpotId` 預設加入 `shareState`：

```js
let shareState = {
  // ...現有欄位...
  catPickerOpenSpotId: null,
};
```

### 6.5 `renderCatPicker` 定位

浮層輸出在 `.timeline-right`（`position: relative`）內，`spot-cat-picker` 用 `position: absolute; top: 100%; left: 0` 定位於卡片下方。若靠近視窗底部，可補一個 `bottom: 100%` 的 fallback（可選，初版可先不做）。

### 6.6 Firebase 匯出相容

`uploadTrip` / `downloadTrip` 不需改動。`category` 欄位隨 `spot` 物件一起序列化，`migrateState` 會在舊資料缺少此欄位時補 `null`。

### 6.7 不影響的部分

- `computeTimeline(day)` 不讀 `category`，無需修改
- `renderRouteConnector` 不讀 `category`，無需修改
- Layout A / B / C 三種版面共用 `renderSpotCard`，同步獲得更新
- `renderHelpOverlay()` 需補說明文字（見第 6.8 節）

### 6.8 需同步更新的位置（CLAUDE.md 規定）

1. `README.md`：在功能清單中加入「景點分類標籤」說明
2. `renderHelpOverlay()`：在景點操作說明段落補一行「點擊景點左側圖示可選擇分類（餐廳、景點、購物…），分類顏色顯示於卡片色條與時間軸」
