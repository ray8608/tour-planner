# 共用視窗定位修復 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修復共用視窗只出現在頁面頂部、且刪除天數按鈕浮出視窗上方的兩個 bug。

**Architecture:** 全部改動集中在 `tour-planner.html` 單一檔案：(1) CSS 層改 `.share-panel` 為直接 `position: fixed` 置中；(2) JavaScript 層將 share overlay 移到 DOM 末尾；(3) `render()` 加 scrollY 保存/恢復防捲動跳頂。

**Tech Stack:** 純 HTML/CSS/JavaScript，無框架，無建置工具。

---

### Task 1：修正 `.share-panel` CSS 定位

**Files:**
- Modify: `tour-planner.html:448-455`

- [ ] **Step 1：確認目前 CSS**

開啟 `tour-planner.html`，找到第 448 行左右的 `.share-panel`，確認現狀：

```css
.share-panel {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; width: min(480px, calc(100vw - 32px));
  max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
```

- [ ] **Step 2：將 `position: absolute` 改為 `position: fixed`**

將第 449 行 `position: absolute;` 改為 `position: fixed;`，其餘不動：

```css
.share-panel {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; width: min(480px, calc(100vw - 32px));
  max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
```

- [ ] **Step 3：手動確認 CSS 語法正確**

在瀏覽器開啟 `tour-planner.html`（直接用 `file://` 或本地 HTTP server），開啟共用視窗，確認：
- 視窗出現在瀏覽器可見區域正中央
- 視窗不因頁面捲動而移動

- [ ] **Step 4：Commit**

```bash
git add tour-planner.html
git commit -m "fix: share panel uses position fixed for viewport centering"
```

---

### Task 2：將 `renderShareOverlay()` 移到 `<main>` 之後

**Files:**
- Modify: `tour-planner.html:1194-1200`（`render()` 函式）

- [ ] **Step 1：確認目前 `render()` 輸出順序**

找到 `render()` 函式中設定 `#app.innerHTML` 的程式碼（約第 1194 行），確認現狀：

```javascript
document.getElementById('app').innerHTML = `
  ${renderHeader()}
  ${renderSettingsPanel()}
  ${renderShareOverlay()}
  <main id="main-area" style="flex:1;display:flex;flex-direction:column">
    ${mainContent}
  </main>`;
```

- [ ] **Step 2：將 `${renderShareOverlay()}` 移到 `</main>` 之後**

```javascript
document.getElementById('app').innerHTML = `
  ${renderHeader()}
  ${renderSettingsPanel()}
  <main id="main-area" style="flex:1;display:flex;flex-direction:column">
    ${mainContent}
  </main>
  ${renderShareOverlay()}`;
```

- [ ] **Step 3：手動驗證**

重新整理頁面，點選共用，確認：
- 共用視窗仍正常顯示
- 背景的刪除天數按鈕（🗑）不再浮出在共用視窗上方
- 點擊背景（半透明遮罩）可正常關閉視窗

- [ ] **Step 4：Commit**

```bash
git add tour-planner.html
git commit -m "fix: render share overlay after main to fix z-index stacking"
```

---

### Task 3：`render()` 保存/恢復 `window.scrollY`

**Files:**
- Modify: `tour-planner.html:1188-1201`（`render()` 函式開頭）

- [ ] **Step 1：確認目前 `render()` 開頭**

找到 `render()` 函式（約第 1188 行），確認現狀：

```javascript
function render() {
  applySettings(state.settings);
  document.getElementById('app').innerHTML = `
    ...`;
}
```

- [ ] **Step 2：加入 scrollY 保存/恢復**

在 `applySettings` 前讀取 `window.scrollY`，在 innerHTML 設定後立即恢復：

```javascript
function render() {
  const scrollY = window.scrollY;
  applySettings(state.settings);
  document.getElementById('app').innerHTML = `
    ${renderHeader()}
    ${renderSettingsPanel()}
    <main id="main-area" style="flex:1;display:flex;flex-direction:column">
      ${mainContent}
    </main>
    ${renderShareOverlay()}`;
  window.scrollTo(0, scrollY);
}
```

注意：`window.scrollTo(0, scrollY)` 放在 innerHTML 設定之後、函式結束之前。不要放在 `renderShareOverlay()` 之前。

- [ ] **Step 3：手動驗證捲動行為**

使用 Layout C（垂直捲動模式，設定面板內選「C 捲動」），新增至少 3 天行程，往下捲動到第 2 或第 3 天，再點選「☁️ 共用」：
- 頁面不應跳回頂部
- 共用視窗應出現在目前可見範圍的正中央
- 關閉共用視窗後，頁面捲動位置應維持在原處

- [ ] **Step 4：同時驗證 Layout A、B**

切換到 Layout A（頁籤）和 Layout B（側欄），分別開關共用視窗，確認：
- 操作正常，無 JavaScript 錯誤（開啟 DevTools Console 確認）
- 視窗開關後頁面位置不跳動

- [ ] **Step 5：Commit**

```bash
git add tour-planner.html
git commit -m "fix: preserve scroll position across render() to prevent jump-to-top on share open"
```

---

## 完成標準

全部三個 task 完成後，確認以下行為：

| 情境 | 預期結果 |
|------|----------|
| 在頁面頂部點擊共用 | 視窗出現在 viewport 正中央 |
| 在頁面中間點擊共用 | 視窗出現在當前 viewport 正中央，頁面不跳頂 |
| 共用視窗開啟時，背景刪除按鈕 | 不可見（被遮罩蓋住） |
| 點擊遮罩關閉視窗 | 正常關閉，捲動位置不變 |
| Layout A / B / C 皆適用 | 三種版面均無問題 |
