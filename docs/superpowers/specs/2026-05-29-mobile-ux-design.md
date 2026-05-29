# 手機 UX 全面優化設計文件

**日期：** 2026-05-29  
**功能：** 改善手機（≤600px）的觸控體驗、景點卡片可讀性、快速新增景點，以及底部拇指可及操作區

---

## 1. 目前手機體驗痛點分析

### 觸控拖曳

目前已有 `touchstart/touchmove/touchend` 的 ghost-card 實作，但存在下列問題：

- 手指按住 `.drag-handle`（⠿ 字元，字型大小 14px，padding 0 2px）時，點擊目標面積約 20×22px，遠低於 Apple HIG 建議的 44×44px，容易點不到。
- `touchstart` 觸發後呼叫 `e.preventDefault()`，會同時阻止頁面捲動，但手指一碰到 handle 就立刻啟動拖曳，沒有「長按延遲」，導致使用者想捲動頁面時常意外觸發拖曳。
- iOS Safari 13+ 對 `position: fixed` ghost element 有 scroll container 計算偏移問題，當頁面有捲動量（`scrollY > 0`）時 ghost 位置偏移。
- Android Chrome 在 `passive: false` listener 下捲動流暢度下降（jank）。

### 景點卡片

- `.spot-row` 在 ≤600px 時 `flex-wrap: wrap`，duration group 換行到第二行，但整個 `spot-row` 第一行仍是：drag-handle + name input + `🗺 導航` + ✕ 四個元素橫排，name input `min-width: 0` 可能壓縮到 60px 以下。
- `🗺 導航`（`.btn-accent`）和 ✕（`.btn-ghost`）無明確 padding 規範，`opacity: 0.5` 使 ✕ 難以辨識。
- `timeline-left` 在 ≤480px 縮到 64px，time badge 字型 10px，小螢幕難以閱讀。

### 快速新增景點

- `＋ 新增景點`（`.btn-add`）置於天的最底部，使用者需捲動到底才能點擊。
- 新增後不會自動 focus 到名稱欄位，需再點一次才能輸入景點名稱。
- 沒有鍵盤連續新增路徑（新增完一個景點按 Enter 可繼續新增下一個）。

### 底部操作

- 常用操作（新增景點、新增天數、切換天數）全部散落在頁面各處，拇指從螢幕底部難以觸及。
- Header 的 📋 行程、💾 本地、☁️ 共用、❓ 說明 按鈕在 ≤600px 時已 `flex-wrap`，但仍在頁面頂部，需雙手操作。

---

## 2. 觸控拖曳方案

### 方案 A：改善現有 Touch Event 實作

在現有 `touchstart/touchmove/touchend` 基礎上加入：

1. **長按啟動（200ms delay）**：`touchstart` 時設計時器，200ms 後才建立 ghost、進入拖曳模式；期間如有 `touchmove` 超過閾值（5px）則取消計時器、讓瀏覽器正常捲動。
2. **修正 iOS ghost 偏移**：ghost 定位改為 `touch.clientX - offsetX`，但 top 計算需加上 `window.scrollY`（改用 `position: absolute` + `document.body` 追加，或直接修正為 `top: touch.pageY - offsetY`）。
3. **擴大 drag-handle 點擊區**：`.drag-handle` 加 `padding: 10px 8px; margin: -10px -8px;`，視覺不變但點擊面積達 44px 高度。

### 方案 B：CSS Order Reorder（上移／下移按鈕）

不使用拖曳，改為每張景點卡片顯示 ↑ / ↓ 按鈕，點擊直接呼叫 `moveSpotBefore()`。

- 優點：零觸控相容性問題；iOS/Android 行為完全一致；不干擾頁面捲動。
- 缺點：多個景點需多次點擊；視覺佔空間（需要在手機才顯示）。

### 推薦：方案 A（改善現有 Touch Event），方案 B 作為降級備案

理由：拖曳在視覺上能即時反映排序意圖，使用者學習成本低。現有實作的核心邏輯（ghost clone + `elementFromPoint`）正確，問題集中在長按誤觸、handle 面積不足、iOS scroll offset 三個可修正點。方案 B 以 `data-mobile-reorder` CSS class 實作，手機版同時保留 ↑↓ 按鈕作為 fallback，讓觸控不靈敏的情況下有替代操作。

