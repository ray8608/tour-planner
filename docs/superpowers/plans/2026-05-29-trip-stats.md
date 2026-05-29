# 行程統計摘要 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在每天行程底部顯示統計列（景點數、停留/交通/總時長），設定面板加入全程統計

**Architecture:** 新增 computeDayStats(day, slots) 純計算函式，renderDayStatsBar(stats) 渲染 HTML，在 renderDaySpots() 底部插入；全程統計 computeTripStats() 整合到 renderSettingsPanel()。無新 state 欄位，無 localStorage 變更。

**Tech Stack:** Vanilla JS/CSS/HTML，無框架，無外部依賴

---

## 檔案位置總覽

唯一需要修改的檔案：`tour-planner.html`

關鍵行號（已驗證）：
- L513–L527：`.route-connector` CSS 區塊（新 CSS 插入於此之後）
- L904–L939：`computeTimeline(day)` 函式（新 JS 函式插入於此之後）
- L1295–L1324：`renderDaySpots(day)` 函式（L1322 插入 stats bar）
- L1345–L1391：`renderSettingsPanel()` 函式（L1389 的 `</div>` 之前插入全程統計）
- L866：`hotelStartId(dayId)` / `hotelEndId(dayId)` 輔助函式（已存在，直接使用）
- L891：`routeKey(fromId, toId)` 輔助函式（已存在，直接使用）

---

## 任務一：新增 CSS 樣式

- [ ] **1.1** 在 `tour-planner.html` 的 L527（`.route-transport { ... }` 區塊結尾的 `}` 之後）插入以下 CSS，位於第 528 行之前（`/* ===== Font size bump... */` 注解之前）：

  **old_string（L527 結尾）：**
  ```
      .route-transport {
        background: var(--input-bg);
        border: 1px solid var(--border);
        color: var(--text-muted);
        border-radius: 3px;
        padding: 2px 4px;
        font-size: 11px;
      }
      /* ===== Font size bump (16px base) ===== */
  ```

  **new_string（插入 CSS 後）：**
  ```
      .route-transport {
        background: var(--input-bg);
        border: 1px solid var(--border);
        color: var(--text-muted);
        border-radius: 3px;
        padding: 2px 4px;
        font-size: 11px;
      }
      /* ===== Day Stats Bar ===== */
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
      /* ===== Trip Stats (settings panel) ===== */
      .trip-stats-grid {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 12px;
        font-size: 12px;
      }
      .trip-stats-label { color: var(--text-muted); }
      .trip-stats-value { color: var(--text); font-weight: 600; text-align: right; }
      /* ===== Font size bump (16px base) ===== */
  ```

- [ ] **1.2** 瀏覽器驗證：開啟 `tour-planner.html`，開啟 DevTools → Elements，確認 `.day-stats-bar` class 存在於 stylesheet，頁面無 JS 錯誤。

---

## 任務二：新增 computeDayStats() 純計算函式

- [ ] **2.1** 在 `computeTimeline(day)` 函式結尾（L939 的 `}` 之後，L941 `function formatTimeBadge` 之前）插入 `computeDayStats` 函式。

  **old_string（L939–L941 片段）：**
  ```
      return slots;
    }

    function formatTimeBadge(slot) {
  ```

  **new_string（插入函式後）：**
  ```
      return slots;
    }

    function computeDayStats(day, slots) {
      const spotCount = day.spots.length;

      // 總停留時間（分鐘）
      const stayTotal = day.spots.reduce((s, sp) => s + (sp.stayDuration || 0), 0);

      // 總交通時間（分鐘）：飯店→第1景點、各景點間、最後景點→飯店
      let transitTotal = 0;
      if (day.spots.length > 0) {
        const allFromIds = [hotelStartId(day.id), ...day.spots.slice(0, -1).map(s => s.id)];
        const allToIds   = [...day.spots.map(s => s.id), hotelEndId(day.id)];
        allFromIds.forEach((fromId, i) => {
          const rk = routeKey(fromId, allToIds[i]);
          transitTotal += (state.routes[rk] || {}).recordedTime || 0;
        });
      }

      // 行程總時長（分鐘）：需要 startTime 且最終返回時間有值
      let totalMins = null;
      const endSlot = slots[hotelEndId(day.id)];
      if (day.startTime && endSlot && endSlot.start) {
        const toMins = t => parseInt(t.split(':')[0]) * 60 + parseInt(t.split(':')[1]);
        let diff = toMins(endSlot.start) - toMins(day.startTime);
        if (diff < 0) diff += 1440; // 跨午夜
        totalMins = diff;
      }

      // 空閒時間（totalMins 為 null 時也為 null）
      const freeMins = (totalMins !== null) ? (totalMins - stayTotal - transitTotal) : null;

      return { spotCount, stayTotal, transitTotal, totalMins, freeMins };
    }

    function formatTimeBadge(slot) {
  ```

