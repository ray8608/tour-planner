# KML 匯出功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在旅遊行程規劃工具新增「匯出 KML」功能，讓使用者可將行程匯出為可直接匯入 Google My Maps 的 `.kml` 檔案。

**Architecture:** 所有程式碼集中於 `tour-planner.html` 單一檔案。新增三個函數：`geocodeForKML`（含 sessionStorage 快取的地理編碼）、`generateKML`（純函數，產生 KML 字串）、`exportKML`（主流程：進度 UI + geocoding + 下載）。另修改渲染函數加入按鈕，並在 action handler 加入對應分支。

**Tech Stack:** 純瀏覽器 JavaScript，無框架。KML 2.2 規格，Nominatim geocoding API。無測試框架，以瀏覽器 console 手動驗證。

---

## 檔案異動總覽

| 檔案 | 動作 | 說明 |
|------|------|------|
| `tour-planner.html` | 修改 | 新增函數（L1714 後）、按鈕（L2769）、action handler（L3444）、help text（L2657） |

---

## Task 1：`geocodeForKML(name)` — 帶快取的地理編碼

**Files:**
- Modify: `tour-planner.html:1714`（在 `exportICS` 函數結尾後插入）

- [ ] **Step 1：插入 `geocodeForKML` 函數**

  在 `tour-planner.html` 第 1714 行（`exportICS` 結尾後的空行）後，插入：

  ```javascript
    async function geocodeForKML(name) {
      const key = `kml-geo:${name}`;
      const cached = sessionStorage.getItem(key);
      if (cached !== null) return JSON.parse(cached);
      const result = await nominatimGeocode(name);
      sessionStorage.setItem(key, JSON.stringify(result));
      return result;
    }
  ```

  說明：
  - `nominatimGeocode` 失敗時已回傳 `null`，直接存 `"null"` 入 sessionStorage，下次查到直接回傳 `null` 不重查。
  - `JSON.parse("null") === null`，型別正確。

- [ ] **Step 2：在瀏覽器 console 驗證快取邏輯**

  開啟 `tour-planner.html`，在 console 執行：

  ```javascript
  // 第一次查詢（應發出網路請求）
  geocodeForKML('東京').then(r => console.log('result:', r));

  // 1 秒後查第二次（應從 sessionStorage 取，不發請求）
  setTimeout(() => geocodeForKML('東京').then(r => console.log('cached:', r)), 1000);

  // 驗證快取鍵
  console.log('cache entry:', sessionStorage.getItem('kml-geo:東京'));
  ```

  預期：兩次都回傳 `{ lat: number, lng: number }`，第二次不出現新的 Network 請求。

