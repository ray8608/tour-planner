# 天數複製 & 景點跨天移動 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增複製整天行程與景點跨天移動/複製功能

**Architecture:** 在現有 setState/render 架構上，新增 copyDay()、copySpotToDay() 函式，在景點卡片加入「→」選單按鈕，在天標頭加入「⎘」複製按鈕，透過 shareState 控制選單開關狀態。

**Tech Stack:** Vanilla JS/CSS/HTML，無框架，無建置流程

---

### Task 1：新增 CSS 樣式（spot context menu + spot-card position: relative）

**Files:**
- Modify: `tour-planner.html` — CSS `<style>` 區塊，`.day-dropdown-*` 樣式附近（約第 341–367 行）及 `.spot-card` 樣式（約第 456–465 行）

- [ ] **Step 1：確認 `.day-dropdown-backdrop` 所在行號**

  在 `tour-planner.html` 找到以下 CSS 區段（約第 341 行），確認其結尾位置：

  ```css
  .day-dropdown-backdrop { position: fixed; inset: 0; z-index: 49; }
  .day-dropdown-menu {
    position: absolute; top: calc(100% + 4px); left: 0;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; z-index: 50; min-width: 180px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25); overflow: hidden;
  }
  ```

- [ ] **Step 2：在 `.day-dropdown-add:hover` 規則之後（約第 367 行）插入 spot-menu CSS**

  找到：
  ```css
  .day-dropdown-add:hover { background: var(--accent-bg); }
  ```

  在其**後面**插入以下新規則（緊接著加一個空行後插入）：

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
  ```

- [ ] **Step 3：在 `.spot-card` 規則（約第 456 行）補 `position: relative`**

  找到：
  ```css
  .spot-card {
    background: var(--surface);
    border-radius: 6px;
    padding: 10px 12px;
    border: 1px solid transparent;
    box-shadow: var(--shadow);
  }
  ```

  改為：
  ```css
  .spot-card {
    position: relative;
    background: var(--surface);
    border-radius: 6px;
    padding: 10px 12px;
    border: 1px solid transparent;
    box-shadow: var(--shadow);
  }
  ```

- [ ] **Step 4：手動驗證 CSS 語法正確**

  在瀏覽器開啟 `tour-planner.html`，開啟 DevTools Console，確認無 CSS 解析錯誤。頁面外觀與改前相同（新 CSS 尚未觸發）。

- [ ] **Step 5：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add CSS for spot context menu and spot-card position"
  ```

---

### Task 2：擴充 `shareState` 初始值，加入 spotMenu 欄位

**Files:**
- Modify: `tour-planner.html:1116–1133`（`let shareState = { ... }` 定義處）

- [ ] **Step 1：確認目前 `shareState` 定義（約第 1116 行）**

  找到：
  ```js
  let shareState = {
    open: false, loading: false, list: [],
    error: null, dialog: null,
    deleteTargetId: null, deleteError: null, uploadError: null,
    importedDocId: loadImportedDocId(), updateError: null,
    overwriteTargetId: null, overwriteTargetName: null, overwriteUpdateName: true,
    // 新增欄位
    shareTab: 'public',
    privateCodeInput: '',
    privateCodeQueried: null,
    uploadVisibility: 'public',
    uploadSecretCode: '',
    shareUrl: null,
    managingTrip: null,
    manageView: 'main',
    manageError: null,
    dayDropdownOpen: false,
  };
  ```

- [ ] **Step 2：在 `dayDropdownOpen: false,` 之後加入兩個新欄位**

  將 `dayDropdownOpen: false,` 那一行改為：
  ```js
    dayDropdownOpen: false,
    spotMenuOpen:   false,
    spotMenuSpotId: null,
  ```

  完整結果：
  ```js
  let shareState = {
    open: false, loading: false, list: [],
    error: null, dialog: null,
    deleteTargetId: null, deleteError: null, uploadError: null,
    importedDocId: loadImportedDocId(), updateError: null,
    overwriteTargetId: null, overwriteTargetName: null, overwriteUpdateName: true,
    // 新增欄位
    shareTab: 'public',
    privateCodeInput: '',
    privateCodeQueried: null,
    uploadVisibility: 'public',
    uploadSecretCode: '',
    shareUrl: null,
    managingTrip: null,
    manageView: 'main',
    manageError: null,
    dayDropdownOpen: false,
    spotMenuOpen:   false,
    spotMenuSpotId: null,
  };
  ```