---

## 3. 景點卡片 RWD 設計

### 目前 .spot-row 在 ≤600px 的問題

```
[⠿][── name input ────────][🗺 導航][✕]   ← 第一行（擠壓 name input）
[stayDuration select group]               ← 第二行（已有 order:5）
```

### 調整後佈局

**第一行：** drag-handle + name input（name 盡量展開）  
**第二行：** duration group + 導航 + 刪除（靠左，不換行）

```css
/* ≤600px 景點卡片 spot-row 重排 */
@media (max-width: 600px) {
  .spot-row { flex-wrap: wrap; row-gap: 6px; }

  /* drag-handle 加大點擊區 */
  .drag-handle { padding: 10px 8px; margin: -10px -8px; font-size: 16px; }

  /* name input 佔滿第一行剩餘空間 */
  .spot-name { flex: 1; min-width: 0; }

  /* duration + 導航 + 刪除 同行，第二行 */
  .spot-row .duration-group { order: 5; flex: 0 0 auto; }
  .spot-row .btn-accent      { order: 6; flex: 0 0 auto; font-size: 12px; padding: 3px 8px; }
  .spot-row .btn-ghost       { order: 7; flex: 0 0 auto; opacity: 0.7; padding: 3px 6px; }

  /* 第二行整體 padding 對齊 drag-handle 寬度 */
  .spot-row .duration-group,
  .spot-row .btn-accent,
  .spot-row .btn-ghost { margin-top: 0; }

  /* 第二行以偽元素 flex-basis 換行 */
  .spot-row::after {
    content: '';
    flex-basis: 100%;
    order: 4;
  }
}
```

### time badge 可讀性

`timeline-left` 在 ≤480px 縮至 64px，time badge 10px 字型勉強可讀。  
調整：`font-size: 11px`（與 ≤600px 相同），`line-height: 1.4`，不再縮小。

```css
@media (max-width: 480px) {
  .timeline-left { width: 64px; min-width: 64px; }
  .time-badge { font-size: 11px; }  /* 不再額外縮小 */
}
```

---

## 4. 快速新增景點 UI

### 現狀

`＋ 新增景點` 是 `.btn-add`（`width: 100%; padding: 8px`），位置在 `renderDaySpots()` 最底部，`renderHotelEndMarker()` 之後。

### 改善點

#### 4a. 自動 focus

`add-spot` action handler 呼叫 `setState()` 觸發 `render()` 後，找到最新景點的 name input 並 focus：

```javascript
if (action === 'add-spot') {
  const dayId = el.dataset.dayId;
  setState(s => {
    const day = s.days.find(d => d.id === dayId);
    if (day) day.spots.push({ id: genId(), name: '', stayDuration: 0, notes: '' });
  });
  // render() 已在 setState 內呼叫，此時 DOM 已更新
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll(`.spot-card[data-day-id="${dayId}"]`);
    const last = cards[cards.length - 1];
    last?.querySelector('.spot-name')?.focus();
  });
  return;
}
```

#### 4b. Enter 鍵連續新增

在 `.spot-name` 的 `keydown` 監聽（加入既有 `input` listener 旁）：

```javascript
app.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const input = e.target.closest('.spot-name');
  if (!input) return;
  e.preventDefault();
  const { dayId } = input.dataset;
  // 觸發與 add-spot button 相同的 setState + focus 邏輯
  addSpotAndFocus(dayId);
});
```

共用函式 `addSpotAndFocus(dayId)` 避免重複。

#### 4c. 手機上 ＋ 新增景點按鈕高度

```css
@media (max-width: 600px) {
  .btn-add { padding: 12px 8px; font-size: 14px; }
}
```

padding 由 8px 增至 12px，點擊區域更友善。

---

## 5. 底部操作區設計

### 哪些操作放到底部 FAB bar

手機版在 `<main>` 下方（`position: sticky; bottom: 0`）顯示一條薄操作條，包含：

| 按鈕 | 圖示 | data-action | 說明 |
|---|---|---|---|
| 新增景點 | ＋ | `add-spot` | 新增到當前天 |
| 切換天 | 📅 | `toggle-day-dropdown` | 僅 Layout A/B 顯示 |
| 新增天 | ＋天 | `add-day` | 新增天數 |