- [ ] **2.2** 瀏覽器驗證：開啟 DevTools Console，輸入以下指令確認函式存在且無錯誤：
  ```javascript
  typeof computeDayStats
  // 預期輸出：'function'
  ```

---

## 任務三：新增 renderDayStatsBar() 渲染函式

- [ ] **3.1** 在 `computeDayStats` 函式之後（即 `function formatTimeBadge(slot)` 之前）再插入 `renderDayStatsBar` 函式。

  **old_string（承接任務二 new_string 後的 L941 片段）：**
  ```
    function formatTimeBadge(slot) {
      if (!slot || !slot.start) return '';
      if (!slot.end || slot.start === slot.end) return slot.start;
      return `${slot.start}\n${slot.end}`;
    }
  ```

  **new_string（插入函式後）：**
  ```
    function renderDayStatsBar(stats) {
      if (stats.spotCount === 0) return '';

      function fmtMins(m) {
        if (!m || m <= 0) return null;
        const h = Math.floor(m / 60);
        const min = m % 60;
        if (h > 0 && min > 0) return `${h}h ${min}m`;
        if (h > 0) return `${h}h`;
        return `${min}m`;
      }

      const sep = `<span class="day-stats-sep">·</span>`;
      const parts = [];

      parts.push(`<span>${stats.spotCount} 個景點</span>`);

      const stayStr = fmtMins(stats.stayTotal);
      if (stayStr) parts.push(`<span>停留 ${stayStr}</span>`);

      const transitStr = fmtMins(stats.transitTotal);
      if (transitStr) parts.push(`<span>交通 ${transitStr}</span>`);

      if (stats.totalMins !== null) {
        const totalStr = fmtMins(stats.totalMins);
        if (totalStr) parts.push(`<span>共 ${totalStr}</span>`);
      }

      let overtime = '';
      if (stats.freeMins !== null && stats.freeMins < 0) {
        const overStr = fmtMins(Math.abs(stats.freeMins));
        overtime = `<span class="day-stats-overtime">⚠ 超時 ${overStr || '0m'}</span>`;
      }

      return `<div class="day-stats-bar">${parts.join(sep)}${overtime}</div>`;
    }

    function formatTimeBadge(slot) {
      if (!slot || !slot.start) return '';
      if (!slot.end || slot.start === slot.end) return slot.start;
      return `${slot.start}\n${slot.end}`;
    }
  ```

- [ ] **3.2** 瀏覽器驗證：DevTools Console 確認函式存在：
  ```javascript
  typeof renderDayStatsBar
  // 預期輸出：'function'
  ```

---

## 任務四：修改 renderDaySpots() 插入統計列

- [ ] **4.1** 在 `renderDaySpots(day)` 函式（L1295–L1324）中，找到 `renderHotelEndMarker` 之後、`btn-add` 之前的行，插入統計列。

  **old_string（L1321–L1323）：**
  ```
      html += `</div>`;
      html += renderHotelEndMarker(day, slots);
      html += `<button class="btn-add" data-action="add-spot" data-day-id="${day.id}">＋ 新增景點</button>`;
      return html;
  ```

  **new_string（插入 stats bar）：**
  ```
      html += `</div>`;
      html += renderHotelEndMarker(day, slots);
      html += renderDayStatsBar(computeDayStats(day, slots));
      html += `<button class="btn-add" data-action="add-spot" data-day-id="${day.id}">＋ 新增景點</button>`;
      return html;
  ```

