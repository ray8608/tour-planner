# Layout B 手機版天數選擇改版設計文件

**日期：** 2026-05-29  
**功能：** 手機版 Layout B 以浮出下拉選單取代固定側邊欄，釋放內容區域寬度

---

## 問題

Layout B（側邊欄模式）在手機（≤600px）上側邊欄佔去 90px，`day-content` 可用寬度只剩約 280px，導致景點卡片與路線列過於擁擠，即使已做 route-connector 換行修正仍不理想。

---

## 解法

手機版隱藏側邊欄，改在 `day-content` 最上方放一個「第X天 ▾」按鈕，點擊後就地彈出天數選擇浮層。桌面版（> 600px）行為完全不變。

---

## UI 設計

### 手機版 day-content 頂部

```
[第1天 ▾]   ←── 天數切換按鈕（僅手機）
---
第1天   6/15(日)   [刪除]   ←── 原有 renderDayHeader()
```

### 下拉選單（點「第X天 ▾」後展開）

```
┌─────────────────────────┐
│ ● 第1天   6/15(日)      │  ← 當前天（高亮）
│   第2天   6/16(一)      │
│   第3天   6/17(二)      │
│ ─────────────────────── │
│ ＋ 新增天數              │
└─────────────────────────┘
```

- 選單以 `position: absolute` 定位於 `.day-switch-wrap` 之下
- 點選任一天數：切換天數並關閉選單
- 點「＋ 新增天數」：新增天數並關閉選單
- 點選單外（透明背景層）：關閉選單

---

## 實作範圍

### 1. CSS

- 新增 `.day-switch-wrap { display: none; position: relative; margin-bottom: 8px; }`（桌面隱藏）
- `@media (max-width: 600px)`：
  - `.day-sidebar { display: none; }`（取代原本的 `width: 90px`）
  - `.day-switch-wrap { display: block; }`
- 新增 `.day-switch-btn` 樣式（`btn-ghost` 風格，顯示目前天數名稱）
- 新增 `.day-dropdown-menu` 樣式（`position: absolute`、`z-index: 50`、`border-radius`、`box-shadow`）
- 新增 `.day-dropdown-item` 樣式（各天數列）、`.day-dropdown-item.active` 高亮
- 新增 `.day-dropdown-add` 樣式（「＋ 新增天數」，虛線上方分隔）
- 新增 `.day-dropdown-backdrop` 樣式（`position: fixed; inset: 0; z-index: 49; background: transparent`）

### 2. JavaScript — `renderLayoutB()`

在 `.day-content` 開頭插入 `.day-switch-wrap`：

```javascript
const switchBtn = `
  <div class="day-switch-wrap">
    <button class="day-switch-btn btn-ghost" data-action="toggle-day-dropdown">
      ${escHtml(active?.label || '天數')} ▾
    </button>
    ${shareState.dayDropdownOpen ? renderDayDropdown(active) : ''}
  </div>`;
```

### 3. 新函式 `renderDayDropdown(activeDay)`

渲染下拉選單內容：

```javascript
function renderDayDropdown(activeDay) {
  const items = state.days.map((d, i) => {
    const dateStr = getDayDate(i);
    return `<button class="day-dropdown-item ${d.id === activeDay?.id ? 'active' : ''}"
      data-action="select-day" data-day-id="${d.id}">
      ${escHtml(d.label)}
      ${dateStr ? `<span class="day-dropdown-date">${escHtml(dateStr)}</span>` : ''}
    </button>`;
  }).join('');
  return `
    <div class="day-dropdown-backdrop" data-action="close-day-dropdown"></div>
    <div class="day-dropdown-menu">
      ${items}
      <button class="day-dropdown-add" data-action="add-day">＋ 新增天數</button>
    </div>`;
}
```

### 4. 事件處理器

| `data-action` | 行為 |
|---|---|
| `toggle-day-dropdown` | `setShareState({ dayDropdownOpen: !shareState.dayDropdownOpen })` |
| `close-day-dropdown` | `setShareState({ dayDropdownOpen: false })` |
| `select-day`（既有） | 選天數後加上 `if (shareState.dayDropdownOpen) setShareState({ dayDropdownOpen: false })` |
| `add-day`（既有） | 新增後加上 `if (shareState.dayDropdownOpen) setShareState({ dayDropdownOpen: false })` |

---

## 資料層

無後端變更。僅使用既有 `shareState` 的 `dayDropdownOpen`（boolean，預設 `false`）。

---

## 不影響的部分

- 桌面版 Layout B 行為完全不變
- Layout A（頁籤）、Layout C（垂直捲動）完全不變
- `renderDayHeader()` 函數本身不修改