Layout C（垂直捲動）沒有 active day 概念，「切換天」替換為捲動至最後一天的錨點按鈕。

### HTML 結構

```html
<div class="mobile-bottom-bar" id="mobile-bottom-bar">
  <button class="mbb-btn" data-action="add-spot" data-day-id="${activeDayId}">
    <span class="mbb-icon">＋</span>
    <span class="mbb-label">景點</span>
  </button>
  <button class="mbb-btn" data-action="toggle-day-dropdown">
    <span class="mbb-icon">📅</span>
    <span class="mbb-label">切換天</span>
  </button>
  <button class="mbb-btn" data-action="add-day">
    <span class="mbb-icon">＋天</span>
    <span class="mbb-label">新增天</span>
  </button>
</div>
```

### CSS

```css
.mobile-bottom-bar {
  display: none;                  /* 桌面隱藏 */
}

@media (max-width: 600px) {
  .mobile-bottom-bar {
    display: flex;
    position: sticky;
    bottom: 0;
    left: 0; right: 0;
    background: var(--surface);
    border-top: 1px solid var(--border);
    z-index: 80;
    /* 避免 iOS Safari 底部工具列遮擋 */
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .mbb-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 11px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .mbb-btn:active { background: var(--accent-bg); color: var(--accent); }
  .mbb-icon { font-size: 18px; line-height: 1; }
  .mbb-label { font-size: 10px; }
}
```

### 避免與手機系統手勢衝突

- **iOS 底部 home indicator**：使用 `env(safe-area-inset-bottom)` 確保底部操作條不被 home indicator 遮擋。需在 `<meta name="viewport">` 加上 `viewport-fit=cover`：`content="width=device-width, initial-scale=1.0, viewport-fit=cover"`。
- **Android 手勢導航**：Android 10+ 的側邊返回手勢從螢幕左右邊緣 20px 向內滑。底部操作條本身不覆蓋邊緣，不衝突。若未來加入側滑抽屜，需設定 `overscroll-behavior: none` 並留出 20px 安全邊距。
- **iOS Safari 網頁捲動與 sticky**：`position: sticky; bottom: 0` 在 iOS Safari 15+ 行為正確（toolbar 自動收起時 sticky 元素會跟著調整），不需 `position: fixed`。若相容 iOS 14 以下，需改為 `position: fixed; bottom: 0` 並對 `main` 加 `padding-bottom: 60px`。
- **底部操作條與 day-switch dropdown 的層級**：dropdown menu `z-index: 50`，底部操作條 `z-index: 80`，確保 dropdown 在 bar 之下顯示，不遮擋選單。

### renderMobileBottomBar() 整合至 render()

```javascript
function renderMobileBottomBar() {
  const { layout } = state.settings;
  const active = state.days.find(d => d.id === state.activeDayId) || state.days[0];
  const dayId = active?.id || '';
  const showDaySwitch = layout !== 'C';
  return `
    <div class="mobile-bottom-bar">
      <button class="mbb-btn" data-action="add-spot" data-day-id="${dayId}">
        <span class="mbb-icon">＋</span>
        <span class="mbb-label">景點</span>
      </button>
      ${showDaySwitch ? `
        <button class="mbb-btn" data-action="toggle-day-dropdown">
          <span class="mbb-icon">📅</span>
          <span class="mbb-label">切換天</span>
        </button>` : `
        <a class="mbb-btn" href="#day-${dayId}">
          <span class="mbb-icon">⬇</span>
          <span class="mbb-label">最後天</span>
        </a>`}
      <button class="mbb-btn" data-action="add-day">
        <span class="mbb-icon">＋天</span>
        <span class="mbb-label">新增天</span>
      </button>
    </div>`;
}
```

在 `render()` 的 `#app` innerHTML 末尾（`renderTripsOverlay()` 之後）加入 `${renderMobileBottomBar()}`。

---

## 6. 各 Layout 的手機差異處理

### Layout A（頁籤）

- 手機版頁籤列（`.day-tabs`）橫向捲動：加 `overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none`。
- 底部操作條的「切換天」按鈕觸發同一個 `toggle-day-dropdown`（複用 Layout B 的 `shareState.dayDropdownOpen` 邏輯）；dropdown 渲染邏輯需移出 `renderLayoutB()` 改為在 `render()` 層判斷，讓 Layout A 手機版也能呼叫 `renderDayDropdown()`。
- 「切換天」dropdown 與頁籤共存不衝突：dropdown 出現時點頁籤仍可切換，`select-day` handler 關閉 dropdown 後再切換。