- [ ] **Step 3：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add spotMenuOpen and spotMenuSpotId to shareState"
  ```

---

### Task 3：新增 `copyDay(dayId)` 函式

**Files:**
- Modify: `tour-planner.html` — 在 `moveSpotToDay` 函式（約第 979 行）之後插入

- [ ] **Step 1：確認 `moveSpotToDay` 函式結尾位置（約第 991 行）**

  找到：
  ```js
  function moveSpotToDay(spotId, fromDayId, toDayId) {
    if (fromDayId === toDayId) return;
    setState(s => {
      const fromDay = s.days.find(d => d.id === fromDayId);
      const toDay   = s.days.find(d => d.id === toDayId);
      if (!fromDay || !toDay) return;
      const idx = fromDay.spots.findIndex(sp => sp.id === spotId);
      if (idx === -1) return;
      const [spot] = fromDay.spots.splice(idx, 1);
      clearRoutesForSpot(s, spotId);
      toDay.spots.push(spot);
    });
  }
  ```

- [ ] **Step 2：在 `moveSpotToDay` 結尾後空一行，插入 `copyDay` 函式**

  在 `moveSpotToDay` 函式的最後一個 `}` 之後（第 991 行後）插入：

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

- [ ] **Step 3：手動驗證函式可被呼叫**

  在瀏覽器 DevTools Console 輸入：
  ```js
  copyDay(state.days[0].id)
  ```
  確認：沒有 JS 錯誤，`state.days.length` 增加 1，新天的 `label` 包含「複製」字樣。

- [ ] **Step 4：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add copyDay() function with route remapping"
  ```

---

### Task 4：新增 `copySpotToDay(spotId, fromDayId, toDayId)` 函式

**Files:**
- Modify: `tour-planner.html` — 緊接在 `copyDay` 函式之後插入

- [ ] **Step 1：在 `copyDay` 函式結尾後插入 `copySpotToDay` 函式**

  在 `copyDay` 函式的最後一個 `}` 之後空一行，插入：

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

- [ ] **Step 2：手動驗證函式可被呼叫**

  在 DevTools Console 輸入（需有至少兩天）：
  ```js
  copySpotToDay(state.days[0].spots[0]?.id, state.days[0].id, state.days[1].id)
  ```
  確認：沒有 JS 錯誤，第二天尾部新增一個 spot，name 與原 spot 相同，id 不同。

- [ ] **Step 3：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add copySpotToDay() function"
  ```

---

### Task 5：修改 `renderDayHeader(day)` 加入複製按鈕

**Files:**
- Modify: `tour-planner.html:1332–1342`（`renderDayHeader` 函式）

- [ ] **Step 1：確認目前 `renderDayHeader` 內容（第 1332 行）**

  確認現狀：
  ```js
  function renderDayHeader(day) {
    const dayIndex = state.days.findIndex(d => d.id === day.id);
    const dateStr  = getDayDate(dayIndex);
    return `
      <div class="day-content-header">
        <input class="day-name-input" value="${escHtml(day.label)}"
          data-action="day-name" data-day-id="${day.id}">
        ${dateStr ? `<span style="font-size:12px;color:var(--text-muted)">${escHtml(dateStr)}</span>` : ''}
        ${renderDeleteDayBtn(day)}
      </div>`;
  }
  ```

- [ ] **Step 2：在 `${renderDeleteDayBtn(day)}` 之前插入複製按鈕**

  將整個 `renderDayHeader` 函式改為：

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

- [ ] **Step 3：手動驗證 Layout A / B**

  在瀏覽器重整，切換到 Layout A 和 Layout B，確認每個天標頭在日期字串右邊、垃圾桶左邊出現「⎘」按鈕，目前點擊尚無反應（事件尚未接上，下個 Task 處理）。

- [ ] **Step 4：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add copy-day button to renderDayHeader"
  ```

---

### Task 6：修改 `renderLayoutC()` 加入複製按鈕至 `day-section-header`

**Files:**
- Modify: `tour-planner.html:1798–1819`（`renderLayoutC` 函式）

