# 景點分類與顏色標籤 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為每個景點增加可選分類（7種預設），以色條和時間軸圓點顯示，分類選擇透過卡片內浮層 picker 操作

**Architecture:** spot 物件新增 category 欄位，SPOT_CATEGORIES 常數定義分類，CSS 變數控制顏色（4個主題各一套），getCatColor() 從 CSS 讀取顏色，shareState.catPickerOpenSpotId 控制 picker 顯示。

**Tech Stack:** Vanilla JS/CSS/HTML，CSS custom properties，無外部依賴

---

## 關鍵位置速查（已從原始碼確認）

| 位置 | 行號 |
|------|------|
| `:root` CSS block（dark 主題） | 9–25 |
| `[data-theme="light"]` block | 26–42 |
| `[data-theme="cyberpunk"]` block | 43–59 |
| `[data-theme="cream"]` block | 61–78 |
| `.timeline-left` CSS | 400–408 |
| `.time-badge` CSS | 410–417 |
| `.spot-card` CSS | 456–462 |
| `.spot-row` CSS | 465 |
| `migrateState(s)` 函數 | 1038–1055 |
| `spot.stayDuration` 補預設值（migrateState 內） | 1047 |
| `shareState` 物件宣告 | 1116–1133 |
| `function renderSpotCard(spot, dayId, slot)` | 1223–1254 |
| `add-spot` 事件處理（push new spot） | 2195–2201 |
| `app.addEventListener('click', ...)` 事件委派入口 | 1875 |
| `function renderHelpOverlay()` | 1617–1696 |
| 說明文字「＋ 新增景點」那一行 | 1633 |

---

## Task 1 — CSS：4 個主題各新增 7 個 `--cat-*` 變數

**目標：** 在 CSS Variables block 的四個主題 block 各新增 7 個顏色變數。

- [ ] **Step 1.1** — 在 `:root` block 的 `color-scheme: dark;` 前（第 24 行之前），於 `--color-success: #34d399;` 之後插入 dark 主題的分類色變數。

  找到這段（第 23–25 行）：
  ```css
      --color-success: #34d399;
      color-scheme: dark;
    }
  ```
  替換為：
  ```css
      --color-success: #34d399;
      --cat-sightseeing: #60a5fa;
      --cat-food:        #f87171;
      --cat-shopping:    #c084fc;
      --cat-transit:     #94a3b8;
      --cat-hotel:       #34d399;
      --cat-activity:    #fb923c;
      --cat-other:       #64748b;
      color-scheme: dark;
    }
  ```

- [ ] **Step 1.2** — 在 `[data-theme="light"]` block 的 `color-scheme: light;` 前，於 `--color-success: #16a34a;` 之後插入 light 主題的分類色變數。

  找到這段（第 40–42 行）：
  ```css
      --color-success: #16a34a;
      color-scheme: light;
    }
  ```
  替換為：
  ```css
      --color-success: #16a34a;
      --cat-sightseeing: #2563eb;
      --cat-food:        #dc2626;
      --cat-shopping:    #9333ea;
      --cat-transit:     #64748b;
      --cat-hotel:       #16a34a;
      --cat-activity:    #ea580c;
      --cat-other:       #94a3b8;
      color-scheme: light;
    }
  ```

- [ ] **Step 1.3** — 在 `[data-theme="cyberpunk"]` block 的 `color-scheme: dark;` 前，於 `--color-success: #00ff88;` 之後插入 cyberpunk 主題的分類色變數。

  找到這段（第 57–59 行）：
  ```css
      --color-success: #00ff88;
      color-scheme: dark;
    }
  ```
  替換為：
  ```css
      --color-success: #00ff88;
      --cat-sightseeing: #00d4ff;
      --cat-food:        #ff2d9b;
      --cat-shopping:    #c87cff;
      --cat-transit:     #3a5a7a;
      --cat-hotel:       #00ff88;
      --cat-activity:    #ffaa00;
      --cat-other:       #1a2050;
      color-scheme: dark;
    }
  ```

