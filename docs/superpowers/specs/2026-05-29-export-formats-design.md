# 多格式匯出 設計文件

**日期**: 2026-05-29  
**相關檔案**: `tour-planner.html`

---

## 1. 概述

現有匯出功能僅支援 JSON。本功能新增三個匯出途徑：

| 功能 | 機制 | 產出 |
|------|------|------|
| 列印友善排版 | `@media print` CSS | 瀏覽器列印 |
| PDF 匯出 | `window.print()` | 系統列印對話框（可選「另存 PDF」） |
| 行事曆匯出 | Blob + `<a download>` | `.ics` 檔案 |

三項功能整合進現有「💾 本地 ▾」下拉選單，不新增獨立按鈕。

---

## 2. UI 設計

### 2.1 「💾 本地 ▾」選單擴充

**修改前：**
```
📤 匯出 JSON
📥 匯入 JSON
```

**修改後：**
```
📤 匯出 JSON
📥 匯入 JSON
────────────
🖨 列印 / PDF
📅 匯出行事曆 (.ics)
```

分隔線用 `border-top: 1px solid var(--border)` 區隔 JSON 操作與新匯出項目。

### 2.2 選單項目 HTML 範本

```html
<hr style="border:none;border-top:1px solid var(--border);margin:2px 0">
<button data-action="print-trip"
  style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;
         color:var(--text);font-size:13px;cursor:pointer">
  🖨 列印 / PDF
</button>
<button data-action="export-ics"
  style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;
         border-bottom:1px solid var(--border);color:var(--text);font-size:13px;cursor:pointer">
  📅 匯出行事曆 (.ics)
</button>
```

### 2.3 操作流程

**列印 / PDF：**
1. 使用者點選「🖨 列印 / PDF」
2. 關閉選單（`localMenuOpen = false`）
3. 執行 `window.print()`
4. 瀏覽器顯示列印對話框；使用者可選「另存為 PDF」或實體印表機

**行事曆匯出：**
1. 使用者點選「📅 匯出行事曆 (.ics)」
2. 關閉選單
3. 呼叫 `exportICS()`，產生 Blob 並觸發下載
4. 下載檔名：`{tripName}-{YYYY-MM-DD}.ics`

---

## 3. 列印版面設計

### 3.1 顯示 / 隱藏規則

`@media print` 內設定：

| 元素 | 處理方式 |
|------|----------|
| `.app-header` | `display: none` |
| `.settings-panel`（設定面板） | `display: none` |
| `.day-tabs`（頁籤列，Layout A） | `display: none` |
| `.day-sidebar`（側邊欄，Layout B） | `display: none` |
| `.day-switch-wrap`（手機天數切換） | `display: none` |
| `.day-header` 中的刪除按鈕（`.btn-ghost`） | `display: none` |
| `.spot-card` 中的拖曳把手（`.drag-handle`） | `display: none` |
| `.spot-card` 中的時間選擇器（`.duration-group`） | `display: none` |
| `.spot-card` 中的導航按鈕（`.btn-accent`） | `display: none` |
| `.spot-card` 中的刪除按鈕（`.btn-ghost`） | `display: none` |
| `.route-connector` 中的路線查看連結 | `display: none` |
| `.route-connector` 中的 `<select>`（交通方式） | `display: none` |
| `.route-connector` 中的時間選擇器 | `display: none` |
| `.btn-add`（新增景點按鈕） | `display: none` |
| `.share-overlay`, `.help-overlay`, `.trips-overlay` | `display: none` |

保留顯示：

| 元素 | 說明 |
|------|------|
| 旅程名稱文字（`.trip-name` value） | 以靜態文字呈現（見 3.2） |
| 旅行日期（`.trip-date-input`） | 同上 |
| 天數標頭（`.day-header`） | 天數名稱 + 日期 |
| 飯店出發標記（`.hotel-start-marker`） | 含出發時間 |
| 景點卡片（`.spot-card`） | 名稱、時間徽章、備注 |
| 交通時間文字（route connector 的時間徽章） | 顯示行車時間 |
| 飯店返回標記（`.hotel-end-marker`） | 含抵達時間 |

### 3.2 列印專用標題區塊

在 `render()` 輸出的最前方插入一個 `#print-header`，平時 `display: none`，列印時 `display: block`：

