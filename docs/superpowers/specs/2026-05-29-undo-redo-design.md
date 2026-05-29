# 撤銷／重做（Undo/Redo）設計文件

**日期：** 2026-05-29
**功能：** 讓使用者可以撤銷最近的行程編輯操作，並在撤銷後重做

---

## 1. 概述

在現有的單向資料流（`setState → save → render`）上，新增一個 history stack。每次呼叫 `setState` 時，若屬於需要記錄的操作，就將操作前的 `state` 快照推入 undo stack。Undo 時從 stack 取出快照並直接還原；Redo 時從 redo stack 重新套用。

**不引入新的外部依賴**，完全在現有架構內完成。

---

## 2. UI 設計

### 2.1 按鈕位置

在 `renderHeader()` 的 `header-right` 區段，插入於「⚙️ 設定」按鈕之前：

```
[📋 行程]  [💾 本地 ▾]  [☁️ 共用]  [❓ 說明]  [↩ 撤銷]  [↪ 重做]  [⚙️]
```

兩個按鈕使用 `btn-icon` class，與現有的設定按鈕視覺一致。

```html
<button class="btn-icon" data-action="undo"
  title="撤銷 (Ctrl+Z)"
  ${historyStack.undos.length === 0 ? 'disabled' : ''}>↩</button>
<button class="btn-icon" data-action="redo"
  title="重做 (Ctrl+Y)"
  ${historyStack.redos.length === 0 ? 'disabled' : ''}>↪</button>
```

### 2.2 視覺狀態

| 狀態 | 樣式 |
|------|------|
| 可用 | `btn-icon` 正常顯示 |
| 不可用 | `disabled` attribute — 沿用 `.btn-accent[disabled]` 的 `opacity: 0.4; pointer-events: none` 規則，或為 `.btn-icon[disabled]` 補充相同規則 |

CSS 補充（`.btn-icon` 的 disabled 狀態目前未定義，需新增）：

```css
.btn-icon[disabled] { opacity: 0.4; pointer-events: none; cursor: default; }
```

### 2.3 手機版

`header-right` 在小螢幕已有水平捲動，兩個按鈕直接插入不需額外處理。標題 `title` 屬性在桌面顯示 tooltip，手機忽略。

---

## 3. History Stack 設計

### 3.1 資料結構

History stack 是 module-level 的可變物件（非 `state` 的一部分，不存入 localStorage，不進入 render 流程）：

```js
const historyStack = {
  undos: [],   // Array<StateSnapshot>，最多 MAX_HISTORY 筆，最新在末尾
  redos: [],   // Array<StateSnapshot>，Undo 後暫存，新操作後清空
};

const MAX_HISTORY = 50;
```

`StateSnapshot` 是 `state` 物件的深拷貝（JSON stringify/parse）：

```js
// 型別示意
type StateSnapshot = {
  days: Day[],
  routes: Record<string, Route>,
  activeDayId: string | null,
  tripName: string,
  tripStartDate: string,
  // 不含 settings
};
```

### 3.2 容量限制

undo stack 超過 `MAX_HISTORY`（50）時，移除最舊的一筆（`undos.shift()`）。

### 3.3 不存入 localStorage

History stack 是記憶體內的暫存狀態，頁面重新整理後清空。這是刻意的設計：undo 僅對當前 session 有效，與 localStorage 的持久化職責分離。

---

## 4. setState 整合方式

### 4.1 現有的 setState

```js
function setState(updater) {
  updater(state);
  if (!state.days.find(d => d.id === state.activeDayId)) {
    state.activeDayId = state.days[0]?.id ?? null;
  }
  save();
  render();
}
```

### 4.2 加入 history 後的 setState

新增一個 `snapshotBeforeUpdate()` helper，在 `updater` 執行前先抓快照：

```js
function snapshotState() {
  return JSON.parse(JSON.stringify({
    days: state.days,
    routes: state.routes,
    activeDayId: state.activeDayId,
    tripName: state.tripName,
    tripStartDate: state.tripStartDate,
  }));
}

function setState(updater, { recordHistory = true } = {}) {
  if (recordHistory) {
    historyStack.undos.push(snapshotState());
    if (historyStack.undos.length > MAX_HISTORY) historyStack.undos.shift();
    historyStack.redos = [];   // 新操作清空 redo stack
  }
  updater(state);
  if (!state.days.find(d => d.id === state.activeDayId)) {
    state.activeDayId = state.days[0]?.id ?? null;
  }
  save();
  render();
}
```

`recordHistory: false` 讓不需要記錄的呼叫（settings 變更、undo/redo 本身）可以略過快照。

### 4.3 undo / redo 執行函式

```js
function undo() {
  if (historyStack.undos.length === 0) return;
  historyStack.redos.push(snapshotState());
  const prev = historyStack.undos.pop();
  Object.assign(state, prev);
  if (!state.days.find(d => d.id === state.activeDayId)) {
    state.activeDayId = state.days[0]?.id ?? null;
  }
  save();
  render();
}

function redo() {
  if (historyStack.redos.length === 0) return;
  historyStack.undos.push(snapshotState());
  if (historyStack.undos.length > MAX_HISTORY) historyStack.undos.shift();
  const next = historyStack.redos.pop();
  Object.assign(state, next);
  if (!state.days.find(d => d.id === state.activeDayId)) {
    state.activeDayId = state.days[0]?.id ?? null;
  }
  save();
  render();
}
```

---

## 5. 哪些操作加入 history、哪些排除