- [ ] **4.2** 瀏覽器驗證（每日統計列）：
  - 開啟 `tour-planner.html`，確認每天底部（飯店返回標記之後、「＋ 新增景點」之前）出現統計列
  - 有景點時：顯示「X 個景點」及停留/交通資訊
  - 無景點時：不顯示統計列（僅顯示「＋ 新增景點」）
  - Layout A、B、C 三種版面均出現統計列（因為三種 layout 都呼叫 `renderDaySpots`）

---

## 任務五：新增 computeTripStats() 並修改 renderSettingsPanel()

- [ ] **5.1** 在 `renderDayStatsBar` 函式之後（`function formatTimeBadge` 之前）再插入 `computeTripStats` 函式。

  **old_string（承接任務三 new_string 後的片段）：**
  ```
    function formatTimeBadge(slot) {
      if (!slot || !slot.start) return '';
      if (!slot.end || slot.start === slot.end) return slot.start;
      return `${slot.start}\n${slot.end}`;
    }
  ```

  **new_string（插入函式後）：**
  ```
    function computeTripStats() {
      const totalDays  = state.days.length;
      const totalSpots = state.days.reduce((s, d) => s + d.spots.length, 0);
      const routes     = Object.values(state.routes);
      const walkCount    = routes.filter(r => r.transport === 'walking').length;
      const driveCount   = routes.filter(r => r.transport === 'driving').length;
      const transitCount = routes.filter(r => r.transport === 'transit').length;
      return { totalDays, totalSpots, walkCount, driveCount, transitCount };
    }

    function formatTimeBadge(slot) {
      if (!slot || !slot.start) return '';
      if (!slot.end || slot.start === slot.end) return slot.start;
      return `${slot.start}\n${slot.end}`;
    }
  ```