```html
<div id="print-header">
  <h1 class="print-trip-name">${escHtml(state.tripName)}</h1>
  ${state.tripStartDate
    ? `<p class="print-trip-date">${escHtml(state.tripStartDate)} 出發</p>`
    : ''}
</div>
```

對應 CSS：

```css
#print-header { display: none; }

@media print {
  #print-header {
    display: block;
    text-align: center;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid #333;
  }
  .print-trip-name { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
  .print-trip-date { font-size: 13px; color: #555; margin: 0; }
}
```

### 3.3 Layout C 列印（推薦版面）

Layout C（垂直捲動）已天然呈現全部天數，最適合列印。`@media print` 強制所有 layout 渲染方式等同 Layout C 的結構：在 `@media print` 中：

```css
@media print {
  .layout-b-wrap { display: block; }   /* 消除 flex 側邊欄影響 */
  .day-content   { width: 100%; }
  .day-tabs      { display: none; }
}
```

Layout A 和 B 的列印版面仍只顯示 `activeDayId` 對應的那一天（與畫面上顯示的一致）。若使用者想列印全部天數，需先切換至 Layout C。此行為在說明頁面補充說明。

### 3.4 分頁控制

```css
@media print {
  .day-section  { page-break-inside: avoid; }
  .spot-card    { page-break-inside: avoid; }
  .day-section-header { page-break-after: avoid; }
}
```

### 3.5 色彩

```css
@media print {
  * { color: #000 !important; background: #fff !important; }
  .time-badge { color: #333 !important; font-weight: 600; }
  .route-connector .route-line { border-color: #aaa !important; }
  a { text-decoration: none !important; }
}
```

---

## 4. ICS 格式規範

