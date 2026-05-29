# 多格式匯出（列印/PDF/行事曆）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有 JSON 匯出基礎上，新增列印/PDF（@media print）與 ICS 行事曆匯出功能

**Architecture:** @media print CSS 隱藏 UI 元件並加入靜態標題區；exportICS() 函式沿用 exportJSON() 的 Blob 下載模式；兩個新 action 整合到現有「💾 本地」下拉選單。

**Tech Stack:** Vanilla JS/CSS/HTML，@media print，ICS RFC 5545 格式，無外部依賴

---

## 總覽

| 步驟 | 內容 | 估時 |
|------|------|------|
| Task 1 | 新增 `@media print` CSS 區塊 | 3 min |
| Task 2 | 新增 `#print-header` 靜態標題與 `renderPrintHeader()` | 3 min |
| Task 3 | 更新 `renderHeader()` 選單 HTML | 2 min |
| Task 4 | 新增 `exportICS()` 函式 | 3 min |
| Task 5 | 新增事件 action handlers | 2 min |
| Task 6 | 更新 `renderHelpOverlay()` 說明文字 | 2 min |
| Task 7 | 手動瀏覽器驗證 | 5 min |
| Task 8 | Git commit | 1 min |

**唯一修改檔案：** `/media/weichen/4TB/tmp/clau/tour/tour-planner.html`

---

## Task 1 — 新增 `@media print` CSS 區塊

**位置：** `tour-planner.html` line 694（`  </style>` 前一行 693 的空行之後，即 line 693 的 `}` 閉括號後、line 694 `  </style>` 之前）

**操作：** 在 line 693 結尾（`    }`，最後一個 CSS rule 的閉括號）與 line 694（`  </style>`）之間插入以下 CSS 區塊。

**插入內容（verbatim）：**

```css

    /* ===== Print ===== */
    #print-header { display: none; }

    @media print {
      /* Show print header */
      #print-header {
        display: block;
        text-align: center;
        margin-bottom: 16px;
        padding-bottom: 10px;
        border-bottom: 2px solid #333;
      }
      .print-trip-name { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
      .print-trip-date { font-size: 13px; color: #555; margin: 0; }

      /* Hide UI chrome */
      .app-header          { display: none; }
      .settings-panel      { display: none; }
      .day-tabs            { display: none; }
      .day-sidebar         { display: none; }
      .day-switch-wrap     { display: none; }
      .share-overlay       { display: none; }
      .help-overlay        { display: none; }
      .trips-overlay       { display: none; }
      .btn-add             { display: none; }
      .drag-handle         { display: none; }
      .duration-group      { display: none; }
      .day-header .btn-ghost   { display: none; }
      .spot-card  .btn-accent  { display: none; }
      .spot-card  .btn-ghost   { display: none; }
      .route-connector a       { display: none; }
      .route-connector select  { display: none; }
      .route-connector .duration-group { display: none; }

      /* Layout adjustments */
      .layout-b-wrap { display: block; }
      .day-content   { width: 100%; }

      /* Page breaks */
      .day-section        { page-break-inside: avoid; }
      .spot-card          { page-break-inside: avoid; }
      .day-section-header { page-break-after: avoid; }

      /* Colour reset */
      * { color: #000 !important; background: #fff !important; }
      .time-badge { color: #333 !important; font-weight: 600; }
      .route-connector .route-line { border-color: #aaa !important; }
      a { text-decoration: none !important; }
    }
```

**実作手順：**

- [ ] 開啟 `tour-planner.html`，找到 line 693（最後一個 CSS rule 結尾的 `    }`）和 line 694（`  </style>`）
- [ ] 在兩者之間插入上方完整 CSS 區塊（包含 `/* ===== Print ===== */` 注釋）

**old_string（Edit 工具用）：**
```
    .trip-list-btn.active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent-bd); }
    .trip-list-btn:hover { opacity: 0.8; }

  </style>
```