- [ ] **5.2** 在 `renderSettingsPanel()` 函式（L1345–L1391）的最後一個 `</div>` 之前插入全程統計區塊。

  目前結尾（L1388–L1390）如下：
  ```
              </div>
            </div>
          </div>
        </div>`;
  ```

  其中最後四行對應的是：最後一個 `.settings-group` 的 `</div>`、`.settings-panel` 的 `</div>`、`.settings-overlay` 的 `</div>`，以及模板字串結尾。

  **old_string（L1381–L1391，最後一個 settings-group 起）：**
  ```
            <div class="settings-group">
              <div class="settings-label">預設交通方式</div>
              <div class="toggle-group">
                ${tb('defaultTransport','driving','🚗 開車')}
                ${tb('defaultTransport','transit','🚌 大眾')}
                ${tb('defaultTransport','walking','🚶 步行')}
              </div>
            </div>
          </div>
        </div>`;
  ```

  **new_string（附加全程統計區塊）：**
  ```
            <div class="settings-group">
              <div class="settings-label">預設交通方式</div>
              <div class="toggle-group">
                ${tb('defaultTransport','driving','🚗 開車')}
                ${tb('defaultTransport','transit','🚌 大眾')}
                ${tb('defaultTransport','walking','🚶 步行')}
              </div>
            </div>
            ${(() => {
              const ts = computeTripStats();
              return `<div class="settings-group">
              <div class="settings-label">📊 行程統計</div>
              <div class="trip-stats-grid">
                <span class="trip-stats-label">總天數</span>
                <span class="trip-stats-value">${ts.totalDays} 天</span>
                <span class="trip-stats-label">總景點數</span>
                <span class="trip-stats-value">${ts.totalSpots} 個</span>
                <span class="trip-stats-label">🚗 開車</span>
                <span class="trip-stats-value">${ts.driveCount} 次</span>
                <span class="trip-stats-label">🚌 大眾運輸</span>
                <span class="trip-stats-value">${ts.transitCount} 次</span>
                <span class="trip-stats-label">🚶 步行</span>
                <span class="trip-stats-value">${ts.walkCount} 次</span>
              </div>
            </div>`;
            })()}
          </div>
        </div>`;
  ```

- [ ] **5.3** 瀏覽器驗證（全程統計）：
  - 點擊右上角設定按鈕（⚙️），確認設定面板底部出現「📊 行程統計」區塊
  - 顯示：總天數、總景點數、🚗/🚌/🚶 各交通方式次數
  - 計數為 0 時仍顯示「0 次」，不隱藏
  - 新增景點或設定路線交通方式後，重新開啟設定面板，數字應即時更新（因為每次 render() 重新生成 innerHTML）

---

## 任務六：超時情境驗證

- [ ] **6.1** 測試超時顯示：
  - 新增一天，設定出發時間 `08:00`
  - 新增 3 個景點，每個停留時間設為 `3h`（共 9h）
  - 設定各路線交通時間 `30m` 共 4 段（共 2h）
  - 統計列應顯示：`3 個景點 · 停留 9h · 交通 2h · 共 11h ⚠ 超時 Xm`（若 startTime 08:00 + 11h = 19:00，沒超時；調整使超時）
  - 若要觸發超時：設定出發時間 `08:00`，景點各停留 `4h`（3個=12h），路線各 `1h`（4段=4h），共 16h，返回 00:00，diff = -8h（加 1440 = 1360m），但實際行程超出一天則顯示超時

  **簡單測試超時的方法：**
  - 設出發時間 `22:00`（晚上）
  - 一個景點停留 `2h`
  - 返回路線 `30m`
  - 預期：totalMins 為 150m（2.5h），不超時
  - 改為停留 `5h` + 返回 `1h`：totalMins = 360m，不超時（endSlot.start = 04:00，diff = 06:00 in mins，跨午夜加 1440 → 正值）
  - 最可靠觸發超時：在 Console 直接測試：
    ```javascript
    // 假設 day 存在：
    const day = state.days[0];
    const slots = computeTimeline(day);
    const stats = computeDayStats(day, slots);
    console.log(stats);
    // 確認 freeMins 為負時，stats bar 顯示 ⚠ 超時
    ```

- [ ] **6.2** 確認無 startTime 情況：
  - 清除某天的出發時間（設為空）
  - 統計列仍顯示「X 個景點 · 停留 Xh」，但不顯示「共 Xh」（totalMins 為 null）

---

## 任務七：Git Commit

- [ ] **7.1** 確認最終狀態無 console.log、無 TODO、無 HACK 殘留：
  ```bash
  grep -n "console\.log\|TODO\|HACK\|debugger" /media/weichen/4TB/tmp/clau/tour/tour-planner.html
  ```
  （預期：無新增的 debug 輸出）

- [ ] **7.2** Git commit：
  ```bash
  cd /media/weichen/4TB/tmp/clau/tour && git add tour-planner.html && git commit -m "feat: add day stats bar and trip stats panel

  - computeDayStats(day, slots): pure fn — spotCount, stayTotal,
    transitTotal, totalMins (null when no startTime), freeMins
  - renderDayStatsBar(stats): returns HTML string, shown after
    hotel-end marker and before add-spot button in renderDaySpots()
  - computeTripStats(): reads state.days + state.routes for global
    totals (days, spots, walk/drive/transit counts)
  - Settings panel: trip stats grid appended as last settings-group
  - CSS: .day-stats-bar, .day-stats-sep, .day-stats-overtime,
    .trip-stats-grid, .trip-stats-label, .trip-stats-value
  - No new state fields, no localStorage schema change"
  ```

---

## 邊界條件速查

| 情境 | 預期行為 |
|------|---------|
| `spotCount === 0` | `renderDayStatsBar` 回傳空字串，不渲染 |
| `stayTotal === 0` | 停留欄位不顯示（fmtMins 回傳 null） |
| `transitTotal === 0` | 交通欄位不顯示 |
| `day.startTime` 為空 | `totalMins = null`，不顯示「共 Xh」欄位 |
| 任一路線 recordedTime = 0 | 不納入 transitTotal（不影響顯示） |
| `slots[hotelEndId].start` 為 null | `totalMins = null`（任一段缺失時自動為 null） |
| `freeMins < 0`（超時） | 附加紅色 `⚠ 超時 Xm` |
| `state.routes` 為空物件 | trip stats 全部顯示 0 次 |

---

## 實作順序總結

1. CSS（任務一）→ 無 JS 副作用，安全先行
2. computeDayStats（任務二）→ 純函式，不影響任何渲染
3. renderDayStatsBar（任務三）→ 純函式，不影響任何渲染
4. renderDaySpots 修改（任務四）→ 插入一行，立即可見
5. computeTripStats + renderSettingsPanel（任務五）→ 全程統計
6. 超時驗證（任務六）→ 確認邊界條件
7. Git commit（任務七）