- [ ] **Step 3：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add geocodeForKML with sessionStorage cache"
  ```

---

## Task 2：`generateKML(days, coordMap)` — KML 字串產生器

**Files:**
- Modify: `tour-planner.html`（緊接在 Task 1 函數後插入）

- [ ] **Step 1：插入顏色常數與 `kmlEsc` helper**

  緊接在 `geocodeForKML` 函數後插入：

  ```javascript
    const KML_COLORS = [
      { pin: 'ff0000e5', line: 'ff0055ff' },
      { pin: 'ffff3900', line: 'ffffff00' },
      { pin: 'ff00b300', line: 'ff00ffaa' },
      { pin: 'ff990099', line: 'ffcc66ff' },
      { pin: 'ff0080ff', line: 'ff00d7ff' },
      { pin: 'ffcccc00', line: 'ffcc6600' },
      { pin: 'ff6600cc', line: 'ffcc0099' },
      { pin: 'ff00ccff', line: 'ff0066cc' },
    ];

    function kmlEsc(s) {
      return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  ```

  KML 顏色格式為 `aabbggrr`（alpha-blue-green-red）。

- [ ] **Step 2：插入 `generateKML` 函數**

  緊接在上方常數後插入：

  ```javascript
    function generateKML(days, coordMap) {
      const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '<Document>',
        `<name>${kmlEsc(state.tripName)}</name>`,
      ];

      days.forEach((_, i) => {
        const c = KML_COLORS[i % KML_COLORS.length];
        lines.push(
          `<Style id="pin-${i}">`,
          `  <IconStyle><color>${c.pin}</color>`,
          `    <Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-circle.png</href></Icon>`,
          `  </IconStyle>`,
          `</Style>`,
          `<Style id="line-${i}">`,
          `  <LineStyle><color>${c.line}</color><width>3</width></LineStyle>`,
          `</Style>`,
        );
      });

      days.forEach((day, dayIdx) => {
        const slots = computeTimeline(day);
        lines.push(`<Folder>`, `<name>${kmlEsc('第' + (dayIdx + 1) + '天｜' + day.label)}</name>`);

        const nodes = [];
        if (day.startHotelName?.trim())
          nodes.push({ name: day.startHotelName.trim(), label: '🏨 ' + day.startHotelName.trim(), desc: '出發' });
        day.spots.forEach((spot, si) => {
          if (!spot.name?.trim()) return;
          const sl = slots[spot.id];
          const parts = [];
          if (sl?.start) parts.push('抵達：' + sl.start);
          if (sl?.end)   parts.push('離開：' + sl.end);
          if (spot.stayDuration) parts.push('停留：' + spot.stayDuration + ' 分鐘');
          if (spot.notes?.trim()) parts.push(spot.notes.trim());
          nodes.push({ name: spot.name.trim(), label: '📍 ' + (si + 1) + '. ' + spot.name.trim(), desc: parts.join('　') });
        });
        if (day.endHotelName?.trim())
          nodes.push({ name: day.endHotelName.trim(), label: '🏨 ' + day.endHotelName.trim(), desc: '返回' });

        nodes.forEach(node => {
          const coord = coordMap[node.name];
          lines.push(
            `<Placemark>`,
            `  <name>${kmlEsc(node.label)}</name>`,
            `  <description>${kmlEsc(node.desc)}</description>`,
            `  <styleUrl>#pin-${dayIdx}</styleUrl>`,
          );
          if (coord) lines.push(`  <Point><coordinates>${coord.lng},${coord.lat},0</coordinates></Point>`);
          lines.push(`</Placemark>`);
        });

        const coordPts = nodes.map(n => coordMap[n.name]).filter(Boolean);
        if (coordPts.length >= 2) {
          lines.push(
            `<Placemark>`,
            `  <name>${kmlEsc('第' + (dayIdx + 1) + '天路線')}</name>`,
            `  <styleUrl>#line-${dayIdx}</styleUrl>`,
            `  <LineString><tessellate>1</tessellate>`,
            `    <coordinates>${coordPts.map(c => c.lng + ',' + c.lat + ',0').join(' ')}</coordinates>`,
            `  </LineString>`,
            `</Placemark>`,
          );
        }

        lines.push(`</Folder>`);
      });

      lines.push('</Document>', '</kml>');
      return lines.join('\n');
    }
  ```

- [ ] **Step 3：在瀏覽器 console 驗證 KML 結構**

  開啟 `tour-planner.html`，先在行程中加入至少 1 天、2 個景點（含出發飯店），在 console 執行：

  ```javascript
  const xml = generateKML(state.days, { '台北101': { lat: 25.033, lng: 121.565 } });
  console.log(xml);
  ```

  預期輸出包含：
  - `<kml xmlns="http://www.opengis.net/kml/2.2">`
  - `<Style id="pin-0">` 與 `<Style id="line-0">`
  - `<Folder>` 包含至少一個 `<Placemark>`
  - 景點有 `<Point><coordinates>121.565,25.033,0</coordinates></Point>`
  - 景點無座標時，Placemark 省略 `<Point>`（其他欄位仍在）

- [ ] **Step 4：驗證邊界條件**

  在 console 繼續執行：

  ```javascript
  // 空行程（0 天）
  const emptyXml = generateKML([], {});
  console.assert(emptyXml.includes('<Document>'), '應有 Document');
  console.assert(!emptyXml.includes('<Folder>'), '不應有 Folder');

  // 景點全無座標，折線應被省略
  const noCoordXml = generateKML(state.days, {});
  console.assert(!noCoordXml.includes('<LineString>'), '無座標時不應有折線');
  console.log('邊界條件通過');
  ```

- [ ] **Step 5：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add generateKML with per-day folders, styles, and polylines"
  ```