- [ ] **Step 1：確認目前 `renderLayoutC` 的 `day-section-header` 區段（第 1803–1808 行）**

  確認現狀：
  ```js
  <div class="day-section-header">
    <span style="color:var(--accent)">📅</span>
    <input class="day-name-input" value="${escHtml(day.label)}"
      data-action="day-name" data-day-id="${day.id}">
    ${dateStr ? `<span style="font-size:12px;color:var(--text-muted)">${escHtml(dateStr)}</span>` : ''}
    ${renderDeleteDayBtn(day)}
  </div>
  ```

- [ ] **Step 2：在 `${renderDeleteDayBtn(day)}` 之前插入複製按鈕**

  將 `day-section-header` 的 innerHTML 改為：

  ```js
  <div class="day-section-header">
    <span style="color:var(--accent)">📅</span>
    <input class="day-name-input" value="${escHtml(day.label)}"
      data-action="day-name" data-day-id="${day.id}">
    ${dateStr ? `<span style="font-size:12px;color:var(--text-muted)">${escHtml(dateStr)}</span>` : ''}
    <button class="btn-ghost" data-action="copy-day"
      data-day-id="${day.id}" title="複製此天">⎘</button>
    ${renderDeleteDayBtn(day)}
  </div>
  ```

- [ ] **Step 3：手動驗證 Layout C**

  切換到 Layout C（設定面板 → C 捲動），確認每個天區段的標頭有「⎘」按鈕。