- [ ] **Step 1.4** — 在 `[data-theme="cream"]` block 的 `color-scheme: light;` 前，於 `--color-success: #5a9a60;` 之後插入 cream 主題的分類色變數。

  找到這段（第 75–77 行）：
  ```css
      --color-success: #5a9a60;
      color-scheme: light;
    }
  ```
  替換為：
  ```css
      --color-success: #5a9a60;
      --cat-sightseeing: #8a6020;
      --cat-food:        #c04030;
      --cat-shopping:    #8050b0;
      --cat-transit:     #9a7a60;
      --cat-hotel:       #5a9a60;
      --cat-activity:    #b05010;
      --cat-other:       #c0a080;
      color-scheme: light;
    }
  ```

## Task 2 — CSS：新增元件樣式（`.spot-cat-bar`、`.spot-cat-btn`、`.spot-cat-picker`、`.spot-cat-option`、`.spot-cat-backdrop`、`.cat-dot`）

**目標：** 修改 `.spot-card` 並新增所有分類相關 CSS 規則，插入在現有 `.spot-card` block 之後。

- [ ] **Step 2.1** — 修改 `.spot-card` block（第 456–462 行），新增 `position: relative` 並將 `padding: 10px 12px` 改為 `padding: 10px 12px 10px 15px`。

  找到這段：
  ```css
    .spot-card {
      background: var(--surface);
      border-radius: 6px;
      padding: 10px 12px;
      border: 1px solid transparent;
      box-shadow: var(--shadow);
    }
  ```
  替換為：
  ```css
    .spot-card {
      background: var(--surface);
      border-radius: 6px;
      padding: 10px 12px 10px 15px;
      border: 1px solid transparent;
      box-shadow: var(--shadow);
      position: relative;
    }
  ```

- [ ] **Step 2.2** — 在 `.spot-card.drag-over` 那一行（第 463 行）之後，插入所有新 CSS 規則。

  找到這段：
  ```css
    .spot-card.drag-over { border-color: var(--accent); background: var(--accent-bg); }
    .spot-card.dragging { opacity: 0.35; }
    .spot-row { display: flex; align-items: center; gap: 6px; }
  ```
  替換為：
  ```css
    .spot-card.drag-over { border-color: var(--accent); background: var(--accent-bg); }
    .spot-card.dragging { opacity: 0.35; }
    .spot-cat-bar {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      border-radius: 6px 0 0 6px;
      background: transparent;
    }
    .spot-cat-btn {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 0 2px;
      opacity: 0.6;
      line-height: 1;
      flex-shrink: 0;
    }
    .spot-cat-btn:hover { opacity: 1; }
    .spot-cat-picker {
      position: absolute;
      top: calc(100% + 2px);
      left: 0;
      z-index: 50;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      width: 228px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .spot-cat-option {
      width: 52px;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 12px;
      text-align: center;
      border: 1px solid transparent;
      background: none;
      cursor: pointer;
      color: var(--text);
      line-height: 1.4;
    }
    .spot-cat-option:hover { border-color: var(--accent-bd); background: var(--accent-bg); }
    .spot-cat-option.active { border-color: var(--accent-bd); background: var(--accent-bg); font-weight: 600; }
    .spot-cat-backdrop {
      position: fixed;
      inset: 0;
      z-index: 49;
      background: transparent;
    }
    .cat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: block;
      margin: 0 auto 2px;
    }
    .spot-row { display: flex; align-items: center; gap: 6px; }
  ```

## Task 3 — CSS：調整 `.timeline-left` 為 flex-column（支援 cat-dot 在上）

**目標：** 讓 `.timeline-left` 能垂直排列 `cat-dot` 和 `time-badge`。

- [ ] **Step 3.1** — 修改 `.timeline-left` block（第 400–408 行），加入 `flex-direction: column; align-items: flex-end; justify-content: center;`。

  找到這段：
  ```css
    .timeline-left {
      width: 96px;
      min-width: 96px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 8px;
      flex-shrink: 0;
    }
  ```
  替換為：
  ```css
    .timeline-left {
      width: 96px;
      min-width: 96px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      padding-right: 8px;
      flex-shrink: 0;
    }
  ```