---

## Task 3：`exportKML()` — 主流程與進度 UI

**Files:**
- Modify: `tour-planner.html`（緊接在 `generateKML` 後插入）

- [ ] **Step 1：插入進度 UI helper 函數**

  緊接在 `generateKML` 函數後插入：

  ```javascript
    function showKmlProgress(current, total) {
      let el = document.getElementById('kml-progress');
      if (!el) {
        el = document.createElement('div');
        el.id = 'kml-progress';
        el.style.cssText = [
          'position:fixed', 'top:50%', 'left:50%',
          'transform:translate(-50%,-50%)',
          'background:var(--surface)', 'border:1px solid var(--border)',
          'border-radius:8px', 'padding:20px 28px',
          'font-size:14px', 'color:var(--text)',
          'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
          'z-index:9999', 'text-align:center', 'min-width:200px',
        ].join(';');
        document.body.appendChild(el);
      }
      el.textContent = `正在查詢座標 ${current} / ${total}…`;
    }

    function hideKmlProgress() {
      document.getElementById('kml-progress')?.remove();
    }

    function showKmlToast(msg) {
      const el = document.createElement('div');
      el.style.cssText = [
        'position:fixed', 'top:50%', 'left:50%',
        'transform:translate(-50%,-50%)',
        'background:var(--surface)', 'border:1px solid var(--border)',
        'border-radius:8px', 'padding:16px 24px',
        'font-size:13px', 'color:var(--text)',
        'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
        'z-index:9999', 'text-align:center',
      ].join(';');
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }
  ```

- [ ] **Step 2：插入 `exportKML` 主函數**

  緊接在上方 helper 後插入：

  ```javascript
    async function exportKML() {
      const nameSet = new Set();
      state.days.forEach(day => {
        if (day.startHotelName?.trim()) nameSet.add(day.startHotelName.trim());
        if (day.endHotelName?.trim())   nameSet.add(day.endHotelName.trim());
        day.spots.forEach(spot => { if (spot.name?.trim()) nameSet.add(spot.name.trim()); });
      });
      const names = [...nameSet];
      const total = names.length;

      showKmlProgress(0, total);

      const coordMap = {};
      let failCount = 0;
      for (let i = 0; i < names.length; i++) {
        showKmlProgress(i + 1, total);
        const geo = await geocodeForKML(names[i]);
        if (geo) coordMap[names[i]] = geo;
        else failCount++;
      }

      hideKmlProgress();

      const kml = generateKML(state.days, coordMap);
      const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${state.tripName}-${new Date().toISOString().slice(0, 10)}.kml`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);

      if (failCount > 0) showKmlToast(`${failCount} 個地點未找到座標，已略過定位`);
    }
  ```

- [ ] **Step 3：手動驗證 exportKML 流程**

  在瀏覽器中：
  1. 建立一個含 2 天、各 2 個景點的行程（用真實地名，例如「台北101」「故宮博物院」）
  2. 在 console 執行 `exportKML()`
  3. 確認畫面出現「正在查詢座標 X / N…」進度提示
  4. 確認下載出現 `.kml` 檔案
  5. 開啟下載的 `.kml`，確認 XML 格式正確（可用文字編輯器或 XML validator 確認）
  6. 確認進度提示在下載後消失

- [ ] **Step 4：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: add exportKML with geocoding progress overlay and download"
  ```

---