### 5.1 加入 history（`recordHistory: true`，預設值）

所有會修改行程內容的 `setState` 呼叫：

| 操作 | data-action / 觸發點 |
|------|----------------------|
| 新增景點 | `add-spot` |
| 刪除景點 | `delete-spot` |
| 景點名稱編輯 | `spot-name`（input change） |
| 景點停留時間 | `spot-dur-h` / `spot-dur-m` |
| 景點備註 | `spot-notes` |
| 景點排序（拖曳） | drop 事件後的 setState |
| 新增天數 | `add-day` |
| 刪除天數 | `delete-day` |
| 天數名稱編輯 | `day-name` |
| 出發飯店名稱 | `hotel-start-name` |
| 返回飯店名稱 | `hotel-end-name` |
| 出發時間 | `day-start-time` |
| 路線交通方式 | `route-transport` |
| 路線交通時間 | `route-time-h` / `route-time-m` |
| 旅程名稱 | `trip-name` |
| 旅程開始日期 | `trip-start-date` |
| 匯入 JSON | `import-json` |
| 切換行程（📋 行程管理） | `switch-trip` / `new-trip-in-list` |

### 5.2 排除 history（`recordHistory: false`）

| 操作 | 原因 |
|------|------|
| `settings.layout` 變更 | 純 UI 偏好，不屬於行程內容 |
| `settings.theme` 變更 | 純 UI 偏好 |
| `settings.fontSize` 變更 | 純 UI 偏好 |
| `settings.defaultTransport` 變更 | 全域預設，影響範圍廣且難以有意義地還原 |
| `undo()` / `redo()` 本身 | 避免遞迴記錄 |
| `shareState` 的任何變更 | `setShareState` 完全不觸碰 historyStack |

settings 變更傳入 `setState(fn, { recordHistory: false })`。

---

## 6. 行為規範（邊界條件）

| 情境 | 預期行為 |
|------|----------|
| undo stack 為空時按撤銷 | 無反應（按鈕 disabled，鍵盤快捷鍵 early return） |
| redo stack 為空時按重做 | 無反應（按鈕 disabled，鍵盤快捷鍵 early return） |
| 執行新操作後（undo stack 不空） | redo stack 清空，無法重做先前撤銷的操作 |
| undo stack 達到 50 筆上限 | 繼續新增操作時 `shift()` 移除最舊一筆，不報錯 |
| 頁面重新整理 | history stack 清空；localStorage 保留最後一次存檔的 state |
| 匯入 JSON 後撤銷 | 還原到匯入前的 state（匯入前快照已推入 undo stack） |
| 撤銷後 activeDayId 指向已不存在的天數 | `undo()` / `redo()` 執行後同樣做 activeDayId 修復（與 setState 一致） |
| input 欄位（景點名稱等）為 `input` 事件 | 每次 keystroke 都推入 stack；若覺得粒度過細，可改用 `change` 事件（失焦時才記錄）—— 建議先用 `change` 以降低 stack 消耗 |

---

## 7. 實作要點

### 7.1 檔案結構

所有改動集中在 `tour-planner.html` 的 `<script>` 段：

1. **宣告** `historyStack` 與 `MAX_HISTORY`（放在 `let state = ...` 附近的初始化區段）
2. **新增** `snapshotState()` helper
3. **修改** `setState(updater)` 加入 `options` 參數與快照邏輯
4. **新增** `undo()` / `redo()` 函式
5. **修改** `renderHeader()` 加入兩個按鈕
6. **修改** `attachEvents()` 加入：
   - click handler for `undo` / `redo` actions
   - `document` 層的 `keydown` listener for Ctrl+Z / Cmd+Z / Ctrl+Y / Cmd+Shift+Z
7. **修改** settings 相關的 `setState` 呼叫，傳入 `{ recordHistory: false }`
8. **補充** CSS：`.btn-icon[disabled]` 的 opacity 規則

### 7.2 鍵盤事件綁定

鍵盤事件綁在 `document` 而非 `#app`，避免在 input 聚焦時失效（input 裡的 Ctrl+Z 應優先由瀏覽器原生 undo 處理，故需判斷 focus target）：

```js
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
  if (isInput) return;   // 讓 input 欄位保留瀏覽器原生 undo

  const isMac = navigator.platform.startsWith('Mac');
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (mod && e.key === 'y') { e.preventDefault(); redo(); }
  if (mod && e.shiftKey && e.key === 'z') { e.preventDefault(); redo(); }
});
```

### 7.3 input 事件的粒度建議

景點名稱、飯店名稱、備註等 `<input>` 欄位目前使用 `input` 事件（每個 keystroke 觸發 setState）。若直接接入 history，一個字的修改會產生多筆快照。

建議：將這類文字欄位的 history 記錄改由 `change` 事件（失焦）觸發，或在 `setState` 呼叫前判斷 action 類型，對文字輸入類 action 使用 `recordHistory: false`，另外在 `blur` 時補一次 `recordHistory: true` 的 setState。

最簡單的初版實作：統一以 `change`（失焦）觸發 setState，避免粒度過細。具體拆分視實作複雜度決定。

### 7.4 需要同步更新的位置

依照 `CLAUDE.md` 的規定，新增功能後需同步更新：

1. `README.md` — 說明撤銷／重做功能與快捷鍵
2. `renderHelpOverlay()` — 說明頁面中加入「Ctrl+Z 撤銷 / Ctrl+Y 重做」條目