- [ ] **Step 4：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add copy-day button to Layout C day-section-header"
  ```

---

### Task 7：新增 `renderSpotMenu(spotId, dayId)` 函式

**Files:**
- Modify: `tour-planner.html` — 在 `renderSpotCard` 函式（約第 1223 行）之前插入新函式

- [ ] **Step 1：確認 `renderSpotCard` 函式起始行（約第 1223 行）**

  找到：
  ```js
  function renderSpotCard(spot, dayId, slot) {
  ```

- [ ] **Step 2：在 `renderSpotCard` 定義之前插入 `renderSpotMenu` 函式**

  在 `function renderSpotCard` 的上方空一行處插入：

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

- [ ] **Step 3：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add renderSpotMenu() function"
  ```

---

### Task 8：修改 `renderSpotCard` 加入「→」按鈕與條件渲染選單

**Files:**
- Modify: `tour-planner.html:1223–1254`（`renderSpotCard` 函式）

- [ ] **Step 1：確認目前 `renderSpotCard` 的 `spot-row` 區段（第 1240–1248 行）**

  確認現狀（spot-row 內容）：
  ```js
  <div class="spot-row">
    <span class="drag-handle" title="拖拉排序">⠿</span>
    <input class="spot-name" value="${escHtml(spot.name)}" placeholder="景點名稱"
      data-action="spot-name" data-spot-id="${spot.id}" data-day-id="${dayId}">
    ${stayHtml}
    <a class="btn-accent" ${navAttrs}>🗺 導航</a>
    <button class="btn-ghost" data-action="delete-spot"
      data-spot-id="${spot.id}" data-day-id="${dayId}" title="刪除景點">✕</button>
  </div>
  <input class="spot-notes" value="${escHtml(spot.notes)}" placeholder="備註（選填）"
    data-action="spot-notes" data-spot-id="${spot.id}" data-day-id="${dayId}">
  ```

- [ ] **Step 2：在 `delete-spot` 按鈕之前插入「→」按鈕，在 `spot-notes` 之後加選單渲染**

  將 `renderSpotCard` 的 return 字串中，`spot-card` div 的內容改為：

  ```js
  <div class="spot-card" data-spot-id="${spot.id}" data-day-id="${dayId}" draggable="true">
    <div class="spot-row">
      <span class="drag-handle" title="拖拉排序">⠿</span>
      <input class="spot-name" value="${escHtml(spot.name)}" placeholder="景點名稱"
        data-action="spot-name" data-spot-id="${spot.id}" data-day-id="${dayId}">
      ${stayHtml}
      <a class="btn-accent" ${navAttrs}>🗺 導航</a>
      <button class="btn-ghost spot-move-btn"
        data-action="toggle-spot-menu"
        data-spot-id="${spot.id}" data-day-id="${dayId}"
        title="移動／複製到其他天">→</button>
      <button class="btn-ghost" data-action="delete-spot"
        data-spot-id="${spot.id}" data-day-id="${dayId}" title="刪除景點">✕</button>
    </div>
    <input class="spot-notes" value="${escHtml(spot.notes)}" placeholder="備註（選填）"
      data-action="spot-notes" data-spot-id="${spot.id}" data-day-id="${dayId}">
    ${shareState.spotMenuSpotId === spot.id ? renderSpotMenu(spot.id, dayId) : ''}
  </div>
  ```

  完整的 `renderSpotCard` 函式：

  ```js
  function renderSpotCard(spot, dayId, slot) {
    const hasName  = spot.name.trim() !== '';
    const navUrl   = hasName ? mapsNavUrl(spot.name) : '#';
    const navAttrs = hasName
      ? `href="${escHtml(navUrl)}" target="_blank" rel="noopener"`
      : `href="#" onclick="return false" title="請先輸入景點名稱"`;
    const badge   = formatTimeBadge(slot);
    const dAttrs  = `data-spot-id="${spot.id}" data-day-id="${dayId}"`;
    const stayHtml = renderDurationSelects(spot.stayDuration, 'spot-dur-h', 'spot-dur-m', dAttrs);

    return `
      <div class="timeline-row">
        <div class="timeline-left">
          ${badge ? `<span class="time-badge">${escHtml(badge)}</span>` : ''}
        </div>
        <div class="timeline-right">
          <div class="spot-card" data-spot-id="${spot.id}" data-day-id="${dayId}" draggable="true">
            <div class="spot-row">
              <span class="drag-handle" title="拖拉排序">⠿</span>
              <input class="spot-name" value="${escHtml(spot.name)}" placeholder="景點名稱"
                data-action="spot-name" data-spot-id="${spot.id}" data-day-id="${dayId}">
              ${stayHtml}
              <a class="btn-accent" ${navAttrs}>🗺 導航</a>
              <button class="btn-ghost spot-move-btn"
                data-action="toggle-spot-menu"
                data-spot-id="${spot.id}" data-day-id="${dayId}"
                title="移動／複製到其他天">→</button>
              <button class="btn-ghost" data-action="delete-spot"
                data-spot-id="${spot.id}" data-day-id="${dayId}" title="刪除景點">✕</button>
            </div>
            <input class="spot-notes" value="${escHtml(spot.notes)}" placeholder="備註（選填）"
              data-action="spot-notes" data-spot-id="${spot.id}" data-day-id="${dayId}">
            ${shareState.spotMenuSpotId === spot.id ? renderSpotMenu(spot.id, dayId) : ''}
          </div>
        </div>
      </div>`;
  }
  ```

- [ ] **Step 3：手動驗證外觀**

  在瀏覽器重整，確認每張景點卡片在「🗺 導航」右邊、「✕」左邊出現「→」按鈕。點擊不應報錯（事件尚未接上）。

- [ ] **Step 4：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add move button and spot menu rendering to renderSpotCard"
  ```

---

### Task 9：在 click handler 新增 5 個 action 處理

**Files:**
- Modify: `tour-planner.html:2204–2213`（`delete-spot` action 處理之後、`});` 之前）

  具體位置：click handler 中 `delete-spot` action 的 `return;` 之後、handler 函式結束的 `});` 之前（約第 2213–2214 行）。

- [ ] **Step 1：確認 `delete-spot` action 結尾位置（約第 2213 行）**

  找到：
  ```js
  if (action === 'delete-spot') {
    const { spotId, dayId } = el.dataset;
    setState(s => {
      const day = s.days.find(d => d.id === dayId);
      if (!day) return;
      clearRoutesForSpot(s, spotId);
      day.spots = day.spots.filter(sp => sp.id !== spotId);
    });
    return;
  }
  ```

  確認其後是 `});`（click handler 的結束括號）。

- [ ] **Step 2：在 `delete-spot` 處理的 `return;` 後、`});` 之前插入 5 個新 action**

  在 `delete-spot` 區塊的最後一個 `}` 之後（第 2213 行之後）插入：

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

- [ ] **Step 3：Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: wire copy-day, toggle-spot-menu, move/copy-spot-to-day click actions"
  ```

---

### Task 10：完整端對端驗證