### 4.1 檔案結構

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tour Planner//ZH
CALSCALE:GREGORIAN
X-WR-CALNAME:{tripName}
{VEVENT...}
END:VCALENDAR
```

### 4.2 VEVENT 欄位對應

每個 `spot`（有名稱者）產生一個 VEVENT：

| ICS 欄位 | 來源 | 備注 |
|----------|------|------|
| `SUMMARY` | `spot.name` | 景點名稱 |
| `DTSTART` | `day.date` + `slots[spot.id].start` | 組合為 `YYYYMMDDTHHmmss` |
| `DTEND` | `day.date` + `slots[spot.id].end` | 組合為 `YYYYMMDDTHHmmss` |
| `DESCRIPTION` | `spot.notes` | 備注，可為空 |
| `LOCATION` | `spot.name` | 同景點名稱（供地圖應用識別） |
| `UID` | `spot.id + '@tour-planner'` | 全局唯一識別碼 |

`day.date` 由 `tripStartDate` 加 day index 計算，格式 `YYYYMMDD`。

### 4.3 時間格式

時間以 floating time 格式（不附時區）輸出，避免時區問題：

```
DTSTART:20250615T090000
DTEND:20250615T113000
```

若 `slots[spot.id].start` 為 null（未設定出發時間），改以全天事件格式：

```
DTSTART;VALUE=DATE:20250615
DTEND;VALUE=DATE:20250616
```

### 4.4 ICS 字串逸出規則

| 字元 | 替換 |
|------|------|
| `\n` | `\\n` |
| `,` | `\,` |
| `;` | `\;` |
| `\` | `\\` |

行長超過 75 bytes 需折行（line folding）：下一行以一個空白字元開頭。

### 4.5 exportICS 函式草稿

```javascript
function exportICS() {
  function icsEsc(s) {
    return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;')
                    .replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  function toICSDate(dateStr, timeHHMM) {
    // dateStr: 'YYYY-MM-DD', timeHHMM: 'HH:MM' or null
    const d = dateStr.replace(/-/g, '');
    if (!timeHHMM) return `${d}`;
    const t = timeHHMM.replace(':', '') + '00';
    return `${d}T${t}`;
  }

  function getDayDateStr(dayIndex) {
    if (!state.tripStartDate) return null;
    const base = new Date(state.tripStartDate);
    base.setDate(base.getDate() + dayIndex);
    return base.toISOString().slice(0, 10);
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Tour Planner//ZH`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${icsEsc(state.tripName)}`,
  ];

  state.days.forEach((day, dayIdx) => {
    const dateStr = getDayDateStr(dayIdx);
    const slots = computeTimeline(day);

    day.spots.forEach(spot => {
      if (!spot.name.trim()) return;
      const sl = slots[spot.id];
      const hasTime = sl?.start && dateStr;

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${spot.id}@tour-planner`);
      lines.push(`SUMMARY:${icsEsc(spot.name)}`);

      if (hasTime) {
        lines.push(`DTSTART:${toICSDate(dateStr, sl.start)}`);
        lines.push(`DTEND:${toICSDate(dateStr, sl.end || sl.start)}`);
      } else if (dateStr) {
        const nextDate = new Date(dateStr);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().slice(0, 10).replace(/-/g, '');
        lines.push(`DTSTART;VALUE=DATE:${dateStr.replace(/-/g, '')}`);
        lines.push(`DTEND;VALUE=DATE:${nextDateStr}`);
      }

      lines.push(`LOCATION:${icsEsc(spot.name)}`);
      if (spot.notes?.trim()) lines.push(`DESCRIPTION:${icsEsc(spot.notes)}`);
      lines.push('END:VEVENT');
    });
  });

  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n') + '\r\n';
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${state.tripName}-${new Date().toISOString().slice(0,10)}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
```

---

## 5. 行為規範（邊界條件）

| 情況 | 行為 |
|------|------|
| 景點名稱為空 | ICS 中跳過該景點，不產生 VEVENT |
| `tripStartDate` 未設定 | ICS 中所有事件均無日期；`DTSTART;VALUE=DATE` 省略 → 整筆 VEVENT 跳過 |
| `day.startTime` 未設定 | `computeTimeline` 回傳空 slots；景點改以全天事件格式輸出（若有日期），否則跳過 |
| 景點有日期但無時間 | 輸出全天事件（`VALUE=DATE`） |
| 行程只有 1 天 | 正常輸出；無特殊處理 |
| 行程有 0 個景點 | ICS 產生空 VCALENDAR（無 VEVENT），仍正常下載 |
| 列印時為 Layout A 或 B | 只列印 `activeDayId` 對應的當天；不強制展開全部 |
| 景點備注含換行 | ICS 中以 `\\n` 逸出，DESCRIPTION 正確顯示換行 |

---

## 6. 實作要點

### 6.1 事件動作

在現有事件委派（`#app` 的 click handler）新增兩個 action：

| `data-action` | 行為 |
|---------------|------|
| `print-trip` | `localMenuOpen = false; render(); window.print();` |
| `export-ics` | `localMenuOpen = false; render(); exportICS();` |

`print-trip` 需先 `render()` 關閉選單，確保列印時選單下拉層不出現在畫面上。

### 6.2 CSS 插入位置

`@media print` 區塊插入 `<style>` 標籤末尾，所有既有規則之後。

### 6.3 `#print-header` 插入位置

在 `render()` 的 `document.getElementById('app').innerHTML = ...` 樣板最前方，`renderHeader()` 之前：

```javascript
document.getElementById('app').innerHTML = `
  ${renderPrintHeader()}
  ${renderHeader()}
  ...
`;
```

`renderPrintHeader()` 為新增輔助函式，回傳 `<div id="print-header">...</div>`。

### 6.4 `renderHelpOverlay()` 補充說明

在「💾 本地」說明區塊新增：

```html
<div class="help-item">• <b>列印 / PDF</b>：開啟瀏覽器列印對話框，可選「另存為 PDF」；建議先切換至 <b>Layout C（垂直捲動）</b>再列印，以一次輸出全部天數</div>
<div class="help-item">• <b>匯出行事曆 (.ics)</b>：下載 .ics 檔案，可匯入 Google 日曆、Apple 行事曆等；需先設定<b>旅行開始日期</b>才能包含正確日期</div>
```

### 6.5 不需要的依賴

全部功能均使用瀏覽器原生 API：
- `window.print()`（列印）
- `Blob` + `URL.createObjectURL`（已用於 `exportJSON`，直接沿用相同模式）

無需引入任何第三方函式庫。

---

## 不在本次範圍內

- 選擇「只匯出特定幾天」的功能
- 自訂列印版面配色
- 直接產生 PDF 二進位（不經系統對話框）
- ICS 時區（TZID）支援
- 匯出 CSV 或 Excel 格式
