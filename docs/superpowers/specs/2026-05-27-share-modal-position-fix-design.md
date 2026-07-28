# 共用視窗定位修復設計

**日期**: 2026-05-27
**相關檔案**: `tour-planner.html`

## 問題描述

使用者點擊「☁️ 共用」後出現兩個 bug：

1. **視窗鎖在頂部**：共用彈出視窗只出現在頁面最頂端，使用者若已往下捲動頁面，必須捲回頂部才能操作。
2. **刪除天數按鈕浮出**：背景的刪除天數按鈕（🗑）顯示在共用視窗上方，視覺上遮擋不正確。

## 根本原因分析

兩個 bug 共享同一個根本原因：**`position: fixed` 在特定情況下失效**。

### CSS 結構現狀

```
.share-overlay { position: fixed; inset: 0; z-index: 300; }
  └── .share-backdrop { position: absolute; inset: 0; }
  └── .share-panel { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); }
```

`.share-panel` 使用 `position: absolute`，依賴 `.share-overlay` 的 `position: fixed` 提供正確的 containing block。若 fixed 在某些瀏覽器或重繪情境下未正常建立 containing block，panel 會回退到文件流定位，出現在 `#app` 頂部。

### DOM 順序問題

`render()` 函式目前輸出順序：
```
#app
├── <header>           (sticky, z-index: 100)
├── .settings-overlay  (fixed, z-index: 200)
├── .share-overlay     (fixed, z-index: 300)  ← 在 <main> 之前
└── <main>
    └── ...delete-day 按鈕...
```

若 `.share-overlay` 的 `position: fixed` 失效，它回歸文件流，位置在 `<main>` 之前。`<main>` 的內容（包含刪除按鈕）在 DOM 後方，視覺上壓過失效的 overlay。

### 捲動跳頂問題

`render()` 每次設定 `#app.innerHTML`，在部分行動瀏覽器下會觸發頁面捲動至頂部，即使 `position: fixed` 本身正確，使用者也會看到視窗出現在「當時的頂部視口」。

## 設計方案

### 方案：CSS 直接定位 + DOM 順序 + 捲動保存（採用）

最小侵入性改動，針對所有已知根因：

#### 變更 1：`.share-panel` 改為直接 `position: fixed`

**位置**: CSS 第 448–455 行

```css
/* 之前 */
.share-panel {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  ...
}

/* 之後 */
.share-panel {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  ...
}
```

效果：panel 直接以 viewport 為 containing block 定位，不再依賴 overlay 是否正確建立 fixed context。無論 overlay 狀態如何，panel 都會出現在 viewport 正中央。

#### 變更 2：`renderShareOverlay()` 移到 `<main>` 後面

**位置**: `render()` 函式，第 1194–1200 行

```javascript
// 之前
document.getElementById('app').innerHTML = `
  ${renderHeader()}
  ${renderSettingsPanel()}
  ${renderShareOverlay()}
  <main id="main-area" ...>${mainContent}</main>`;

// 之後
document.getElementById('app').innerHTML = `
  ${renderHeader()}
  ${renderSettingsPanel()}
  <main id="main-area" ...>${mainContent}</main>
  ${renderShareOverlay()}`;
```

效果：即使 fixed 失效，overlay 在 DOM 最後，不會被 `<main>` 的內容壓住。

#### 變更 3：`render()` 保存/恢復 `window.scrollY`

**位置**: `render()` 函式，第 1188–1200 行

```javascript
function render() {
  const scrollY = window.scrollY;
  applySettings(state.settings);
  document.getElementById('app').innerHTML = `...`;
  window.scrollTo(0, scrollY);
}
```

效果：防止 innerHTML 替換在行動瀏覽器上觸發捲動跳頂，確保使用者操作位置不被重置。

## 影響範圍

| 元素 | 變更 | 風險 |
|------|------|------|
| `.share-panel` CSS | `position: absolute` → `fixed` | 低：定位行為等效，只是 containing block 改為 viewport |
| `.share-dialog` CSS | 不變（仍為 `position: absolute` 在 overlay 內） | 無 |
| `render()` DOM 輸出順序 | share overlay 移到 `<main>` 後 | 低：視覺輸出相同 |
| `render()` 捲動保存 | 新增兩行 | 無：讀取後立即恢復 |

## 未處理範圍

- `.share-dialog`（密碼輸入框）的定位邏輯：它是 `position: absolute` 在 `.share-overlay` 內，`.share-overlay` 仍保持 `position: fixed; inset: 0`，`top: 50%` 的計算基準不受影響，無需改動。
- 不改動 Firebase 相關邏輯、事件處理、或其他 UI 元件。
