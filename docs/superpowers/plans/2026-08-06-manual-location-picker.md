# 手動/候選地點選取 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 當景點或飯店名稱難以自動定位時,讓使用者手動輸入地址重查、或從多筆候選地點中挑選正確座標。

**Architecture:** 在既有「純解析函式 + fetch 薄層」的 services 層新增「回多筆候選」的地理編碼函式;新增一個命令式對話框模組 `js/locate.js`(重用 `.tool-dialog` 樣式)供景點與飯店開啟;飯店新增扁平座標欄位並串接通勤估算、座標管理、KML 匯出等下游。

**Tech Stack:** 原生 ES modules(無框架、無 bundler)、Vitest(node 環境純函式測試)、瀏覽器 DOM 命令式 UI。

## Global Constraints

- 無建置流程:直接 `<script type="module">` 載入,不得引入需打包的相依或新 npm 套件。
- 不引入 Google Places SDK;候選來源沿用目前啟用服務(`nav.js` 門面:有金鑰先 Google Geocoder、回退 OSM Nominatim/Photon)。
- 狀態變更一律經 `state.js` 的 `commit(mutator, opts)`,不得直接改 `state`。
- 不可變風格:mutator 內修改的是 `commit` 傳入的 draft;services 純函式回新物件。
- 飯店採**扁平平行欄位**(`start/endHotelLat/Lng/Address`),不重構為物件。
- 純函式測試置於 `tests/*.test.js`,沿用現有風格(`describe/it/expect`,`vi.fn()` 注入 fetch)。
- 文件同步:`README.md`、`js/render/index.js` 的 `renderHelpOverlay()`(含底部「最後更新」欄位改為 2026-08-06 + 摘要)。

---

## File Structure

- `js/state.js` — Modify:`makeDay` 加飯店座標欄位;`migrateState` days.map 補齊。
- `js/services/geocode.js` — Modify:新增 `parseNominatimAll`、`parsePhotonAll`、`geocodeCandidates`。
- `js/services/gmaps.js` — Modify:新增 `parseGeocoderResultsAll`、`googleGeocodeCandidates`。
- `js/services/nav.js` — Modify:新增門面 `geocodeCandidates`。
- `js/locate.js` — Create:選地點對話框(`openLocatePicker`、`initLocate`)。
- `js/render/day.js` — Modify:`renderHotelItem` 加定位按鈕。
- `js/app.js` — Modify:`geocode-spot` 改開對話框、新增 `geocode-hotel`、初始化 `initLocate`、`resolveEndpointCoords` 優先用飯店座標。
- `js/tools.js` — Modify:`resolveNodeCoords` 用飯店座標;`openCoordManager` 納入飯店 + 每列「選」入口。
- `js/services/export.js` — Modify:`toKml` 飯店帶座標 + 納入路徑。
- 測試:`tests/services.test.js`(候選解析)、`tests/state-migrate.test.js`(飯店欄位)、`tests/export.test.js`(KML 飯店座標)。

---

## Task 1: 飯店座標資料模型 + 遷移

**Files:**
- Modify: `js/state.js:22-31`(`makeDay`)、`js/state.js:93-107`(`migrateState` days.map)
- Test: `tests/state-migrate.test.js`

**Interfaces:**
- Produces: `makeDay(index)` 回傳物件新增 `startHotelLat/startHotelLng/startHotelAddress/endHotelLat/endHotelLng/endHotelAddress`(座標預設 `null`、地址 `""`)。`migrateState` 輸出的每個 day 皆含這些欄位。

- [ ] **Step 1: 寫失敗測試**

在 `tests/state-migrate.test.js` 的 `describe("state 模型擴充", …)` 內新增:

```js
it("makeDay 具備飯店座標欄位且預設空", () => {
  const d = makeDay(1);
  expect(d.startHotelLat).toBeNull();
  expect(d.startHotelLng).toBeNull();
  expect(d.startHotelAddress).toBe("");
  expect(d.endHotelLat).toBeNull();
  expect(d.endHotelLng).toBeNull();
  expect(d.endHotelAddress).toBe("");
});

it("migrateState 為舊 day 補齊飯店座標欄位、保留既有飯店名稱與座標", () => {
  const old = {
    version: 3,
    days: [
      { id: "d1", label: "第 1 天", startHotelName: "旅館A", spots: [] },
      { id: "d2", label: "第 2 天", startHotelName: "旅館B", startHotelLat: 35.6, startHotelLng: 139.7, startHotelAddress: "Tokyo", spots: [] },
    ],
  };
  const m = migrateState(old);
  expect(m.days[0].startHotelName).toBe("旅館A");
  expect(m.days[0].startHotelLat).toBeNull();
  expect(m.days[0].endHotelAddress).toBe("");
  expect(m.days[1].startHotelLat).toBe(35.6);
  expect(m.days[1].startHotelLng).toBe(139.7);
  expect(m.days[1].startHotelAddress).toBe("Tokyo");
});
```

在 `tests/state-migrate.test.js` 頂部 import 補上 `makeDay`:

```js
import { defaultState, makeDay, makeSpot, migrateState } from "../js/state.js";
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run tests/state-migrate.test.js`
Expected: FAIL(`startHotelLat` 為 undefined)

- [ ] **Step 3: 改 `makeDay`(js/state.js:22-31)**

```js
export function makeDay(index) {
  return {
    id: genId(),
    label: `第 ${index} 天`,
    startTime: "",
    startHotelName: "",
    startHotelLat: null,
    startHotelLng: null,
    startHotelAddress: "",
    endHotelName: "",
    endHotelLat: null,
    endHotelLng: null,
    endHotelAddress: "",
    spots: [],
  };
}
```

- [ ] **Step 4: 改 `migrateState` 的 days.map(js/state.js:93-107)**

將回傳物件由:

```js
    out.days = s.days.map((d, i) => ({
      id: typeof d.id === "string" ? d.id : genId(),
      label: typeof d.label === "string" ? d.label : `第 ${i + 1} 天`,
      startTime: typeof d.startTime === "string" ? d.startTime : "",
      startHotelName: d.startHotelName || d.hotelName || "",
      endHotelName: d.endHotelName || d.hotelName || "",
      spots: Array.isArray(d.spots)
        ? d.spots.map((sp) => ({
```

改為(加入 6 個座標欄位,以 `?? null` / `|| ""` 容錯):

```js
    out.days = s.days.map((d, i) => ({
      id: typeof d.id === "string" ? d.id : genId(),
      label: typeof d.label === "string" ? d.label : `第 ${i + 1} 天`,
      startTime: typeof d.startTime === "string" ? d.startTime : "",
      startHotelName: d.startHotelName || d.hotelName || "",
      startHotelLat: typeof d.startHotelLat === "number" ? d.startHotelLat : null,
      startHotelLng: typeof d.startHotelLng === "number" ? d.startHotelLng : null,
      startHotelAddress: typeof d.startHotelAddress === "string" ? d.startHotelAddress : "",
      endHotelName: d.endHotelName || d.hotelName || "",
      endHotelLat: typeof d.endHotelLat === "number" ? d.endHotelLat : null,
      endHotelLng: typeof d.endHotelLng === "number" ? d.endHotelLng : null,
      endHotelAddress: typeof d.endHotelAddress === "string" ? d.endHotelAddress : "",
      spots: Array.isArray(d.spots)
        ? d.spots.map((sp) => ({
```

(其餘 spots.map 內容不動)

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run tests/state-migrate.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/state.js tests/state-migrate.test.js
git commit -m "feat: 飯店新增座標欄位與遷移"
```

---

## Task 2: 候選地理編碼(OSM 純函式 + 門面)

**Files:**
- Modify: `js/services/geocode.js`
- Test: `tests/services.test.js`

**Interfaces:**
- Consumes: 既有 `parseNominatim`、`parsePhoton` 的資料形狀。
- Produces:
  - `parseNominatimAll(data, limit = 5)` → `Array<{lat:number,lng:number,address:string}>`(過濾 NaN;非陣列/空 → `[]`;截到 limit)。
  - `parsePhotonAll(data, limit = 5)` → 同上(逐 feature 解析;無 features → `[]`)。
  - `geocodeCandidates(name, fetchImpl = fetch)` → `Promise<Array<{lat,lng,address}>>`(Nominatim `limit=5`,空或失敗回退 Photon;皆失敗 → `[]`)。

- [ ] **Step 1: 寫失敗測試**

在 `tests/services.test.js` 找到已 import `parseNominatim, parsePhoton` 的那行,補上多筆函式:

```js
import { parseNominatim, parsePhoton, parseNominatimAll, parsePhotonAll } from "../js/services/geocode.js";
```

在 geocode 相關 `describe` 內新增:

```js
it("parseNominatimAll 回多筆並截到 limit、過濾 NaN", () => {
  const data = [
    { lat: "35.68", lon: "139.76", display_name: "A" },
    { lat: "34.69", lon: "135.50", display_name: "B" },
    { lat: "x", lon: "y", display_name: "壞資料" },
  ];
  expect(parseNominatimAll(data)).toEqual([
    { lat: 35.68, lng: 139.76, address: "A" },
    { lat: 34.69, lng: 135.5, address: "B" },
  ]);
  expect(parseNominatimAll(data, 1)).toHaveLength(1);
  expect(parseNominatimAll([])).toEqual([]);
  expect(parseNominatimAll(null)).toEqual([]);
});

it("parsePhotonAll 逐 feature 解析", () => {
  const data = { features: [
    { geometry: { coordinates: [139.76, 35.68] }, properties: { name: "Tokyo Tower", city: "Tokyo", country: "Japan" } },
    { geometry: { coordinates: [135.5, 34.69] }, properties: { name: "Osaka" } },
  ] };
  expect(parsePhotonAll(data)).toEqual([
    { lat: 35.68, lng: 139.76, address: "Tokyo Tower, Tokyo, Japan" },
    { lat: 34.69, lng: 135.5, address: "Osaka" },
  ]);
  expect(parsePhotonAll({ features: [] })).toEqual([]);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run tests/services.test.js`
Expected: FAIL(`parseNominatimAll` is not a function)

- [ ] **Step 3: 實作 geocode.js 多筆函式**

在 `js/services/geocode.js` 的 `parsePhoton` 之後、`lastNominatimReq` 宣告之前,新增:

```js
/** 解析 Nominatim 回應 → 多筆 [{lat,lng,address}]（過濾無效座標，截到 limit） */
export function parseNominatimAll(data, limit = 5) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const r of data) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    out.push({ lat, lng, address: r.display_name || "" });
    if (out.length >= limit) break;
  }
  return out;
}

/** 解析 Photon(GeoJSON) 回應 → 多筆 [{lat,lng,address}] */
export function parsePhotonAll(data, limit = 5) {
  const feats = Array.isArray(data?.features) ? data.features : [];
  const out = [];
  for (const f of feats) {
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c)) continue;
    const [lng, lat] = c;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const p = f.properties || {};
    out.push({ lat, lng, address: [p.name, p.street, p.city, p.country].filter(Boolean).join(", ") });
    if (out.length >= limit) break;
  }
  return out;
}
```

在檔案結尾(`geocode` 函式之後)新增門面:

```js
/**
 * 候選地理編碼 → 多筆 [{lat,lng,address}]（找不到回 []）。
 * Nominatim limit=5，空或失敗回退 Photon。
 * @param {string} name
 * @param {typeof fetch} [fetchImpl]
 */