### Layout B（側邊欄）

- 已有 dropdown day picker，底部操作條「切換天」觸發同一個 `toggle-day-dropdown`，行為一致。
- 桌面版側邊欄（`.day-sidebar`）顯示時，底部操作條 `display: none`（已由 `@media (max-width: 600px)` 控制）。

### Layout C（垂直捲動）

- 沒有 activeDayId 概念，`add-spot` 操作需指定天。底部操作條的「景點」按鈕改為開啟一個 inline picker，讓使用者選擇要加到哪一天；或預設加到最後一天（`state.days[state.days.length - 1].id`），較為簡單，推薦先實作此方案。
- 「切換天」改為「捲到底」捷徑（錨點跳轉），如設計覺得不需要可隱藏此項。
- 「新增天」行為與其他 layout 相同。

---

## 7. 實作要點

### CSS 改動清單

| 位置 | 改動 |
|---|---|
| 既有 `@media (max-width: 600px)` | 加大 `.btn-add` padding（12px）；加大 `.drag-handle` padding；`.spot-row::after` 換行 trick；`.btn-accent`、`.btn-ghost` 移到第二行 order |
| 既有 `@media (max-width: 480px)` | 移除 `.time-badge { font-size: 10px }`，改為 11px |
| 新增 `<meta viewport>` | 加 `viewport-fit=cover` |
| 新增 `.mobile-bottom-bar` | sticky bar 樣式，含 `safe-area-inset-bottom` |
| 新增 `.mbb-btn`、`.mbb-icon`、`.mbb-label` | 底部操作按鈕樣式 |
| `.day-tabs`（Layout A） | `overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch` |

### JavaScript 改動清單

| 位置 | 改動 |
|---|---|
| `add-spot` handler | 加 `requestAnimationFrame` + focus 最新 `.spot-name` |
| 新增 `addSpotAndFocus(dayId)` | 共用邏輯，供 button click 和 Enter keydown 呼叫 |
| 新增 `keydown` listener | `.spot-name` Enter 鍵觸發 `addSpotAndFocus()` |
| `touchstart` handler | 改為長按 200ms 後啟動拖曳；`touchmove` 超 5px 時取消計時器 |
| ghost top 計算 | 改為 `touch.pageY - touchDrag.offsetY`（修正 iOS scroll offset） |
| `renderMobileBottomBar()` | 新函式，依 layout 和 activeDayId 產生 HTML |
| `render()` | 在 `#app` innerHTML 末尾加入 `${renderMobileBottomBar()}` |
| `renderLayoutA()` | 移除 dropdown 渲染邏輯到外層，或在 A layout 下的 `day-switch-wrap` 插入 dropdown |
| `select-day` handler | 已有 `setShareState({ dayDropdownOpen: false })` 邏輯確認存在 |

### iOS Safari 長按與系統選單衝突

`touchstart` 長按 200ms 計時器期間，若系統觸發 context menu（長按文字），會在 `touchcancel` 時清除計時器，無副作用。`user-select: none` 已套用在 `.drag-handle`，防止長按選字。

### Android Chrome passive listener

長按計時器啟動前（未進入拖曳模式）：listener 應為 `{ passive: true }` 允許瀏覽器正常捲動。  
進入拖曳模式後（200ms 後）：動態改為 `e.preventDefault()` 呼叫以阻止捲動。  
實作方式：`touchmove` listener 加入條件判斷 `if (!touchDrag) return`（`touchDrag` 在 200ms 後才設定），`e.preventDefault()` 只在 `touchDrag` 存在時呼叫；listener 本身設為 `{ passive: false }` 但 `preventDefault` 有條件呼叫，避免 Chrome 警告。

---

## 不影響的部分

- 桌面版（>600px）所有 layout 行為與視覺完全不變
- Firebase 雲端共用功能不受影響
- `computeTimeline()`、`setState()`、localStorage 持久化邏輯不受影響
- 現有 drag-and-drop（HTML5 API）在桌面版繼續運作