## Task 4：UI 接線 — 按鈕、action handler、help 說明

**Files:**
- Modify: `tour-planner.html:2769`（下拉選單中 `.ics` 按鈕後）
- Modify: `tour-planner.html:3444`（action handler 中 `export-ics` 行後）
- Modify: `tour-planner.html:2657`（help 說明段落）

- [ ] **Step 1：在下拉選單加入「匯出 KML」按鈕**

  找到第 2769 行（`📅 匯出行事曆 (.ics)` 按鈕的結尾 `</button>`），在其後插入：

  ```html
                    <button data-action="export-kml"
                      style="width:100%;text-align:left;padding:8px 12px;background:none;border:none;
                             color:var(--text);font-size:13px;cursor:pointer">
                      🗺 匯出地圖 (.kml)
                    </button>
  ```

  注意保持縮排與 `border-bottom` 樣式與其他按鈕一致（export-ics 本身無 border-bottom，KML 按鈕放在其後不需加）。

- [ ] **Step 2：在 action handler 加入 `export-kml` 分支**

  找到第 3444 行：
  ```javascript
        if (action === 'export-ics')      { localMenuOpen = false; render(); exportICS(); return; }
  ```

  在其正下方插入：
  ```javascript
        if (action === 'export-kml')      { localMenuOpen = false; render(); exportKML(); return; }
  ```

- [ ] **Step 3：在 Help 說明頁面補充 KML 說明**

  找到第 2657 行：
  ```html
                <div class="help-item">• <b>匯出行事曆 (.ics)</b>：下載 .ics 檔案，可匯入 Google 日曆、Apple 行事曆等；需先設定<b>旅行開始日期</b>才能包含正確日期</div>
  ```

  在其正下方插入：
  ```html
                <div class="help-item">• <b>匯出地圖 (.kml)</b>：下載 .kml 檔案，可匯入 <a href="https://mymaps.google.com" target="_blank" rel="noopener">Google My Maps</a>；每天為獨立圖層，包含景點 Pin 與路線折線。匯出時會自動查詢各景點座標（需連網）</div>
  ```

- [ ] **Step 4：同步更新 Help 說明頁的「本地」section 標題說明**

  找到第 2653 行：
  ```html
                <div class="help-item">• 點 <b>💾 本地 ▾</b> 展開選單，可選擇 <b>📤 匯出 JSON</b> 或 <b>📥 匯入 JSON</b></div>
  ```

  改為：
  ```html
                <div class="help-item">• 點 <b>💾 本地 ▾</b> 展開選單，可選擇 <b>📤 匯出 JSON</b>、<b>📥 匯入 JSON</b>、<b>🗺 匯出地圖 (.kml)</b> 等功能</div>
  ```

- [ ] **Step 5：更新說明頁底部「最後更新」欄位**

  找到 `renderHelpOverlay()` 中的「最後更新」日期文字，改為今天日期 `2026-07-14`。

- [ ] **Step 6：在瀏覽器完整端對端測試**

  1. 開啟 `tour-planner.html`
  2. 點 **💾 本地 ▾**，確認選單出現「🗺 匯出地圖 (.kml)」按鈕
  3. 點擊該按鈕，確認：
     - 下拉選單關閉
     - 進度提示出現並更新計數
     - `.kml` 檔案下載
     - 進度提示消失
  4. 點 **❓ 說明**，確認 Help 頁面的匯出段落有 KML 說明文字
  5. 將下載的 `.kml` 匯入 Google My Maps（mymaps.google.com → 建立新地圖 → 匯入），確認：
     - 每天出現一個獨立圖層
     - 景點 Pin 與飯店 Pin 出現在地圖上
     - 折線連接當天各節點
     - Pin 與折線顏色不同（Pin 紅，折線橙，或依天數對應色）

- [ ] **Step 7：commit**

  ```bash
  git add tour-planner.html
  git commit -m "feat: wire export-kml button, action handler, and help text"
  ```