export async function geocodeCandidates(name, fetchImpl = fetch) {
  const encoded = encodeURIComponent(name);

  const now = Date.now();
  const wait = 2000 - (now - lastNominatimReq);
  if (wait > 0 && lastNominatimReq > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastNominatimReq = Date.now();

  try {
    const res = await fetchImpl(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5`,
      { headers: { "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8" } }
    );
    if (res.ok) {
      const list = parseNominatimAll(await res.json());
      if (list.length) return list;
    }
  } catch (_) {
    /* 落到 Photon 備援 */
  }

  try {
    const res = await fetchImpl(`https://photon.komoot.io/api/?q=${encoded}&limit=5`);
    if (!res.ok) return [];
    return parsePhotonAll(await res.json());
  } catch (_) {
    return [];
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run tests/services.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/services/geocode.js tests/services.test.js
git commit -m "feat: OSM 候選地理編碼（回多筆）"
```

---

## Task 3: 候選地理編碼(Google 解析 + 門面)

**Files:**
- Modify: `js/services/gmaps.js`、`js/services/nav.js`
- Test: `tests/services.test.js`

**Interfaces:**
- Consumes: `parseGeocoderResults` 的結果形狀;`geocode.js` 的 `geocodeCandidates`;`gmaps.js` 的 `loadGoogleMaps`。
- Produces:
  - `parseGeocoderResultsAll(results)` → `Array<{lat,lng,address}>`(location 可為函式或數值;過濾 NaN)。
  - `googleGeocodeCandidates(name, key)` → `Promise<Array<{lat,lng,address}>>`(失敗 `[]`)。
  - `nav.js` 的 `geocodeCandidates(name)` → `Promise<Array<{lat,lng,address}>>`(有金鑰先 Google、空或失敗回退 OSM)。

- [ ] **Step 1: 寫失敗測試**

在 `tests/services.test.js` 找到已 import `parseGeocoderResults` 的那組 import,補上 `parseGeocoderResultsAll`(與現有 gmaps import 同一區塊):

```js
import {
  googleTravelMode,
  parseGeocoderResults,
  parseGeocoderResultsAll,
  parseDirectionsSeconds,
} from "../js/services/gmaps.js";
```

(若現有 import 清單不同,只需在其中加入 `parseGeocoderResultsAll` 一行,保留其餘原樣。)

在 gmaps 相關 `describe` 內新增:

```js
it("parseGeocoderResultsAll 支援函式式與數值式 location、過濾無效", () => {
  const results = [
    { geometry: { location: { lat: () => 35.68, lng: () => 139.76 } }, formatted_address: "Tokyo" },
    { geometry: { location: { lat: 34.69, lng: 135.5 } }, formatted_address: "Osaka" },
    { geometry: {} },
  ];
  expect(parseGeocoderResultsAll(results)).toEqual([
    { lat: 35.68, lng: 139.76, address: "Tokyo" },
    { lat: 34.69, lng: 135.5, address: "Osaka" },
  ]);
  expect(parseGeocoderResultsAll([])).toEqual([]);
  expect(parseGeocoderResultsAll(null)).toEqual([]);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run tests/services.test.js`
Expected: FAIL(`parseGeocoderResultsAll` is not a function)

- [ ] **Step 3: 實作 gmaps.js**

在 `js/services/gmaps.js` 的 `parseGeocoderResults` 之後新增:

```js
/** 解析 Geocoder 多筆結果 → [{lat,lng,address}]（過濾無效座標） */
export function parseGeocoderResultsAll(results) {
  const list = Array.isArray(results) ? results : [];
  const out = [];
  for (const r of list) {
    const loc = r?.geometry?.location;
    if (!loc) continue;
    const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
    const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
    if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) continue;
    out.push({ lat, lng, address: r.formatted_address || "" });
  }
  return out;
}
```

在 `googleGeocode` 之後新增:

```js
/**
 * 以 Google Geocoder 查地名 → 多筆 [{lat,lng,address}]（失敗回 []）
 * @param {string} name
 * @param {string} key
 */
export async function googleGeocodeCandidates(name, key) {
  try {
    const maps = await loadGoogleMaps(key);
    const geocoder = new maps.Geocoder();
    const resp = await geocoder.geocode({ address: name });
    return parseGeocoderResultsAll(resp?.results);
  } catch (_) {
    return [];
  }
}
```

- [ ] **Step 4: 實作 nav.js 門面**

在 `js/services/nav.js` 頂部 import 補上多筆函式:

```js
import { geocode as osmGeocode, geocodeCandidates as osmGeocodeCandidates } from "./geocode.js";
```

```js
import { googleGeocode, googleGeocodeCandidates, googleRouteSeconds, isGoogleAuthFailed } from "./gmaps.js";
```

在 `geocodePlace` 之後新增:

```js
/**
 * 候選地名 → 多筆 [{lat,lng,address}]（找不到回 []）。有 Google key 先試 Google、空則回退 OSM。
 * @param {string} name
 */
export async function geocodeCandidates(name) {
  const key = activeGoogleKey();
  if (key) {
    const g = await googleGeocodeCandidates(name, key);
    if (g.length) return g;
  }
  return osmGeocodeCandidates(name);
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run tests/services.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add js/services/gmaps.js js/services/nav.js tests/services.test.js
git commit -m "feat: Google 候選地理編碼與 nav 門面 geocodeCandidates"
```

---

## Task 4: 選地點對話框 `js/locate.js`

**Files:**
- Create: `js/locate.js`
- Modify: `js/app.js`(初始化 `initLocate`)

**Interfaces:**
- Consumes: `nav.js` 的 `geocodeCandidates`、`navServiceName`、`activeGoogleKey`、`isGoogleAuthFailed`;`state.js` 的 `getState`、`commit`;`utils.js` 的 `escapeHtml`、`escapeAttr`。
- Produces:
  - `initLocate()`:建立 `#locate-root` 容器(比照 `tools.js` 的 `initTools`,含 Esc 關閉)。
  - `openLocatePicker(target)`:`target` 為 `{ kind: "spot", dayId, spotId }` 或 `{ kind: "hotel", dayId, field: "startHotelName" | "endHotelName" }`。開啟即以目前名稱自動搜尋、列候選;點選寫回座標;可改字重搜、清除定位。

**說明:** 此模組無純函式可獨立單元測試(全為 DOM/非同步),採「實作 + 手動驗證」;正確性由其消費的純函式(Task 2/3)測試保障。寫完以 `npm run serve` 手動走查。

- [ ] **Step 1: 建立 `js/locate.js`**

```js
/* ============================================================
   locate.js — 選地點對話框（景點／飯店手動定位、候選挑選）
   ------------------------------------------------------------
   自建 #locate-root 獨立容器（比照 tools.js），與主渲染迴圈解耦。
   開啟即以目前名稱查 geocodeCandidates（nav 門面：Google 先、回退 OSM），
   列出多筆候選；點選任一列即以 commit 寫回座標與地址；可改字重搜、清除定位。
   target:
     { kind:"spot",  dayId, spotId }
     { kind:"hotel", dayId, field:"startHotelName"|"endHotelName" }
   ============================================================ */

import { escapeHtml, escapeAttr } from "./utils.js";
import { getState, commit } from "./state.js";
import { geocodeCandidates, navServiceName, activeGoogleKey, isGoogleAuthFailed } from "./services/nav.js";

let mount = null;

export function initLocate() {
  if (mount) return;
  mount = document.createElement("div");
  mount.id = "locate-root";
  document.body.appendChild(mount);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mount.dataset.open) closeLocate();
  });
}

function closeLocate() {
  if (!mount) return;
  mount.innerHTML = "";
  delete mount.dataset.open;
}

/** 由 target 取得目前名稱與已解析地址（供標題/預填/狀態） */
function readTarget(target) {
  const day = getState().days.find((d) => d.id === target.dayId);
  if (!day) return null;
  if (target.kind === "spot") {
    const spot = day.spots.find((s) => s.id === target.spotId);
    if (!spot) return null;
    return { name: (spot.name || "").trim(), located: spot.lat != null, address: spot.resolvedAddress || "" };
  }
  const isStart = target.field === "startHotelName";
  return {
    name: ((isStart ? day.startHotelName : day.endHotelName) || "").trim(),
    located: (isStart ? day.startHotelLat : day.endHotelLat) != null,
    address: (isStart ? day.startHotelAddress : day.endHotelAddress) || "",
  };
}

/** 把選定座標/地址寫回 target（spot 或 hotel）；lat=null 表示清除定位 */
function saveTarget(target, lat, lng, address) {
  commit((d) => {
    const day = d.days.find((x) => x.id === target.dayId);
    if (!day) return;
    if (target.kind === "spot") {
      const sp = day.spots.find((x) => x.id === target.spotId);
      if (sp) { sp.lat = lat; sp.lng = lng; sp.resolvedAddress = address; }
      return;
    }
    if (target.field === "startHotelName") {
      day.startHotelLat = lat; day.startHotelLng = lng; day.startHotelAddress = address;
    } else {
      day.endHotelLat = lat; day.endHotelLng = lng; day.endHotelAddress = address;
    }
  });
}

export function openLocatePicker(target) {
  if (!mount) initLocate();
  const info = readTarget(target);
  if (!info) return;

  mount.innerHTML = `
    <div class="tool-backdrop"></div>
    <div class="tool-dialog" role="dialog" aria-modal="true" aria-label="選擇地點">
      <div class="tool-title">📍 選擇地點${info.name ? "：" + escapeHtml(info.name) : ""}</div>
      <p class="tool-desc">找不到或選錯時，可改下方關鍵字重新搜尋，再從候選清單挑選正確地點。透過${escapeHtml(navServiceName())}查詢。</p>
      <div class="tool-bar" style="gap:8px">
        <input type="text" id="locate-q" class="share-input" style="flex:1"
               value="${escapeAttr(info.name)}" placeholder="輸入地名或地址…" aria-label="搜尋地點" />
        <button class="btn btn--sm btn--primary" id="locate-search">搜尋</button>
      </div>
      <div class="tool-list" id="locate-list"></div>
      <div class="tool-status" id="locate-status"></div>
      <div class="tool-actions">
        <button class="btn btn--sm btn--ghost" data-locate="close">關閉</button>
        <button class="btn btn--sm btn--ghost btn--danger" id="locate-clear" ${info.located ? "" : "disabled"}>清除定位</button>
      </div>
    </div>`;
  mount.dataset.open = "1";

  const backdrop = mount.querySelector(".tool-backdrop");
  const input = mount.querySelector("#locate-q");
  const searchBtn = mount.querySelector("#locate-search");
  const listEl = mount.querySelector("#locate-list");
  const statusEl = mount.querySelector("#locate-status");
  const clearBtn = mount.querySelector("#locate-clear");

  backdrop?.addEventListener("click", closeLocate);
  mount.querySelector('[data-locate="close"]')?.addEventListener("click", closeLocate);

  const googleWarn = () =>
    activeGoogleKey() && isGoogleAuthFailed()
      ? "（⚠ Google 驗證失敗，已改用免費服務）"
      : "";

  async function runSearch() {
    const q = (input.value || "").trim();
    if (!q) { statusEl.textContent = "請先輸入地名或地址"; return; }
    searchBtn.disabled = true;
    listEl.innerHTML = "";
    statusEl.textContent = "查詢中…";
    let results = [];
    try {
      results = await geocodeCandidates(q);
    } catch (_) {
      results = [];
    }
    searchBtn.disabled = false;
    if (!results.length) {
      statusEl.textContent = "找不到，請改關鍵字重試" + googleWarn();
      return;
    }
    statusEl.textContent = `找到 ${results.length} 筆，點選採用` + googleWarn();
    listEl.innerHTML = results
      .map(
        (r, i) => `
        <button class="tool-row locate-pick" data-idx="${i}" style="width:100%;text-align:left;cursor:pointer">
          <span class="tool-icon">📌</span>
          <span class="tool-row__name">${escapeHtml(r.address || `${r.lat}, ${r.lng}`)}</span>
        </button>`
      )
      .join("");
    listEl.querySelectorAll(".locate-pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = results[Number(btn.dataset.idx)];
        if (!r) return;
        saveTarget(target, r.lat, r.lng, r.address || "");
        closeLocate();
      });
    });
  }

  searchBtn.addEventListener("click", runSearch);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
  clearBtn?.addEventListener("click", () => {
    saveTarget(target, null, null, "");
    closeLocate();
  });

  // 開啟即自動搜一次（有名稱時）
  if (info.name) runSearch();
  else input.focus();
}
```

- [ ] **Step 2: 在 app.js 初始化 `initLocate`**

在 `js/app.js` import 區塊(第 22 行 `import { initTools, ... }` 附近)新增:

```js
import { initLocate, openLocatePicker } from "./locate.js";
```

找到啟動時呼叫 `initTools()` 的位置(bootstrap 段),於其後加一行 `initLocate();`。

Run: `grep -n "initTools()" js/app.js`  找到呼叫點後於其下一行加入 `initLocate();`。

- [ ] **Step 3: 手動驗證(先接上 Task 5 前的暫時檢查)**

此步僅確認模組可載入無語法錯誤:

Run: `node -e "import('./js/locate.js').then(()=>console.log('ok')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: 印出 `ok`(node 環境載入模組不報錯;DOM 相關程式碼未執行)。

- [ ] **Step 4: Commit**

```bash
git add js/locate.js js/app.js
git commit -m "feat: 選地點對話框模組 locate.js"
```

---

## Task 5: 接線景點與飯店定位按鈕

**Files:**
- Modify: `js/render/day.js`(`renderHotelItem` 加按鈕)、`js/app.js`(`geocode-spot` 改開對話框、新增 `geocode-hotel`、移除舊 `geocodeSpot`)

**Interfaces:**
- Consumes: Task 4 的 `openLocatePicker(target)`。
- Produces: 景點 `data-action="geocode-spot"` 與飯店 `data-action="geocode-hotel"` 皆開對話框。飯店按鈕帶 `data-day` 與 `data-field`。

- [ ] **Step 1: 改 `renderHotelItem`(js/render/day.js:153-167)**

將飯店卡片內容加入定位按鈕(位於名稱 input 之後、`.hotel-card` 內):

```js
function renderHotelItem({ slot, tag, dayId, field, value, placeholder, located, address }) {
  return `
    <li class="tl-item">
      <span class="tl-time">${escapeHtml(formatSlot(slot))}</span>
      <span class="tl-rail"><span class="tl-dot tl-dot--hotel" style="--dot-color:var(--color-success)"></span></span>
      <div class="tl-content">
        <div class="hotel-card">
          <span class="hotel-card__tag">${escapeHtml(tag)}</span>
          <input type="text" data-action="hotel-name" data-day="${escapeAttr(dayId)}"
                 data-field="${escapeAttr(field)}" value="${escapeAttr(value)}"
                 placeholder="${escapeAttr(placeholder)}" aria-label="${escapeAttr(tag)}飯店名稱" />
          <button class="btn btn--icon btn--ghost ${located ? "is-located" : ""}"
                  data-action="geocode-hotel" data-day="${escapeAttr(dayId)}" data-field="${escapeAttr(field)}"
                  title="${located ? "已定位：" + escapeAttr(address || "") : "定位座標 / 選擇地點"}"
                  aria-label="定位${escapeHtml(tag)}座標">${located ? "📍" : "🔍"}</button>
        </div>
      </div>
    </li>`;
}
```

- [ ] **Step 2: 更新兩處 `renderHotelItem` 呼叫(js/render/day.js:98-107 與 131-140)**

起點呼叫加入 `located`/`address`:

```js
  items.push(
    renderHotelItem({
      slot: slots[hotelStartId(day.id)],
      tag: "起點",
      dayId: day.id,
      field: "startHotelName",
      value: day.startHotelName,
      placeholder: "起點飯店 / 出發地",
      located: day.startHotelLat != null,
      address: day.startHotelAddress,
    })
  );
```

終點呼叫同理:

```js
    items.push(
      renderHotelItem({
        slot: slots[hotelEndId(day.id)],
        tag: "終點",
        dayId: day.id,
        field: "endHotelName",
        value: day.endHotelName,
        placeholder: "終點飯店 / 返回地",
        located: day.endHotelLat != null,
        address: day.endHotelAddress,
      })
    );
```

- [ ] **Step 3: 改 app.js 的 `geocode-spot` case 並新增 `geocode-hotel`(js/app.js:396-398)**

將:

```js
    case "geocode-spot":
      geocodeSpot(dayId, spotId, el);
      break;
```

改為:

```js
    case "geocode-spot":
      openLocatePicker({ kind: "spot", dayId, spotId });
      return;

    case "geocode-hotel":
      openLocatePicker({ kind: "hotel", dayId, field: el.dataset.field });
      return;
```

- [ ] **Step 4: 移除已無用的 `geocodeSpot` 函式(js/app.js:657-676)**

刪除整個 `async function geocodeSpot(dayId, spotId, btn) { … }`。若 `geocodePlace` 已無其他 import 使用,將第 27 行 import 中的 `geocodePlace` 移除(先確認):

Run: `grep -n "geocodePlace" js/app.js`
若僅剩 import 那一行,從 `import { geocodePlace, routeSeconds, departureForDay }` 移除 `geocodePlace`(但 Task 6 會在 `resolveEndpointCoords` 用到 `geocodePlace`,故**保留** import 不動)。

> 注意:`resolveEndpointCoords`(js/app.js:679-690)仍使用 `geocodePlace`,因此 `geocodePlace` import 必須保留。僅刪除 `geocodeSpot` 函式本身。

- [ ] **Step 5: 手動驗證**

Run: `npm run serve`,瀏覽器開 `http://localhost:8080`。
Expected:
- 景點卡片 🔍 → 開對話框、自動列候選、點選後卡片顯 📍 與地址連結。
- 飯店卡片名稱旁出現 🔍,點擊 → 開對話框、可搜尋挑選;選後顯 📍。

- [ ] **Step 6: 跑既有測試確保未破壞**

Run: `npm test`
Expected: PASS(全綠)

- [ ] **Step 7: Commit**

```bash
git add js/render/day.js js/app.js
git commit -m "feat: 景點/飯店定位按鈕改開選地點對話框"
```

---

## Task 6: 通勤估算優先用飯店座標

**Files:**
- Modify: `js/tools.js`(`resolveNodeCoords`,js/tools.js:179-193)、`js/app.js`(`resolveEndpointCoords`,js/app.js:679-690)

**Interfaces:**
- Consumes: Task 1 的飯店座標欄位。
- Produces: 飯店端點解析時,先回既有 `day.start/endHotelLat/Lng`,無才 geocode 名稱。

- [ ] **Step 1: 改 `js/tools.js` 的 `resolveNodeCoords`(179-193)**

將飯店分支由「一律 geocode 名稱」改為「優先既有座標」:

```js
async function resolveNodeCoords(seg, endpoint, cache) {
  const day = getState().days.find((d) => d.id === seg.dayId);
  if (!day) return null;
  const nodeId = endpoint === "from" ? seg.fromId : seg.toId;
  const nodeName = endpoint === "from" ? seg.fromName : seg.toName;
  if (nodeId === hotelStartId(seg.dayId)) {
    if (day.startHotelLat != null && day.startHotelLng != null) return { lat: day.startHotelLat, lng: day.startHotelLng };
    return nodeName ? cachedGeocode(nodeName, cache) : null;
  }
  if (nodeId === hotelEndId(seg.dayId)) {
    if (day.endHotelLat != null && day.endHotelLng != null) return { lat: day.endHotelLat, lng: day.endHotelLng };
    return nodeName ? cachedGeocode(nodeName, cache) : null;
  }
  const spot = day.spots.find((s) => s.id === nodeId);
  if (!spot) return null;
  if (spot.lat != null && spot.lng != null) return { lat: spot.lat, lng: spot.lng };
  const nm = (spot.name || "").trim();
  return nm ? cachedGeocode(nm, cache) : null;
}
```

- [ ] **Step 2: 改 `js/app.js` 的 `resolveEndpointCoords`(679-690)**

飯店端點優先用既有座標:

```js
async function resolveEndpointCoords(day, id) {
  if (id === hotelStartId(day.id)) {
    if (day.startHotelLat != null && day.startHotelLng != null) return { lat: day.startHotelLat, lng: day.startHotelLng };
    const name = (day.startHotelName || "").trim();
    return name ? geocodePlace(name) : null;
  }
  if (id === hotelEndId(day.id)) {
    if (day.endHotelLat != null && day.endHotelLng != null) return { lat: day.endHotelLat, lng: day.endHotelLng };
    const name = (day.endHotelName || "").trim();
    return name ? geocodePlace(name) : null;
  }
  const spot = day.spots.find((s) => s.id === id);
  if (!spot) return null;
  if (spot.lat != null && spot.lng != null) return { lat: spot.lat, lng: spot.lng };
  if (!spot.name.trim()) return null;
  return geocodePlace(spot.name.trim());
}
```

- [ ] **Step 3: 跑既有測試確保未破壞**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/tools.js js/app.js
git commit -m "feat: 通勤估算優先使用飯店既有座標"
```

---

## Task 7: 座標管理納入飯店 + 每列「選」入口

**Files:**
- Modify: `js/tools.js`(`openCoordManager`,js/tools.js:56-146)

**Interfaces:**
- Consumes: Task 4 的 `openLocatePicker`;Task 1 飯店座標欄位。
- Produces: 座標管理清單同時含景點與飯店端點,可批次定位飯店(寫回飯店座標);每列有「選」鈕開對話框。

- [ ] **Step 1: 在 tools.js import 補上 openLocatePicker**

`js/tools.js` 頂部 import 區新增:

```js
import { openLocatePicker } from "./locate.js";
```

- [ ] **Step 2: 改 `openCoordManager` 的 items 收集(js/tools.js:58-71)**

改為同時收集景點與飯店端點,每項帶 `kind`:

```js
  const items = [];
  getState().days.forEach((day, i) => {
    const dayLabel = `第 ${i + 1} 天`;
    if ((day.startHotelName || "").trim()) {
      items.push({
        key: `hs_${day.id}`, kind: "hotel", dayId: day.id, field: "startHotelName",
        name: day.startHotelName.trim(), dayLabel: `${dayLabel}·起點`, hasCoords: day.startHotelLat != null,
      });
    }
    day.spots.forEach((spot) => {
      const name = (spot.name || "").trim();
      if (!name) return;
      items.push({
        key: `sp_${spot.id}`, kind: "spot", spotId: spot.id, dayId: day.id,
        name, dayLabel, hasCoords: spot.lat != null && spot.lng != null,
      });
    });
    if ((day.endHotelName || "").trim()) {
      items.push({
        key: `he_${day.id}`, kind: "hotel", dayId: day.id, field: "endHotelName",
        name: day.endHotelName.trim(), dayLabel: `${dayLabel}·終點`, hasCoords: day.endHotelLat != null,
      });
    }
  });
```

- [ ] **Step 3: 改列渲染以 `key` 為識別、加「選」鈕(js/tools.js:73-85)**

```js
  const rows = items.length
    ? items
        .map(
          (it) => `
        <div class="tool-row" data-key="${escapeAttr(it.key)}">
          <input type="checkbox" class="tool-cb" data-key="${escapeAttr(it.key)}" ${it.hasCoords ? "" : "checked"} />
          <span class="tool-icon" data-key="${escapeAttr(it.key)}">${it.hasCoords ? "🟢" : "🔴"}</span>
          <span class="tool-row__name">${escapeHtml(it.name)}</span>
          <span class="tool-row__day">${escapeHtml(it.dayLabel)}</span>
          <button class="btn btn--sm btn--ghost tool-pick" data-key="${escapeAttr(it.key)}" title="手動選擇地點">選</button>
        </div>`
        )
        .join("")
    : `<div class="tool-empty">（尚無景點或飯店）</div>`;
```

- [ ] **Step 4: 更新選取器與事件以 `data-key` 為準(js/tools.js:104-116)**

將 `cbFor`/`iconFor` 由 `data-spot` 改為 `data-key`,並用 `it.key`:

```js
  const cbFor = (key) => mount.querySelector(`.tool-cb[data-key="${cssId(key)}"]`);
  const iconFor = (key) => mount.querySelector(`.tool-icon[data-key="${cssId(key)}"]`);
  const statusEl = mount.querySelector("#tool-status");
  const refreshBtn = mount.querySelector("#tool-refresh");

  mount.querySelector("#tool-all")?.addEventListener("change", (e) => {
    items.forEach((it) => { const cb = cbFor(it.key); if (cb) cb.checked = e.target.checked; });
  });
  mount.querySelector("#tool-fail")?.addEventListener("click", () => {
    const allCb = mount.querySelector("#tool-all");
    if (allCb) allCb.checked = false;
    items.forEach((it) => { const cb = cbFor(it.key); if (cb) cb.checked = !it.hasCoords; });
  });

  // 每列「選」→ 開對話框（關閉座標管理避免兩層對話框）
  mount.querySelectorAll(".tool-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const it = items.find((x) => x.key === btn.dataset.key);
      if (!it) return;
      closeTools();
      openLocatePicker(
        it.kind === "hotel"
          ? { kind: "hotel", dayId: it.dayId, field: it.field }
          : { kind: "spot", dayId: it.dayId, spotId: it.spotId }
      );
    });
  });
```

- [ ] **Step 5: 更新批次查詢寫回,支援飯店(js/tools.js:118-145)**

```js
  refreshBtn?.addEventListener("click", async () => {
    const selected = items.filter((it) => cbFor(it.key)?.checked);
    if (!selected.length) { statusEl.textContent = "請先勾選項目"; return; }
    refreshBtn.disabled = true;
    let ok = 0, fail = 0;
    for (let i = 0; i < selected.length; i++) {
      const it = selected[i];
      statusEl.textContent = `查詢中… ${i + 1} / ${selected.length}`;
      const icon = iconFor(it.key);
      if (icon) icon.textContent = "⏳";
      const geo = await geocodePlace(it.name);
      commit((d) => {
        const day = d.days.find((x) => x.id === it.dayId);
        if (!day) return;
        if (it.kind === "hotel") {
          if (it.field === "startHotelName") {
            day.startHotelLat = geo?.lat ?? null; day.startHotelLng = geo?.lng ?? null; day.startHotelAddress = geo?.address ?? "";
          } else {
            day.endHotelLat = geo?.lat ?? null; day.endHotelLng = geo?.lng ?? null; day.endHotelAddress = geo?.address ?? "";
          }
        } else {
          const sp = day.spots.find((x) => x.id === it.spotId);
          if (sp) { sp.lat = geo?.lat ?? null; sp.lng = geo?.lng ?? null; sp.resolvedAddress = geo?.address ?? null; }
        }
      });
      it.hasCoords = !!geo;
      if (icon) icon.textContent = geo ? "🟢" : "🔴";
      const cb = cbFor(it.key);
      if (cb) cb.checked = !geo;
      geo ? ok++ : fail++;
    }
    statusEl.textContent = `完成：成功 ${ok} 個` + (fail ? `、失敗 ${fail} 個（找不到地點）` : "") + googleWarnSuffix();
    refreshBtn.disabled = false;
  });
```

- [ ] **Step 6: 手動驗證**

Run: `npm run serve`,開座標管理面板。
Expected: 清單同時列出飯店(起點/終點)與景點;勾選批次可定位飯店;每列「選」開對話框。

- [ ] **Step 7: 跑既有測試**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add js/tools.js
git commit -m "feat: 座標管理納入飯店並提供每列手動選地點"
```

---

## Task 8: KML 匯出含飯店座標

**Files:**
- Modify: `js/services/export.js`(`toKml`,js/services/export.js:164-177)
- Test: `tests/export.test.js`

**Interfaces:**
- Consumes: Task 1 飯店座標欄位。
- Produces: `toKml` 中飯店 placemark 帶真實經緯度(有座標時),且飯店端點納入路徑 `LineString`(路徑序:起點飯店 → 各景點 → 終點飯店)。

- [ ] **Step 1: 寫失敗測試**

在 `tests/export.test.js` 找到 KML 相關 `describe`,新增:

```js
it("toKml 匯出飯店座標並納入路徑", () => {
  const state = {
    tripName: "T",
    days: [{
      id: "d1", label: "第 1 天",
      startHotelName: "起點旅館", startHotelLat: 35.0, startHotelLng: 139.0, startHotelAddress: "起點地址",
      endHotelName: "終點旅館", endHotelLat: 35.2, endHotelLng: 139.2, endHotelAddress: "",
      spots: [{ id: "s1", name: "景點A", lat: 35.1, lng: 139.1, resolvedAddress: "A址" }],
    }],
    routes: {},
  };
  const kml = buildKml(state);
  expect(kml).toContain("139,35");       // 起點飯店 Point
  expect(kml).toContain("139.2,35.2");   // 終點飯店 Point
  // 路徑含三點（起點飯店、景點、終點飯店）
  expect(kml).toContain("139,35 139.1,35.1 139.2,35.2");
});
```

(若測試檔以 `buildKml` 之外的名稱 import,對齊現有 import;`buildKml` 為對外匯出名。)

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run tests/export.test.js`
Expected: FAIL(飯店 Point 未輸出、路徑未含飯店點)

- [ ] **Step 3: 改 `toKml`(js/services/export.js:164-177)**

將起點/景點/終點三段改為(收集座標到 `line`,飯店帶座標):

```js
    const line = []; // 依序收集有座標節點供 LineString

    // 出發飯店
    if (day.startHotelName && day.startHotelName.trim()) {
      const has = day.startHotelLat != null && day.startHotelLng != null;
      parts.push(placemark(x(day.startHotelName), styleUrl, has ? day.startHotelLng : null, has ? day.startHotelLat : null, x, day.startHotelAddress));
      if (has) line.push(`${day.startHotelLng},${day.startHotelLat}`);
    }
    day.spots.forEach((spot) => {
      if (!spot.name || !spot.name.trim()) return;
      const hasCoord = spot.lat != null && spot.lng != null;
      parts.push(placemark(x(spot.name), styleUrl, hasCoord ? spot.lng : null, hasCoord ? spot.lat : null, x, spot.resolvedAddress));
      if (hasCoord) line.push(`${spot.lng},${spot.lat}`);
    });
    // 返回飯店
    if (day.endHotelName && day.endHotelName.trim()) {
      const has = day.endHotelLat != null && day.endHotelLng != null;
      parts.push(placemark(x(day.endHotelName), styleUrl, has ? day.endHotelLng : null, has ? day.endHotelLat : null, x, day.endHotelAddress));
      if (has) line.push(`${day.endHotelLng},${day.endHotelLat}`);
    }
```

(注意:原本 `const line = []` 宣告在起點飯店段之前,保持該行只出現一次;此處以完整替換 164-177 段落含 line 宣告,確認不要重複宣告 `line`。)

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run tests/export.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/services/export.js tests/export.test.js
git commit -m "feat: KML 匯出含飯店座標與路徑"
```

---

## Task 9: 文件同步

**Files:**
- Modify: `README.md`、`js/render/index.js`(`renderHelpOverlay`)

**Interfaces:** 無程式介面;純文件。

- [ ] **Step 1: 更新 README.md**

在 README 定位/座標相關段落加入說明(若無對應段落則置於功能列表)：

> **手動定位 / 選擇地點**:景點與飯店名稱難以自動定位時,點卡片上的 🔍/📍 按鈕開啟「選擇地點」對話框,可改關鍵字重新搜尋,並從多筆候選地點中挑選正確座標;也可清除既有定位。飯店座標會用於通勤估算與 KML 匯出。座標管理面板同時列出景點與飯店,支援批次定位與逐項手動挑選。

- [ ] **Step 2: 更新 renderHelpOverlay 功能介紹**

Run: `grep -n "renderHelpOverlay\|最後更新\|help-panel__foot\|help-item" js/render/index.js | head`
在說明頁功能介紹處新增一則 `help-item`,描述「選擇地點/手動定位」功能(景點與飯店、候選挑選、清除定位、飯店座標用於通勤與 KML)。

- [ ] **Step 3: 更新底部「最後更新」欄位**

在 `js/render/index.js` 的 `<div class="help-panel__foot">` 內,將日期改為 `2026-08-06`,摘要附:「新增景點/飯店手動定位與候選地點選取;飯店可存座標並用於通勤估算與 KML 匯出」。

- [ ] **Step 4: 手動驗證**

Run: `npm run serve`,開說明頁,確認新功能說明與「最後更新」顯示正確。

- [ ] **Step 5: 全量測試**

Run: `npm test`
Expected: PASS(全綠)

- [ ] **Step 6: Commit**

```bash
git add README.md js/render/index.js
git commit -m "docs: 手動/候選地點選取功能說明與最後更新"
```

---

## Self-Review 結果

**Spec coverage:**
- 資料模型 + 遷移 → Task 1 ✓
- 候選 geocoding 層(OSM/Google/nav) → Task 2、3 ✓
- 選地點對話框 + 進入點(景點/飯店) → Task 4、5 ✓
- 通勤優先用飯店座標 → Task 6 ✓
- 座標管理納入飯店 + 選地點入口 → Task 7 ✓
- KML 含飯店座標 → Task 8 ✓
- 測試(純函式 + migrate + KML) → Task 1/2/3/8 ✓
- 文件(README/renderHelpOverlay/最後更新) → Task 9 ✓

**Placeholder scan:** 無 TBD/TODO;所有程式步驟含實際程式碼。

**Type consistency:**
- 候選項目形狀一致:`{lat:number, lng:number, address:string}`(Task 2/3/4)。
- `geocodeCandidates(name)` 回 `Array`,`openLocatePicker` 以陣列處理(空 → 提示重試)。
- 飯店欄位命名一致:`startHotelLat/Lng/Address`、`endHotelLat/Lng/Address`(Task 1/5/6/7/8)。
- `openLocatePicker(target)` 的 `target` 形狀在 Task 4 定義,Task 5/7 呼叫一致。
- `resolveEndpointCoords`/`resolveNodeCoords` 仍保留 `geocodePlace` 依賴,故 app.js 的 `geocodePlace` import 保留(Task 5 Step 4 已註明)。