- [ ] **Step 1：驗證「複製整天」基本流程**

  1. 在瀏覽器開啟 `tour-planner.html`（Layout A）
  2. 第1天新增2個景點「景點A」「景點B」，設定出發時間、飯店名稱
  3. 點擊「⎘」複製按鈕
  4. 確認：
     - 頁籤自動切換到「第2天（複製）」
     - 第2天包含「景點A」「景點B」（景點名稱相同）
     - 第2天的出發時間、飯店名稱與第1天相同
     - 第2天景點的 id 與第1天不同（DevTools Console：`state.days[1].spots[0].id !== state.days[0].spots[0].id`）

- [ ] **Step 2：驗證複製天的路線**

  1. 為第1天設定「景點A → 景點B」的交通方式（例如選「🚌 大眾」）
  2. 複製第1天
  3. 確認第2天「景點A → 景點B」的路線設定與第1天相同

- [ ] **Step 3：驗證「複製整天」在 Layout C**

  1. 切換到 Layout C（設定面板 → C 捲動）
  2. 確認每個天區段標頭有「⎘」按鈕
  3. 點擊第1天的「⎘」
  4. 確認頁面新增了一個天區塊（不自動捲動）

- [ ] **Step 4：驗證「→」選單開關**

  1. 切換到 Layout A，確保有至少2天（可利用剛才複製的）
  2. 在第1天景點上點「→」按鈕
  3. 確認浮層選單出現，列出「移動到」與「複製到」兩區，第1天選項在「移動到」區為灰色禁用
  4. 點選單外的透明背景（backdrop）確認選單關閉
  5. 再次點「→」確認選單再次打開（toggle）
  6. 再次點同一個「→」確認選單關閉

- [ ] **Step 5：驗證「移動景點」**

  1. 第1天有「景點A」，第2天為空
  2. 點「景點A」的「→」→「移動到」→「第2天」
  3. 確認第1天「景點A」消失，第2天尾部出現「景點A」
  4. 確認選單已關閉

- [ ] **Step 6：驗證「複製景點」**

  1. 第1天有「景點A」
  2. 點「→」→「複製到」→「第2天」
  3. 確認第1天「景點A」仍在，第2天尾部多一個「景點A」
  4. 確認兩個「景點A」的 id 不同（DevTools Console）

- [ ] **Step 7：驗證「複製到同天」**

  1. 第1天有「景點A」
  2. 點「→」→「複製到」→「第1天（目前）」
  3. 確認第1天尾部多一個「景點A」（複製到同天）

- [ ] **Step 8：驗證只有一天時的提示訊息**

  1. 建立一個只有1天的行程（或刪除多餘的天）
  2. 點景點的「→」按鈕
  3. 確認選單顯示「目前只有一天，新增天數後即可跨天移動」

- [ ] **Step 9：驗證 Layout B 行為**

  1. 切換到 Layout B
  2. 複製第1天，確認 dropdown 中出現新天，並自動切換到新天
  3. 移動景點，確認行為正確

- [ ] **Step 10：DevTools Console 無 JS 錯誤**

  完成上述所有操作後，確認 Console 無任何紅色錯誤訊息。

- [ ] **Step 11：最終 Commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: copy day and cross-day spot move/copy — full implementation"
  ```

---

## 完成標準

全部 10 個 Task 完成後，確認以下行為：

| 情境 | 預期結果 |
|------|----------|
| Layout A/B：點「⎘」複製天 | 新天插入原天後，自動切換到新天，標籤含「複製」 |
| Layout C：點「⎘」複製天 | 新天區塊出現在原天下方，不切換 activeDayId |
| 複製天時有景點與路線 | 景點全部深複製（新 id），路線重新映射 |
| 點「→」按鈕 | 選單在景點卡片右下角展開，backdrop 覆蓋全頁 |
| 「移動到」區：本天選項 | 灰色禁用，不可點擊 |
| 「複製到」區：本天選項 | 可點擊，複製到同天尾部 |
| 只有一天時點「→」 | 顯示提示文字，無可操作選項 |
| 點選單外 backdrop | 選單關閉 |
| 移動景點到其他天 | 原天景點消失，目標天尾部新增，路線清除 |
| 複製景點到其他天 | 原天景點不動，目標天尾部新增（新 id） |
| DevTools Console | 無 JS 錯誤 |