**new_string（Edit 工具用）：**
```
    .trip-list-btn.active { background: var(--accent-bg); color: var(--accent); border-color: var(--accent-bd); }
    .trip-list-btn:hover { opacity: 0.8; }

    /* ===== Print ===== */
    #print-header { display: none; }

    @media print {
      /* Show print header */
      #print-header {
        display: block;
        text-align: center;
        margin-bottom: 16px;
        padding-bottom: 10px;
        border-bottom: 2px solid #333;
      }
      .print-trip-name { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
      .print-trip-date { font-size: 13px; color: #555; margin: 0; }

      /* Hide UI chrome */
      .app-header          { display: none; }
      .settings-panel      { display: none; }
      .day-tabs            { display: none; }
      .day-sidebar         { display: none; }
      .day-switch-wrap     { display: none; }
      .share-overlay       { display: none; }
      .help-overlay        { display: none; }
      .trips-overlay       { display: none; }
      .btn-add             { display: none; }
      .drag-handle         { display: none; }
      .duration-group      { display: none; }
      .day-header .btn-ghost   { display: none; }
      .spot-card  .btn-accent  { display: none; }
      .spot-card  .btn-ghost   { display: none; }
      .route-connector a       { display: none; }
      .route-connector select  { display: none; }
      .route-connector .duration-group { display: none; }

      /* Layout adjustments */
      .layout-b-wrap { display: block; }
      .day-content   { width: 100%; }

      /* Page breaks */
      .day-section        { page-break-inside: avoid; }
      .spot-card          { page-break-inside: avoid; }
      .day-section-header { page-break-after: avoid; }

      /* Colour reset */
      * { color: #000 !important; background: #fff !important; }
      .time-badge { color: #333 !important; font-weight: 600; }
      .route-connector .route-line { border-color: #aaa !important; }
      a { text-decoration: none !important; }
    }

  </style>
```

---

## Task 2 — 新增 `renderPrintHeader()` 與在 `render()` 插入

### 2a — 新增 `renderPrintHeader()` 函式

**位置：** `tour-planner.html`，`renderHeader()` 函式（line 1698）的正上方

**插入內容（verbatim）：**

```javascript
    function renderPrintHeader() {
      return `<div id="print-header">
        <h1 class="print-trip-name">${escHtml(state.tripName)}</h1>
        ${state.tripStartDate
          ? `<p class="print-trip-date">${escHtml(state.tripStartDate)} 出發</p>`
          : ''}
      </div>`;
    }

```

**old_string（Edit 工具用）：**
```
    function renderHeader() {
      return `
        <header class="app-header">