**手動驗證：** 開啟瀏覽器，確認現有行程外觀未變（`.timeline-left` 純 flex-column 不影響原有單一 time-badge 的對齊）。

## Task 4 — JS：新增 `SPOT_CATEGORIES` 常數與 `getCatColor()` 函數

**目標：** 在 JS 區塊早期（`migrateState` 之前，約 1038 行附近）新增常數和工具函數。

- [ ] **Step 4.1** — 在 `function migrateState(s)` 宣告（第 1038 行）之前，插入以下程式碼：

  找到這段：
  ```js
    function migrateState(s) {
      if (!s.routes) s.routes = {};
  ```
  替換為：
  ```js
    // ===== Spot Categories =====
    const SPOT_CATEGORIES = [
      { id: 'sightseeing', label: '景點',     emoji: '🏛' },
      { id: 'food',        label: '餐廳',     emoji: '🍽' },
      { id: 'shopping',    label: '購物',     emoji: '🛍' },
      { id: 'transit',     label: '交通樞紐', emoji: '🚉' },
      { id: 'hotel',       label: '住宿',     emoji: '🏨' },
      { id: 'activity',    label: '體驗活動', emoji: '🎯' },
      { id: 'other',       label: '其他',     emoji: '📌' },
    ];

    function getCatColor(categoryId) {
      if (!categoryId) return null;
      return getComputedStyle(document.documentElement)
        .getPropertyValue(`--cat-${categoryId}`)
        .trim() || null;
    }

    function migrateState(s) {
      if (!s.routes) s.routes = {};
  ```

## Task 5 — JS：`migrateState` 補 `category` 預設值

**目標：** 舊資料缺少 `category` 欄位時自動補 `null`。

- [ ] **Step 5.1** — 在 `migrateState` 函數內的 `spot.stayDuration` 補預設值那一行（第 1047 行）之後，加一行補 `category`。

  找到這段：
  ```js
        day.spots.forEach(spot => {
          if (typeof spot.stayDuration !== 'number') spot.stayDuration = 0;
        });
  ```
  替換為：
  ```js
        day.spots.forEach(spot => {
          if (typeof spot.stayDuration !== 'number') spot.stayDuration = 0;
          if (spot.category === undefined) spot.category = null;
        });
  ```

## Task 6 — JS：`shareState` 新增 `catPickerOpenSpotId`

**目標：** 在 `shareState` 物件新增控制 picker 顯示的欄位。

- [ ] **Step 6.1** — 在 `shareState` 物件（第 1116–1133 行）的 `dayDropdownOpen: false,` 之後，加入 `catPickerOpenSpotId`。

  找到這段：
  ```js
      dayDropdownOpen: false,
    };
  ```
  替換為：
  ```js
      dayDropdownOpen: false,
      catPickerOpenSpotId: null,
    };
  ```

## Task 7 — JS：`add-spot` 動作新增 `category: null`

**目標：** 新增景點時預設 `category: null`。

- [ ] **Step 7.1** — 在 `add-spot` 事件處理（第 2199 行）修改 spot 物件。

  找到這段：
  ```js
            if (day) day.spots.push({ id: genId(), name: '', stayDuration: 0, notes: '' });
  ```
  替換為：
  ```js
            if (day) day.spots.push({ id: genId(), name: '', stayDuration: 0, notes: '', category: null });
  ```

## Task 8 — JS：新增 `renderCatPicker(spot)` 函數

**目標：** 新增產生浮層 HTML 的函數，插入在 `renderSpotCard` 之前。