```

**new_string（Edit 工具用）：**
```
    function renderPrintHeader() {
      return `<div id="print-header">
        <h1 class="print-trip-name">${escHtml(state.tripName)}</h1>
        ${state.tripStartDate
          ? `<p class="print-trip-date">${escHtml(state.tripStartDate)} 出發</p>`
          : ''}
      </div>`;
    }

    function renderHeader() {
      return `
        <header class="app-header">
```

### 2b — 在 `render()` 的 innerHTML 樣板最前方加入 `renderPrintHeader()`

**位置：** `tour-planner.html` line 1852–1860（`render()` 函式內的 `innerHTML` 賦值），現在的樣板是：

```javascript
      document.getElementById('app').innerHTML = `
        ${renderHeader()}
        ${renderSettingsPanel()}
        <main id="main-area" style="flex:1;display:flex;flex-direction:column">
          ${mainContent}
        </main>
        ${renderShareOverlay()}
        ${renderHelpOverlay()}
        ${renderTripsOverlay()}`;
```

**修改為（verbatim）：**

```javascript
      document.getElementById('app').innerHTML = `
        ${renderPrintHeader()}
        ${renderHeader()}
        ${renderSettingsPanel()}
        <main id="main-area" style="flex:1;display:flex;flex-direction:column">
          ${mainContent}
        </main>
        ${renderShareOverlay()}
        ${renderHelpOverlay()}
        ${renderTripsOverlay()}`;
```

**old_string（Edit 工具用）：**
```
      document.getElementById('app').innerHTML = `
        ${renderHeader()}
        ${renderSettingsPanel()}
```

**new_string（Edit 工具用）：**
```
      document.getElementById('app').innerHTML = `
        ${renderPrintHeader()}
        ${renderHeader()}
        ${renderSettingsPanel()}
```

---

## Task 3 — 更新 `renderHeader()` 選單 HTML

**位置：** `tour-planner.html` lines 1712–1720（`localMenuOpen` 條件下拉選單內容）

**現有程式碼（lines 1712–1720）：**
```javascript
              ${localMenuOpen ? `
                <div data-action="close-local-menu" style="position:fixed;inset:0;z-index:99"></div>
                <div style="position:absolute;right:0;top:100%;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:6px;min-width:130px;box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:100;overflow:hidden">
                  <button data-action="export-json" style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:13px;cursor:pointer">📤 匯出 JSON</button>
                  <label style="display:block;cursor:pointer;padding:8px 12px;color:var(--text);font-size:13px">
                    📥 匯入 JSON
                    <input type="file" accept=".json" data-action="import-json" style="display:none">
                  </label>
                </div>` : ''}
```

**修改為（verbatim）：**
```javascript
              ${localMenuOpen ? `
                <div data-action="close-local-menu" style="position:fixed;inset:0;z-index:99"></div>
                <div style="position:absolute;right:0;top:100%;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:6px;min-width:160px;box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:100;overflow:hidden">
                  <button data-action="export-json" style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:13px;cursor:pointer">📤 匯出 JSON</button>
                  <label style="display:block;cursor:pointer;padding:8px 12px;color:var(--text);font-size:13px">
                    📥 匯入 JSON
                    <input type="file" accept=".json" data-action="import-json" style="display:none">
                  </label>
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
                </div>` : ''}
```

**old_string（Edit 工具用）：**
```
              ${localMenuOpen ? `
                <div data-action="close-local-menu" style="position:fixed;inset:0;z-index:99"></div>
                <div style="position:absolute;right:0;top:100%;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:6px;min-width:130px;box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:100;overflow:hidden">
                  <button data-action="export-json" style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:13px;cursor:pointer">📤 匯出 JSON</button>
                  <label style="display:block;cursor:pointer;padding:8px 12px;color:var(--text);font-size:13px">
                    📥 匯入 JSON
                    <input type="file" accept=".json" data-action="import-json" style="display:none">
                  </label>
                </div>` : ''}
```

**new_string（Edit 工具用）：**
```
              ${localMenuOpen ? `
                <div data-action="close-local-menu" style="position:fixed;inset:0;z-index:99"></div>
                <div style="position:absolute;right:0;top:100%;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:6px;min-width:160px;box-shadow:0 4px 12px rgba(0,0,0,0.25);z-index:100;overflow:hidden">
                  <button data-action="export-json" style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:13px;cursor:pointer">📤 匯出 JSON</button>
                  <label style="display:block;cursor:pointer;padding:8px 12px;color:var(--text);font-size:13px">
                    📥 匯入 JSON
                    <input type="file" accept=".json" data-action="import-json" style="display:none">
                  </label>
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
                </div>` : ''}
```

**注意：** `min-width` 由 `130px` 改為 `160px`，以容納較長的按鈕文字。

---

## Task 4 — 新增 `exportICS()` 函式

**位置：** `tour-planner.html`，`exportJSON()` 函式（lines 993–1001）結束後，緊接著 `importJSON()` 函式（line 1003）之前

**插入內容（verbatim，原始碼完整貼上）：**

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
          } else {
            // no date at all — skip this event
            lines.pop(); // remove SUMMARY
            lines.pop(); // remove UID
            lines.pop(); // remove BEGIN:VEVENT
            return;
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

**old_string（Edit 工具用）：**
```
    function importJSON(file) {
```

**new_string（Edit 工具用）：**
```
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
          } else {
            // no date at all — skip this event
            lines.pop(); // remove SUMMARY
            lines.pop(); // remove UID
            lines.pop(); // remove BEGIN:VEVENT
            return;
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

    function importJSON(file) {
```

**設計備注：** `exportICS()` 中新增了當 `dateStr` 為 null 時回滾已 push 的三行並 `return` 的邏輯。這是對 spec 第 5 節「`tripStartDate` 未設定 → 整筆 VEVENT 跳過」的精確實作，與 spec 4.5 的草稿相容。

---

## Task 5 — 新增事件 action handlers

**位置：** `tour-planner.html` line 2151（現有 `export-json` action 處理之後）

**現有程式碼（line 2151）：**
```javascript
        if (action === 'export-json')     { localMenuOpen = false; exportJSON(); return; }
```

**修改為（verbatim）：**
```javascript
        if (action === 'export-json')     { localMenuOpen = false; exportJSON(); return; }
        if (action === 'print-trip')      { localMenuOpen = false; render(); window.print(); return; }
        if (action === 'export-ics')      { localMenuOpen = false; render(); exportICS(); return; }
```

**old_string（Edit 工具用）：**
```
        if (action === 'export-json')     { localMenuOpen = false; exportJSON(); return; }
```

**new_string（Edit 工具用）：**
```
        if (action === 'export-json')     { localMenuOpen = false; exportJSON(); return; }
        if (action === 'print-trip')      { localMenuOpen = false; render(); window.print(); return; }
        if (action === 'export-ics')      { localMenuOpen = false; render(); exportICS(); return; }
```

**設計備注：** `print-trip` 與 `export-ics` 都先呼叫 `render()` 再執行動作，確保下拉選單在列印預覽/下載時已關閉（spec 6.1 的要求）。

---

## Task 6 — 更新 `renderHelpOverlay()` 說明文字

**位置：** `tour-planner.html` lines 1640–1643（「💾 本地」help section）

**現有程式碼（lines 1640–1643）：**
```javascript
                <div class="help-section-title">💾 本地</div>
                <div class="help-item">• 點 <b>💾 本地 ▾</b> 展開選單，可選擇 <b>📤 匯出 JSON</b> 或 <b>📥 匯入 JSON</b></div>
                <div class="help-item">• <b>匯出</b>：將目前行程儲存為 .json 檔案，可作為備份</div>
                <div class="help-item">• <b>匯入</b>：選擇之前匯出的 .json 檔案還原行程（會覆蓋目前行程）</div>
```

**修改為（verbatim）：**
```javascript
                <div class="help-section-title">💾 本地</div>
                <div class="help-item">• 點 <b>💾 本地 ▾</b> 展開選單，可選擇 <b>📤 匯出 JSON</b> 或 <b>📥 匯入 JSON</b></div>
                <div class="help-item">• <b>匯出</b>：將目前行程儲存為 .json 檔案，可作為備份</div>
                <div class="help-item">• <b>匯入</b>：選擇之前匯出的 .json 檔案還原行程（會覆蓋目前行程）</div>
                <div class="help-item">• <b>列印 / PDF</b>：開啟瀏覽器列印對話框，可選「另存為 PDF」；建議先切換至 <b>Layout C（垂直捲動）</b>再列印，以一次輸出全部天數</div>
                <div class="help-item">• <b>匯出行事曆 (.ics)</b>：下載 .ics 檔案，可匯入 Google 日曆、Apple 行事曆等；需先設定<b>旅行開始日期</b>才能包含正確日期</div>
```

**old_string（Edit 工具用）：**
```
                <div class="help-section-title">💾 本地</div>
                <div class="help-item">• 點 <b>💾 本地 ▾</b> 展開選單，可選擇 <b>📤 匯出 JSON</b> 或 <b>📥 匯入 JSON</b></div>
                <div class="help-item">• <b>匯出</b>：將目前行程儲存為 .json 檔案，可作為備份</div>
                <div class="help-item">• <b>匯入</b>：選擇之前匯出的 .json 檔案還原行程（會覆蓋目前行程）</div>
```

**new_string（Edit 工具用）：**
```
                <div class="help-section-title">💾 本地</div>
                <div class="help-item">• 點 <b>💾 本地 ▾</b> 展開選單，可選擇 <b>📤 匯出 JSON</b> 或 <b>📥 匯入 JSON</b></div>
                <div class="help-item">• <b>匯出</b>：將目前行程儲存為 .json 檔案，可作為備份</div>
                <div class="help-item">• <b>匯入</b>：選擇之前匯出的 .json 檔案還原行程（會覆蓋目前行程）</div>
                <div class="help-item">• <b>列印 / PDF</b>：開啟瀏覽器列印對話框，可選「另存為 PDF」；建議先切換至 <b>Layout C（垂直捲動）</b>再列印，以一次輸出全部天數</div>
                <div class="help-item">• <b>匯出行事曆 (.ics)</b>：下載 .ics 檔案，可匯入 Google 日曆、Apple 行事曆等；需先設定<b>旅行開始日期</b>才能包含正確日期</div>
```

---

## Task 7 — 手動瀏覽器驗證

> **前提：** 以靜態伺服器開啟（避免 CORS 問題）：
> ```bash
> cd /media/weichen/4TB/tmp/clau/tour && python3 -m http.server 8080
> ```
> 瀏覽器開啟 `http://localhost:8080/tour-planner.html`

### 7a — 選單顯示驗證

- [ ] 點選「💾 本地 ▾」，確認下拉選單出現四個項目：
  - 📤 匯出 JSON
  - 📥 匯入 JSON
  - 分隔線（水平線）
  - 🖨 列印 / PDF
  - 📅 匯出行事曆 (.ics)
- [ ] 確認分隔線可見（細水平線）
- [ ] 確認選單寬度足以容納「📅 匯出行事曆 (.ics)」文字

### 7b — 列印驗證

- [ ] 在行程中新增至少 2 天，每天各加入 2 個景點
- [ ] 設定旅行開始日期
- [ ] 設定 `startTime`（出發時間）以確保時間軸計算正常
- [ ] 點「🖨 列印 / PDF」，確認瀏覽器列印對話框開啟
- [ ] 在列印預覽中確認：
  - `#print-header` 顯示旅程名稱與出發日期
  - 頂部 header（`app-header`）不顯示
  - 景點卡片中的刪除按鈕、拖曳把手、停留時間選擇器不顯示
  - 交通路線的下拉選單（交通方式 select）不顯示
  - 時間徽章（時刻）正常顯示
- [ ] **Layout C 全天列印：** 切換至 Layout C，點列印，確認所有天數都出現在預覽中
- [ ] **Layout A/B 部分列印：** 切換至 Layout A，只切換到第 2 天，點列印，確認只顯示第 2 天

### 7c — ICS 匯出驗證（有設定開始日期）

- [ ] 確認已設定 `tripStartDate`（旅行開始日期）
- [ ] 確認有景點且景點有名稱、設定了 `startTime`
- [ ] 點「📅 匯出行事曆 (.ics)」，確認瀏覽器觸發下載
- [ ] 檢查下載的 `.ics` 檔名格式為 `{旅程名稱}-{YYYY-MM-DD}.ics`
- [ ] 以文字編輯器開啟 `.ics`，確認：
  - 開頭為 `BEGIN:VCALENDAR`
  - 包含 `PRODID:-//Tour Planner//ZH`
  - 包含 `X-WR-CALNAME:` 行
  - 每個景點有 `BEGIN:VEVENT` ... `END:VEVENT` 區塊
  - `DTSTART` 與 `DTEND` 格式為 `YYYYMMDDTHHmmss`（有時間）
  - 結尾為 `END:VCALENDAR`
- [ ] （可選）將 `.ics` 匯入 Google 日曆或 Apple 行事曆，確認事件出現在正確日期

### 7d — ICS 匯出驗證（未設定開始日期）

- [ ] 清除旅行開始日期欄位（設為空）
- [ ] 點「📅 匯出行事曆 (.ics)」
- [ ] 以文字編輯器開啟 `.ics`，確認：
  - 檔案存在且格式有效
  - 無 `DTSTART` / `DTEND` 行（景點全部被跳過）
  - 檔案只有 VCALENDAR 外殼，無 VEVENT

### 7e — 邊界條件驗證

- [ ] 景點名稱為空時：ICS 中無對應 VEVENT
- [ ] 備注含換行字元時：ICS 中 `DESCRIPTION` 以 `\\n` 呈現（檢查原始文字）
- [ ] 備注含逗號（`,`）與分號（`;`）時：ICS 中正確逸出為 `\,` 與 `\;`

---

## Task 8 — Git commit

```bash
cd /media/weichen/4TB/tmp/clau/tour
git add tour-planner.html
git commit -m "feat: add print/PDF and ICS calendar export

- Add @media print CSS: hide UI chrome, show print header, enforce page breaks
- Add renderPrintHeader() for static trip name/date display during print
- Extend local menu with 🖨 列印/PDF and 📅 匯出行事曆 (.ics) buttons
- Add exportICS() following exportJSON() Blob download pattern (RFC 5545)
- Add print-trip and export-ics action handlers in event delegation
- Update renderHelpOverlay() with usage tips for both new features"
```

---

## 參考：關鍵行號對照表

| 區塊 | 行號 | 說明 |
|------|------|------|
| `</style>` | 694 | CSS 區塊插入點（在此之前） |
| `exportJSON()` | 993–1001 | ICS 函式插入點（在 importJSON 前） |
| `importJSON()` | 1003 | `exportICS()` 插入後緊接此函式 |
| `localMenuOpen` 宣告 | 1111 | 現有 UI 狀態變數 |
| `renderHelpOverlay()` | 1617 | 說明頁面函式 |
| 「💾 本地」help section | 1640–1643 | 新增兩行說明 |
| `renderHeader()` | 1698 | `renderPrintHeader()` 插入點（在此之前） |
| 本地選單 HTML | 1712–1720 | 選單擴充插入點 |
| `render()` innerHTML | 1852–1860 | `renderPrintHeader()` 加入點 |
| `export-json` action | 2151 | 新 action handlers 插入點 |

---

## 邊界條件速查（spec §5 對照）

| 情況 | 實作行為 |
|------|----------|
| 景點名稱為空 | `if (!spot.name.trim()) return` 跳過 |
| `tripStartDate` 未設定 | `getDayDateStr` 回傳 `null`；`else` 分支 pop 三行並 return |
| `day.startTime` 未設定 | `computeTimeline` 回傳空 slots；`hasTime` 為 false；有日期則全天事件 |
| 景點有日期但無時間 | `VALUE=DATE` 全天事件格式 |
| 行程 0 個景點 | 空 VCALENDAR 正常下載 |
| Layout A/B 列印 | 只顯示 `activeDayId` 對應的當天（天然行為，無需特殊處理） |
| 備注含換行 | `icsEsc` 的 `.replace(/\n/g, '\\n')` 處理 |