- [ ] **Step 8.1** — 在 `function renderSpotCard(spot, dayId, slot)` 宣告（第 1223 行）之前，插入 `renderCatPicker` 函數。

  找到這段：
  ```js
    function renderSpotCard(spot, dayId, slot) {
      const hasName  = spot.name.trim() !== '';
  ```
  替換為：
  ```js
    function renderCatPicker(spot) {
      const opts = SPOT_CATEGORIES.map(c => {
        const isActive = spot.category === c.id;
        return `<button class="spot-cat-option${isActive ? ' active' : ''}"
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

    function renderSpotCard(spot, dayId, slot) {
      const hasName  = spot.name.trim() !== '';
  ```

## Task 9 — JS：修改 `renderSpotCard` 函數主體

**目標：** 在卡片加入色條、分類按鈕，在 timeline-left 加入 cat-dot，在卡片外加入 picker 浮層。

- [ ] **Step 9.1** — 用新版本整體替換 `renderSpotCard` 函數主體（第 1223–1254 行）。

  找到這段（完整函數）：
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
                <button class="btn-ghost" data-action="delete-spot"
                  data-spot-id="${spot.id}" data-day-id="${dayId}" title="刪除景點">✕</button>
              </div>
              <input class="spot-notes" value="${escHtml(spot.notes)}" placeholder="備註（選填）"
                data-action="spot-notes" data-spot-id="${spot.id}" data-day-id="${dayId}">
            </div>
          </div>
        </div>`;
    }
  ```
  替換為：
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

      const catColor = getCatColor(spot.category);
      const catBarStyle = catColor ? `style="background:${catColor}"` : '';
      const cat = spot.category ? SPOT_CATEGORIES.find(c => c.id === spot.category) : null;
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
                <input class="spot-name" value="${escHtml(spot.name)}" placeholder="景點名稱"
                  data-action="spot-name" data-spot-id="${spot.id}" data-day-id="${dayId}">
                ${stayHtml}
                <a class="btn-accent" ${navAttrs}>🗺 導航</a>
                <button class="btn-ghost" data-action="delete-spot"
                  data-spot-id="${spot.id}" data-day-id="${dayId}" title="刪除景點">✕</button>
              </div>
              <input class="spot-notes" value="${escHtml(spot.notes)}" placeholder="備註（選填）"
                data-action="spot-notes" data-spot-id="${spot.id}" data-day-id="${dayId}">
            </div>
            ${pickerOpen ? renderCatPicker(spot) : ''}
          </div>
        </div>`;
    }
  ```

## Task 10 — JS：事件委派新增三個 `data-action` 處理器

**目標：** 在 click 事件委派區塊（`app.addEventListener('click', ...)`，第 1875 行起）新增 `open-cat-picker`、`close-cat-picker`、`set-cat` 三個處理器。

- [ ] **Step 10.1** — 在 `add-spot` 處理器之後（第 2201 行 `return;` 之後）、`delete-spot` 處理器之前，插入三個新處理器。

  找到這段：
  ```js
        if (action === 'add-spot') {
          const dayId = el.dataset.dayId;
          setState(s => {
            const day = s.days.find(d => d.id === dayId);
            if (day) day.spots.push({ id: genId(), name: '', stayDuration: 0, notes: '', category: null });
          });
          return;
        }

        if (action === 'delete-spot') {
  ```
  替換為：
  ```js
        if (action === 'add-spot') {
          const dayId = el.dataset.dayId;
          setState(s => {
            const day = s.days.find(d => d.id === dayId);
            if (day) day.spots.push({ id: genId(), name: '', stayDuration: 0, notes: '', category: null });
          });
          return;
        }

        if (action === 'open-cat-picker') {
          const spotId = el.dataset.spotId;
          setShareState({ catPickerOpenSpotId: shareState.catPickerOpenSpotId === spotId ? null : spotId });
          return;
        }

        if (action === 'close-cat-picker') {
          setShareState({ catPickerOpenSpotId: null });
          return;
        }

        if (action === 'set-cat') {
          const spotId = el.dataset.spotId;
          const catId = el.dataset.cat || null;
          setState(s => {
            for (const day of s.days) {
              const spot = day.spots.find(sp => sp.id === spotId);
              if (spot) { spot.category = catId; break; }
            }
          });
          setShareState({ catPickerOpenSpotId: null });
          return;
        }

        if (action === 'delete-spot') {
  ```

## Task 11 — 更新 `renderHelpOverlay`：加入分類說明

**目標：** 在「景點管理」說明段落補充分類功能說明。

- [ ] **Step 11.1** — 在 `renderHelpOverlay` 中「＋ 新增景點」說明那一行（第 1633 行）之後，加入分類說明。

  找到這段：
  ```js
                <div class="help-item">• 點 <b>＋ 新增景點</b> 在當天加入景點，可設定名稱、停留時間、備注</div>
                <div class="help-item">• 景點之間可設定<b>交通方式</b>與<b>交通時間</b>，時間軸會自動計算每個景點的抵達與離開時間</div>
  ```
  替換為：
  ```js
                <div class="help-item">• 點 <b>＋ 新增景點</b> 在當天加入景點，可設定名稱、停留時間、備注</div>
                <div class="help-item">• 點景點左側的 <b>⊙ 圖示</b> 可選擇分類（🏛 景點、🍽 餐廳、🛍 購物…），分類顏色顯示於卡片左側色條與時間軸圓點</div>
                <div class="help-item">• 景點之間可設定<b>交通方式</b>與<b>交通時間</b>，時間軸會自動計算每個景點的抵達與離開時間</div>
  ```

## Task 12 — 更新 `README.md`：加入景點分類功能說明

**目標：** 在 README「景點管理」那一條之後新增分類功能。

- [ ] **Step 12.1** — 在 `README.md` 的「景點管理」條目之後插入分類說明。

  找到這段：
  ```markdown
  - **景點管理**：新增、刪除景點，可設定名稱、停留時間、備注
  ```
  替換為：
  ```markdown
  - **景點管理**：新增、刪除景點，可設定名稱、停留時間、備注
  - **景點分類**：點景點左側圖示可標記分類（景點、餐廳、購物、交通樞紐、住宿、體驗活動、其他），分類顏色顯示於卡片色條與時間軸圓點，支援全部四種主題
  ```

---

## 手動瀏覽器驗證清單

所有 Task 完成後，在瀏覽器開啟 `tour-planner.html` 驗證以下項目：

### 基本功能
- [ ] 頁面正常開啟，無 JS 錯誤（DevTools Console 無紅色錯誤）
- [ ] 現有行程（無 category 欄位）顯示正常，景點卡片外觀與原本相同（無色條、⊙ 圖示為灰色）
- [ ] 點 ⊙ 圖示後彈出分類浮層（7個分類 + 清除按鈕，共 8 個 button）
- [ ] 點浮層外半透明背景層可關閉浮層
- [ ] 點分類後：(1) 浮層關閉、(2) 景點左側出現對應顏色色條、(3) 分類按鈕顯示對應 emoji 且著色、(4) timeline-left 出現對應顏色圓點

### 樣式驗證
- [ ] 色條為 3px 寬豎線，位於卡片最左側
- [ ] cat-dot 圓點顯示在 time-badge 上方，兩者對齊右側
- [ ] 無分類時：色條透明，time-badge 位置不變（無上方 cat-dot 空白）
- [ ] 浮層按鈕 hover 有底色高亮，active（已選中）有邊框高亮

### 主題切換
- [ ] 切換 Light 主題：分類色正確顯示（顏色較深，適合亮色背景）
- [ ] 切換 Cyberpunk 主題：分類色正確顯示（霓虹配色）
- [ ] 切換 Cream 主題：分類色正確顯示（大地色調）

### 資料持久化
- [ ] 設定分類後重新整理頁面，分類保留
- [ ] 點「清除」後色條消失、按鈕回到 ⊙

### 邊界情況
- [ ] 一天有多個景點時，各景點可獨立設定分類
- [ ] 同一時間只有一個 picker 浮層開啟（點另一個景點的 ⊙ 後前一個浮層關閉）
- [ ] Layout A / B / C 三種版面均顯示正確

---

## Git commit

所有驗證通過後執行：

```bash
git add tour-planner.html README.md
git commit -m "feat: add spot category labels with color bar and timeline dot

- Add 7 preset categories (sightseeing, food, shopping, transit, hotel, activity, other)
- CSS custom properties for all 4 themes (dark/light/cream/cyberpunk)
- 3px color bar on spot card left edge, colored dot above time-badge
- Category picker overlay triggered by spot icon button
- shareState.catPickerOpenSpotId controls picker visibility
- migrateState handles missing category field (defaults to null)
- renderHelpOverlay and README updated"
```
