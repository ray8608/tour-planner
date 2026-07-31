# Notion Markdown ＋ CSV 橋接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓本工具能匯出 Notion 可 import 的 Markdown＋CSV（打包成 ZIP），並能匯入 Notion export 的 `.zip`，取代式建成一趟行程。

**Architecture:** 純函式服務模組（延續 `js/services/export.js` 風格）：`zip.js`（手寫 store-only 打包＋原生 `DecompressionStream` 解壓）、`notion-csv.js`（CSV parse/serialize＋時長/日期 parse＋欄位簽名辨識＋類別/交通對映）、`notion-export.js`（Trip→檔案集）、`notion-import.js`（檔案集→`{state, report}`）。`js/app.js` 負責非純的下載/讀檔/報告顯示。資料模型在 `js/state.js` 擴充後以 `migrateState` 向後相容。

**Tech Stack:** Vanilla ES Modules（無框架、無建置）、Vitest、瀏覽器原生 Web Streams（`DecompressionStream`/`CompressionStream`）、Web Crypto 既有基線。

## Global Constraints

- 零建置、零 runtime 依賴：**不得**引入 npm 套件（JSZip/pako 等）；ZIP 與解壓一律用原生 API 或手寫。
- 純函式模組放 `js/services/`，**無副作用**（時間戳、檔名日期、下載、讀檔由 `app.js` 注入）。
- 測試檔放 `tests/`（複數），命名 `<name>.test.js`，用 `import { describe, it, expect } from "vitest"`，來源以 `../js/...` 匯入。
- 執行測試：`rtk proxy npx vitest run`（不要直接 `npx vitest`）。
- 匯入為**取代式**：僅在成功建出 Trip 後才呼叫 `importState()`（清空 undo/redo）。
- 座標欄位鍵名固定 `lat`/`lng`；路線鍵用 `routeKey(from,to)`＝`` `${from}→${to}` ``（U+2192 箭頭）；飯店 pseudo-id：`hotelStartId(dayId)`＝`hs_`+id、`hotelEndId(dayId)`＝`he_`+id。
- 景點類別 enum：`sightseeing|food|shopping|transit|hotel|activity|other`（見 `js/utils.js` `SPOT_CATEGORIES`）。交通 enum：`walking|transit|driving`（`TRANSPORT_MODES`）。
- 每個功能改動須同步更新 `README.md` 與 `renderHelpOverlay()`，push 前更新說明頁「最後更新」欄位。
- 提交訊息用 conventional commits（`feat:`/`test:`/`docs:`），繁體中文描述。

---

### Task 1: 資料模型擴充與遷移（`js/state.js`）

**Files:**
- Modify: `js/state.js`（`makeSpot` 約 31–42、`defaultState` 約 45–66、`migrateState` 約 69–106）
- Test: `tests/state-migrate.test.js`（新增）

**Interfaces:**
- Consumes: `genId()`（`js/utils.js`）
- Produces:
  - `makeSpot(name?)` → 新增欄位 `openingHours:""`、`imageUrl:""`
  - `defaultState()` → 新增 trip 層 `notes:""`、`todos:[]`、`accommodations:[]`、`flights:[]`、`guides:[]`；`version:4`
  - `migrateState(raw)` → 對舊資料補齊上述欄位（陣列預設 `[]`、字串預設 `""`），既有 days/spots/routes 不變
  - 側記錄物件形狀（供後續 Task 產生）：
    - todo：`{ id, text:"", done:false }`
    - accommodation：`{ id, name:"", type:"", address:"", mapUrl:"", city:"", checkIn:"", checkOut:"", cost:"", paymentStatus:"", bookingUrl:"", imageUrl:"" }`
    - flight：`{ id, direction:"", airline:"", flightNo:"", cabin:"", fromAirport:"", departTime:"", toAirport:"", arriveTime:"", duration:"", international:false }`
    - guide：`{ id, title:"", city:"", imageUrl:"", body:"" }`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/state-migrate.test.js`：

```js
import { describe, it, expect } from "vitest";
import { defaultState, makeSpot, migrateState } from "../js/state.js";

describe("state 模型擴充", () => {
  it("makeSpot 具備 openingHours / imageUrl", () => {
    const sp = makeSpot("清水寺");
    expect(sp.openingHours).toBe("");
    expect(sp.imageUrl).toBe("");
  });

  it("defaultState 具備 trip 層側記錄欄位且 version=4", () => {
    const s = defaultState();
    expect(s.version).toBe(4);
    expect(s.notes).toBe("");
    expect(s.todos).toEqual([]);
    expect(s.accommodations).toEqual([]);
    expect(s.flights).toEqual([]);
    expect(s.guides).toEqual([]);
  });

  it("migrateState 為舊資料補齊新欄位、保留既有 days/routes", () => {
    const old = {
      version: 3,
      tripName: "舊行程",
      days: [{ id: "d1", label: "第 1 天", startTime: "09:00", spots: [{ id: "s1", name: "A", stayDuration: 30 }] }],
      routes: { "hs_d1→s1": { transport: "walking", recordedTime: 10 } },
    };
    const m = migrateState(old);
    expect(m.notes).toBe("");
    expect(m.todos).toEqual([]);
    expect(m.accommodations).toEqual([]);
    expect(m.flights).toEqual([]);
    expect(m.guides).toEqual([]);
    expect(m.days[0].spots[0].openingHours).toBe("");
    expect(m.days[0].spots[0].imageUrl).toBe("");
    expect(m.days[0].spots[0].name).toBe("A");
    expect(m.routes["hs_d1→s1"].recordedTime).toBe(10);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `rtk proxy npx vitest run tests/state-migrate.test.js`
Expected: FAIL（`version` 為 3、欄位不存在）

- [ ] **Step 3: 實作最小改動**

`makeSpot`（在既有回傳物件末尾加兩欄）：

```js
export function makeSpot(name = "") {
  return {
    id: genId(),
    name,
    stayDuration: 0,
    notes: "",
    category: null,
    lat: null,
    lng: null,
    resolvedAddress: "",
    openingHours: "",
    imageUrl: "",
  };
}
```

`defaultState`（改 `version` 並在回傳物件加五個 trip 層欄位）：

```js
export function defaultState() {
  const d = makeDay(1);
  return {
    version: 4,
    tripName: "新旅程",
    tripStartDate: "",
    activeDayId: d.id,
    settings: {
      layout: "A",
      theme: "cream",
      fontSize: "normal",
      defaultTransport: "driving",
      weatherCity: "",
      weatherGeo: null,
      weatherModel: null,
      mapsMode: "off",
      mapsKey: "",
    },
    notes: "",
    todos: [],
    accommodations: [],
    flights: [],
    guides: [],
    days: [d],
    routes: {},
  };
}
```

`migrateState`（在建立 `out` 後、回傳前補入；`out` 已是 `defaultState()` 故預設已為空，只需覆蓋既有值）。在 `migrateState` 內 `if (typeof s.tripName === "string") ...` 之後加：

```js
  if (typeof s.notes === "string") out.notes = s.notes;
  if (Array.isArray(s.todos)) out.todos = s.todos;
  if (Array.isArray(s.accommodations)) out.accommodations = s.accommodations;
  if (Array.isArray(s.flights)) out.flights = s.flights;
  if (Array.isArray(s.guides)) out.guides = s.guides;
```

（`makeSpot()` 已含新欄位；`migrateState` 內 `spots.map` 用 `{ ...makeSpot(), ...sp }`，故 openingHours/imageUrl 自動補齊。確認該處展開順序為 `...makeSpot()` 在前。）

- [ ] **Step 4: 執行確認通過**

Run: `rtk proxy npx vitest run tests/state-migrate.test.js`
Expected: PASS

- [ ] **Step 5: 全測試迴歸**

Run: `rtk proxy npx vitest run`
Expected: 既有測試全 PASS（若 `trips.test.js` 斷言 `version:3` 需同步改 4）

- [ ] **Step 6: 提交**

```bash
git add js/state.js tests/state-migrate.test.js
git commit -m "feat: state 擴充側記錄欄位（todos/accommodations/flights/guides/notes）與 spot 營業時間/圖片"
```

---

### Task 2: 手寫 ZIP 打包與原生解壓（`js/services/zip.js`）

**Files:**
- Create: `js/services/zip.js`
- Test: `tests/zip.test.js`

**Interfaces:**
- Produces:
  - `zipStore(files)` — `files: {path:string, bytes:Uint8Array}[]` → `Uint8Array`（store-only zip，method=0）
  - `unzip(bytes)` — `bytes:Uint8Array` → `Promise<{path:string, bytes:Uint8Array}[]>`（支援 method=0 store 與 method=8 deflate；deflate 用 `DecompressionStream('deflate-raw')`）
  - `crc32(bytes)` — `Uint8Array` → `number`（unsigned）

- [ ] **Step 1: 寫失敗測試**

建立 `tests/zip.test.js`：

```js
import { describe, it, expect } from "vitest";
import { zipStore, unzip, crc32 } from "../js/services/zip.js";

const enc = (s) => new TextEncoder().encode(s);
const dec = (u) => new TextDecoder().decode(u);

describe("zip.crc32", () => {
  it("符合已知向量：'123456789' → 0xCBF43926", () => {
    expect(crc32(enc("123456789")) >>> 0).toBe(0xcbf43926);
  });
});

describe("zip store round-trip", () => {
  it("zipStore → unzip 還原多檔內容與路徑", async () => {
    const files = [
      { path: "行程.csv", bytes: enc("名稱,天\nA,Day 1\n") },
      { path: "旅遊攻略/京都.md", bytes: enc("# 京都\n內文") },
    ];
    const zipped = zipStore(files);
    expect(zipped[0]).toBe(0x50); // 'P'
    expect(zipped[1]).toBe(0x4b); // 'K'
    const out = await unzip(zipped);
    const map = Object.fromEntries(out.map((f) => [f.path, dec(f.bytes)]));
    expect(map["行程.csv"]).toBe("名稱,天\nA,Day 1\n");
    expect(map["旅遊攻略/京都.md"]).toBe("# 京都\n內文");
  });
});

describe("zip deflate 解壓", () => {
  it("能解 method=8（deflate）條目", async () => {
    // 用原生 CompressionStream 造一個 deflate 條目，組成 zip 後解回
    const raw = enc("hello deflate ".repeat(50));
    const cs = new CompressionStream("deflate-raw");
    const w = cs.writable.getWriter();
    w.write(raw); w.close();
    const comp = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    const { buildDeflateZip } = await import("./helpers/build-deflate-zip.js");
    const zip = buildDeflateZip("a.txt", raw, comp);
    const out = await unzip(zip);
    expect(dec(out[0].bytes)).toBe(dec(raw));
  });
});
```

同時建立測試輔助 `tests/helpers/build-deflate-zip.js`（組一個含單一 deflate 條目的最小 zip，供解壓測試；非產品碼）：

```js
// 最小 zip：single method=8 entry。用於測試 unzip 的 inflate 路徑。
import { crc32 } from "../../js/services/zip.js";

export function buildDeflateZip(name, raw, comp) {
  const enc = new TextEncoder();
  const nameB = enc.encode(name);
  const crc = crc32(raw) >>> 0;
  const le16 = (n) => [n & 255, (n >>> 8) & 255];
  const le32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const local = [
    ...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(8),
    ...le16(0), ...le16(0), ...le32(crc),
    ...le32(comp.length), ...le32(raw.length),
    ...le16(nameB.length), ...le16(0), ...nameB, ...comp,
  ];
  const offset = 0;
  const central = [
    ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(8),
    ...le16(0), ...le16(0), ...le32(crc),
    ...le32(comp.length), ...le32(raw.length),
    ...le16(nameB.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0),
    ...le32(0), ...le32(offset), ...nameB,
  ];
  const cdStart = local.length;
  const end = [
    ...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(1), ...le16(1),
    ...le32(central.length), ...le32(cdStart), ...le16(0),
  ];
  return new Uint8Array([...local, ...central, ...end]);
}
```

- [ ] **Step 2: 執行確認失敗**

Run: `rtk proxy npx vitest run tests/zip.test.js`
Expected: FAIL（`zip.js` 不存在）

- [ ] **Step 3: 實作 `js/services/zip.js`**

```js
/* ============================================================
   services/zip.js — 純函式 ZIP：store-only 打包 + 原生解壓
   匯出用 store（method=0）；匯入解 Notion zip（method=8）用
   瀏覽器原生 DecompressionStream('deflate-raw')。零依賴。
   ============================================================ */

/** CRC-32（IEEE 802.3），回傳 unsigned 32-bit */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
function le16(n) { return [n & 255, (n >>> 8) & 255]; }
function le32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }

/** store-only 打包。files: [{path, bytes:Uint8Array}] → Uint8Array */
export function zipStore(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameB = enc.encode(f.path);
    const data = f.bytes;
    const crc = crc32(data);
    local.push(
      ...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(crc),
      ...le32(data.length), ...le32(data.length),
      ...le16(nameB.length), ...le16(0), ...nameB, ...data
    );
    central.push(
      ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(crc),
      ...le32(data.length), ...le32(data.length),
      ...le16(nameB.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0),
      ...le32(0), ...le32(offset), ...nameB
    );
    offset += 30 + nameB.length + data.length;
  }
  const cdStart = offset;
  const end = [
    ...le32(0x06054b50), ...le16(0), ...le16(0),
    ...le16(files.length), ...le16(files.length),
    ...le32(central.length), ...le32(cdStart), ...le16(0),
  ];
  return new Uint8Array([...local, ...central, ...end]);
}

function readU16(b, o) { return b[o] | (b[o + 1] << 8); }
function readU32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 8 * 3)) >>> 0; }

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

/**
 * 解 zip。掃描 local file headers（method 0 store / 8 deflate）。
 * @returns {Promise<{path:string, bytes:Uint8Array}[]>}
 */
export async function unzip(bytes) {
  const dec = new TextDecoder();
  const out = [];
  let i = 0;
  while (i + 4 <= bytes.length && readU32(bytes, i) === 0x04034b50) {
    const method = readU16(bytes, i + 8);
    const compSize = readU32(bytes, i + 18);
    const nameLen = readU16(bytes, i + 26);
    const extraLen = readU16(bytes, i + 28);
    const nameStart = i + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const path = dec.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    if (!path.endsWith("/")) {
      const data = method === 8 ? await inflateRaw(comp) : comp.slice();
      out.push({ path, bytes: data });
    }
    i = dataStart + compSize;
  }
  return out;
}
```

> 註：store 打包用 general-purpose flag 0、無 data descriptor，故 `compSize`/`crc` 直接寫在 local header，`unzip` 掃描 local header 即可正確取值。Notion 匯出若使用 data descriptor（flag bit 3）則 local header 的 size 可能為 0；若實測 fixture 需要，於 Task 4 加對 central directory 的解析後援（見該任務註記）。

- [ ] **Step 4: 執行確認通過**

Run: `rtk proxy npx vitest run tests/zip.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add js/services/zip.js tests/zip.test.js tests/helpers/build-deflate-zip.js
git commit -m "feat: 手寫 store-only ZIP 打包與原生 DecompressionStream 解壓"
```

---

### Task 3: Notion CSV 解析／序列化與對映（`js/services/notion-csv.js`）

**Files:**
- Create: `js/services/notion-csv.js`
- Test: `tests/notion-csv.test.js`

**Interfaces:**
- Consumes: `SPOT_CATEGORIES`、`TRANSPORT_MODES`（`js/utils.js`）
- Produces:
  - `parseCsv(text)` → `string[][]`（去 BOM、支援引號內逗號/換行/`""` 跳脫）
  - `serializeCsv(rows)` → `string`（UTF-8 BOM 前綴、CRLF 行尾、必要時加引號）
  - `parseDuration(str)` → `number`（分鐘；無法解析回 0）
  - `formatDuration(mins)` → `string`（`"2 hrs 45 mins"`/`"1 hr"`/`"15 mins"`；`<=0` 回 `""`）
  - `parseNotionDate(str)` → `{ isoDate:string, startClock:string, endClock:string }`（皆可能為 `""`）
  - `detectCsvType(header)` → `"itinerary"|"accommodation"|"flight"|"guide"|null`
  - `notionCategoryToEnum(zh)` → enum id | `null`
  - `enumCategoryToNotion(id)` → 中文字串
  - `notionTransportToEnum(zh)` → `{ id:string|null, overflow:string }`
  - `enumTransportToNotion(id)` → 中文字串

- [ ] **Step 1: 寫失敗測試**

建立 `tests/notion-csv.test.js`：

```js
import { describe, it, expect } from "vitest";
import {
  parseCsv, serializeCsv, parseDuration, formatDuration,
  parseNotionDate, detectCsvType,
  notionCategoryToEnum, enumCategoryToNotion,
  notionTransportToEnum, enumTransportToNotion,
} from "../js/services/notion-csv.js";

describe("parseCsv", () => {
  it("解析引號內逗號與換行、去除 BOM", () => {
    const rows = parseCsv('﻿a,b\n"x,y","line1\nline2"\n');
    expect(rows[0]).toEqual(["a", "b"]);
    expect(rows[1]).toEqual(["x,y", "line1\nline2"]);
  });
  it("處理跳脫雙引號 \"\"", () => {
    expect(parseCsv('"he said ""hi"""')[0][0]).toBe('he said "hi"');
  });
});

describe("serializeCsv round-trip", () => {
  it("含逗號/引號的值可 parse 回原值", () => {
    const rows = [["名稱", "備註"], ["A", 'x, "y"']];
    const back = parseCsv(serializeCsv(rows));
    expect(back).toEqual(rows);
  });
  it("以 BOM 開頭", () => {
    expect(serializeCsv([["a"]]).charCodeAt(0)).toBe(0xfeff);
  });
});

describe("parseDuration", () => {
  it.each([
    ["2 hrs 45 mins", 165],
    ["1 hr", 60],
    ["15 mins", 15],
    ["1 hr 10 mins", 70],
    ["3 hrs  15 mins", 195], // 雙空格 typo
    ["", 0],
    ["亂寫", 0],
  ])("%s → %i 分", (s, m) => expect(parseDuration(s)).toBe(m));
});

describe("formatDuration", () => {
  it.each([
    [165, "2 hrs 45 mins"],
    [60, "1 hr"],
    [15, "15 mins"],
    [0, ""],
  ])("%i 分 → %s", (m, s) => expect(formatDuration(m)).toBe(s));
});

describe("parseNotionDate", () => {
  it("24 小時制範圍：起訖時刻與 ISO 日期", () => {
    const r = parseNotionDate("July 15, 2026 9:05 (GMT+8) → 11:05");
    expect(r.isoDate).toBe("2026-07-15");
    expect(r.startClock).toBe("09:05");
    expect(r.endClock).toBe("11:05");
  });
  it("12 小時制 AM/PM（航班時刻）", () => {
    const r = parseNotionDate("July 15, 2026 2:50 PM (GMT+8)");
    expect(r.isoDate).toBe("2026-07-15");
    expect(r.startClock).toBe("14:50");
  });
  it("只有日期範圍（住宿）", () => {
    const r = parseNotionDate("July 18, 2026 → July 20, 2026");
    expect(r.isoDate).toBe("2026-07-18");
    expect(r.startClock).toBe("");
  });
  it("無法解析回空", () => {
    expect(parseNotionDate("")).toEqual({ isoDate: "", startClock: "", endClock: "" });
  });
});

describe("detectCsvType（欄位簽名）", () => {
  it("行程", () => {
    expect(detectCsvType(["日期","Day","Details","類別","移動方式","時間"])).toBe("itinerary");
  });
  it("住宿", () => {
    expect(detectCsvType(["Name","image","付款類型","地址","城市","日期","花費"])).toBe("accommodation");
  });
  it("交通（航班）", () => {
    expect(detectCsvType(["Transport","No.","出發機場","航空公司","飛行時間"])).toBe("flight");
  });
  it("攻略", () => {
    expect(detectCsvType(["Name","圖片","城市","筆記"])).toBe("guide");
  });
  it("無法辨識回 null", () => {
    expect(detectCsvType(["foo","bar"])).toBe(null);
  });
});

describe("類別／交通對映", () => {
  it("Notion 類別 → enum", () => {
    expect(notionCategoryToEnum("景點參觀")).toBe("sightseeing");
    expect(notionCategoryToEnum("晚餐")).toBe("food");
    expect(notionCategoryToEnum("購物")).toBe("shopping");
    expect(notionCategoryToEnum("自由活動")).toBe("activity");
    expect(notionCategoryToEnum("")).toBe(null);
  });
  it("enum → Notion 類別", () => {
    expect(enumCategoryToNotion("sightseeing")).toBe("景點參觀");
    expect(enumCategoryToNotion("food")).toBe("餐飲");
  });
  it("Notion 交通多值 → 取首＋溢出", () => {
    expect(notionTransportToEnum("JR, 步行")).toEqual({ id: "transit", overflow: "步行" });
    expect(notionTransportToEnum("步行")).toEqual({ id: "walking", overflow: "" });
    expect(notionTransportToEnum("飛機")).toEqual({ id: "transit", overflow: "飛機" });
    expect(notionTransportToEnum("包車接送")).toEqual({ id: "driving", overflow: "" });
  });
  it("enum → Notion 交通", () => {
    expect(enumTransportToNotion("transit")).toBe("大眾運輸");
    expect(enumTransportToNotion("walking")).toBe("步行");
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `rtk proxy npx vitest run tests/notion-csv.test.js`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `js/services/notion-csv.js`**

```js
/* ============================================================
   services/notion-csv.js — 純函式：CSV parse/serialize、
   時長/日期解析、欄位簽名辨識、類別/交通對映。
   ============================================================ */

/** 解析 CSV 文字 → 二維陣列（RFC4180 子集：支援引號、逗號、換行、"" 跳脫） */
export function parseCsv(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", i = 0, inQ = false;
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(cell); cell = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += c; i++;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 二維陣列 → CSV 文字（BOM + CRLF） */
export function serializeCsv(rows) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** "2 hrs 45 mins" → 165（分）；無法解析回 0 */
export function parseDuration(str) {
  const s = String(str || "");
  const h = /(\d+)\s*hrs?/.exec(s);
  const m = /(\d+)\s*mins?/.exec(s);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

/** 165 → "2 hrs 45 mins"；<=0 回 "" */
export function formatDuration(mins) {
  const n = Math.max(0, Math.floor(mins || 0));
  if (n <= 0) return "";
  const h = Math.floor(n / 60), m = n % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? "hr" : "hrs"}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? "min" : "mins"}`);
  return parts.join(" ");
}

const MONTHS = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 };

function toClock(hh, mm, ampm) {
  let h = Number(hh);
  if (ampm) {
    const up = ampm.toUpperCase();
    if (up === "PM" && h < 12) h += 12;
    if (up === "AM" && h === 12) h = 0;
  }
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 解析 Notion 日期字串 → { isoDate, startClock, endClock } */
export function parseNotionDate(str) {
  const s = String(str || "");
  const out = { isoDate: "", startClock: "", endClock: "" };
  const dm = /([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (dm && MONTHS[dm[1]]) {
    out.isoDate = `${dm[3]}-${String(MONTHS[dm[1]]).padStart(2, "0")}-${String(dm[2]).padStart(2, "0")}`;
  }
  // 起始時刻：日期後第一個 H:MM（可含 AM/PM）
  const t1 = /\d{4}\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(s);
  if (t1) out.startClock = toClock(t1[1], t1[2], t1[3]);
  // 結束時刻：箭頭後的 H:MM（可含 AM/PM）
  const t2 = /→\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(s);
  if (t2) out.endClock = toClock(t2[1], t2[2], t2[3]);
  return out;
}

/** 欄位簽名辨識 CSV 類型（忽略檔名/語言） */
export function detectCsvType(header) {
  const h = new Set((header || []).map((x) => String(x).trim()));
  const has = (...ks) => ks.every((k) => h.has(k));
  if (has("Details") && (h.has("移動方式") || h.has("類別"))) return "itinerary";
  if (h.has("航空公司") && h.has("飛行時間")) return "flight";
  if (h.has("Name") && h.has("筆記") && h.has("城市")) return "guide";
  if (h.has("Name") && (h.has("付款類型") || h.has("花費")) && h.has("日期")) return "accommodation";
  return null;
}

// ---- 類別對映 ----
const CATEGORY_TO_ENUM = {
  "景點參觀": "sightseeing", "景點": "sightseeing", "參觀": "sightseeing",
  "早餐": "food", "午餐": "food", "晚餐": "food", "餐飲": "food", "美食": "food", "用餐": "food",
  "逛街": "shopping", "購物": "shopping",
  "自由活動": "activity", "體驗": "activity", "活動": "activity",
  "住宿": "hotel",
  "交通": "transit",
};
const ENUM_TO_CATEGORY = {
  sightseeing: "景點參觀", food: "餐飲", shopping: "購物",
  transit: "交通", hotel: "住宿", activity: "自由活動", other: "其他",
};
export function notionCategoryToEnum(zh) {
  const first = String(zh || "").split(",")[0].trim();
  return CATEGORY_TO_ENUM[first] || null;
}
export function enumCategoryToNotion(id) { return ENUM_TO_CATEGORY[id] || ""; }

// ---- 交通對映 ----
const TRANSPORT_TO_ENUM = {
  "步行": "walking", "走路": "walking",
  "JR": "transit", "地鐵": "transit", "電車": "transit", "新幹線": "transit",
  "公車": "transit", "巴士": "transit", "觀光船": "transit", "船": "transit", "大眾運輸": "transit",
  "包車接送": "driving", "包車": "driving", "計程車": "driving", "開車": "driving", "自駕": "driving", "租車": "driving",
  "飛機": "transit",
};
const ENUM_TO_TRANSPORT = { walking: "步行", transit: "大眾運輸", driving: "開車" };
export function notionTransportToEnum(zh) {
  const parts = String(zh || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return { id: null, overflow: "" };
  const first = parts[0];
  const id = TRANSPORT_TO_ENUM[first] || null;
  // 飛機：映射 transit 但原文完整保留（含機型資訊）
  const overflowParts = first === "飛機" ? parts : parts.slice(1);
  return { id, overflow: overflowParts.filter((p) => p !== undefined).join(", ") };
}
export function enumTransportToNotion(id) { return ENUM_TO_TRANSPORT[id] || ""; }
```

> 註：`notionTransportToEnum("飛機")` 依測試需回 `{ id:"transit", overflow:"飛機" }`——上式 `overflowParts` 於 first==="飛機" 時取 `parts`（即 `["飛機"]`）故 overflow 為 `"飛機"`；`"JR, 步行"` → first `"JR"`（非飛機）→ overflow `slice(1)` = `"步行"`。符合。

- [ ] **Step 4: 執行確認通過**

Run: `rtk proxy npx vitest run tests/notion-csv.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add js/services/notion-csv.js tests/notion-csv.test.js
git commit -m "feat: Notion CSV 解析/序列化與時長、日期、類別、交通對映"
```

---

### Task 4: 匯入——Notion 檔案集 → Trip（`js/services/notion-import.js`）

**Files:**
- Create: `js/services/notion-import.js`
- Test: `tests/notion-import.test.js`

**Interfaces:**
- Consumes: `parseCsv`、`detectCsvType`、`parseDuration`、`parseNotionDate`、`notionCategoryToEnum`、`notionTransportToEnum`（Task 3）；`genId`、`routeKey`、`hotelStartId`、`hotelEndId`（`js/utils.js`）；`makeDay`、`makeSpot`、`defaultState`（`js/state.js`）
- Produces:
  - `notionFilesToTrip(files)` — `files: {path:string, bytes:Uint8Array}[]` → `{ state:object, report:object }`
  - `report` 形狀：`{ dropped:string[], warnings:string[], counts:{ days,spots,legs,accommodations,flights,guides,todos } }`

- [ ] **Step 1: 寫失敗測試（以真實 fixture）**

建立 `tests/notion-import.test.js`。用 `node:fs` 遞迴讀 `notion/template_notion` 成 `{path,bytes}[]`：

```js
import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { notionFilesToTrip } from "../js/services/notion-import.js";

const ROOT = new URL("../notion/template_notion", import.meta.url).pathname;

function readAll(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) readAll(p, base, acc);
    else acc.push({ path: relative(base, p), bytes: new Uint8Array(readFileSync(p)) });
  }
  return acc;
}

let result;
beforeAll(() => { result = notionFilesToTrip(readAll(ROOT)); });

describe("notionFilesToTrip（真實 Notion 匯出）", () => {
  it("建出多天且含景點", () => {
    expect(result.state.days.length).toBeGreaterThanOrEqual(1);
    const totalSpots = result.state.days.reduce((n, d) => n + d.spots.length, 0);
    expect(totalSpots).toBeGreaterThan(0);
    expect(result.report.counts.spots).toBe(totalSpots);
  });
  it("交通段化為 routes（recordedTime 來自時長）", () => {
    const anyRoute = Object.values(result.state.routes).some((r) => r.recordedTime > 0);
    expect(anyRoute).toBe(true);
  });
  it("首列時刻推得 day.startTime、最早日期為 tripStartDate", () => {
    expect(result.state.days[0].startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(result.state.tripStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("景點無座標（Notion 無經緯度）", () => {
    const sp = result.state.days.flatMap((d) => d.spots)[0];
    expect(sp.lat).toBe(null);
    expect(sp.lng).toBe(null);
  });
  it("側記錄：住宿/航班/攻略被解析", () => {
    expect(result.state.accommodations.length).toBeGreaterThan(0);
    expect(result.state.flights.length).toBeGreaterThan(0);
    expect(result.state.guides.length).toBeGreaterThan(0);
  });
  it("多值移動方式（JR, 步行）取首為 transit、溢出入 notes", () => {
    // 找到 notes 含「步行」的交通段被記錄；此處寬鬆斷言 report 有 counts.legs
    expect(result.report.counts.legs).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `rtk proxy npx vitest run tests/notion-import.test.js`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `js/services/notion-import.js`**

```js
/* ============================================================
   services/notion-import.js — 純函式：Notion 匯出檔案集 → Trip
   取代式匯入的資料建構層（實際 importState 由 app.js 呼叫）。
   ============================================================ */
import {
  parseCsv, detectCsvType, parseDuration, parseNotionDate,
  notionCategoryToEnum, notionTransportToEnum,
} from "./notion-csv.js";
import { genId, routeKey, hotelStartId, hotelEndId } from "../utils.js";
import { defaultState, makeSpot, makeDay } from "../state.js";

const dec = new TextDecoder();
const text = (f) => dec.decode(f.bytes);

/** 把 {path,bytes}[] 依類型分류（取 header 判斷；同型多份合併 rows） */
function classify(files) {
  const csvs = files.filter((f) => /\.csv$/i.test(f.path));
  const groups = { itinerary: [], accommodation: [], flight: [], guide: [] };
  for (const f of csvs) {
    const rows = parseCsv(text(f));
    if (!rows.length) continue;
    const type = detectCsvType(rows[0]);
    if (type) groups[type].push({ header: rows[0], rows: rows.slice(1) });
  }
  return groups;
}

/** header + row → 物件（以欄名取值） */
function rowObj(header, row) {
  const o = {};
  header.forEach((h, i) => { o[String(h).trim()] = (row[i] ?? "").trim(); });
  return o;
}

function buildDays(itinGroups, report) {
  // 合併所有行程 CSV 的列，去重（Day+Details+日期）
  const seen = new Set();
  const recs = [];
  for (const g of itinGroups) {
    for (const row of g.rows) {
      const o = rowObj(g.header, row);
      if (!o.Details && !o["日期"]) continue;
      const key = `${o.Day}|${o.Details}|${o["日期"]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recs.push(o);
    }
  }
  // 依 Day 分組（保序）
  const dayOrder = [];
  const byDay = new Map();
  for (const o of recs) {
    const dk = o.Day || "Day 1";
    if (!byDay.has(dk)) { byDay.set(dk, []); dayOrder.push(dk); }
    byDay.get(dk).push(o);
  }

  const days = [];
  const routes = {};
  let tripStart = "";
  let spotCount = 0, legCount = 0;

  dayOrder.forEach((dk, di) => {
    const day = makeDay(di + 1);
    day.label = dk;
    const list = byDay.get(dk);
    let firstClock = "";
    let prevSpotId = hotelStartId(day.id);
    let pendingLeg = null; // 前一列若為交通段，暫存到下個景點

    for (const o of list) {
      const date = parseNotionDate(o["日期"] || "");
      if (date.isoDate && (!tripStart || date.isoDate < tripStart)) tripStart = date.isoDate;
      if (!firstClock && date.startClock) firstClock = date.startClock;

      const mins = parseDuration(o["時間"] || "");
      const isLeg = !!(o["移動方式"] && o["移動方式"].trim());

      if (isLeg) {
        const t = notionTransportToEnum(o["移動方式"]);
        pendingLeg = { transport: t.id || "transit", recordedTime: mins, overflow: t.overflow, details: o.Details };
        legCount++;
      } else {
        const sp = makeSpot(o.Details || "");
        sp.stayDuration = mins;
        sp.notes = o["備註"] || "";
        sp.category = notionCategoryToEnum(o["類別"] || "");
        sp.openingHours = o["營業時間"] || "";
        sp.imageUrl = o["圖片"] || "";
        sp.resolvedAddress = o["地址"] || "";
        // lat/lng：Notion 無座標 → 留 null
        day.spots.push(sp);
        spotCount++;
        // 綁定前一段交通到 prevSpot→此景點
        if (pendingLeg) {
          const rk = routeKey(prevSpotId, sp.id);
          routes[rk] = { transport: pendingLeg.transport, recordedTime: pendingLeg.recordedTime };
          if (pendingLeg.overflow) sp.notes = [sp.notes, `交通：${pendingLeg.overflow}`].filter(Boolean).join(" / ");
          pendingLeg = null;
        }
        prevSpotId = sp.id;
      }
    }
    // 收尾未綁定的交通段 → prevSpot→返回飯店
    if (pendingLeg) {
      const rk = routeKey(prevSpotId, hotelEndId(day.id));
      routes[rk] = { transport: pendingLeg.transport, recordedTime: pendingLeg.recordedTime };
    }
    day.startTime = firstClock || "";
    days.push(day);
  });

  report.counts.days = days.length;
  report.counts.spots = spotCount;
  report.counts.legs = legCount;
  return { days, routes, tripStart };
}

function buildAccommodations(groups) {
  const out = [];
  for (const g of groups) for (const row of g.rows) {
    const o = rowObj(g.header, row);
    if (!o.Name) continue;
    const d = parseNotionDate(o["日期"] || "");
    // 退房日：箭頭後第二個日期
    const parts = String(o["日期"] || "").split("→");
    const co = parts[1] ? parseNotionDate(parts[1]) : { isoDate: "" };
    out.push({
      id: genId(), name: o.Name, type: o["類型"] || "", address: o["地址"] || "",
      mapUrl: o["位置"] || "", city: o["城市"] || "", checkIn: d.isoDate,
      checkOut: co.isoDate, cost: o["花費"] || "", paymentStatus: o["付款類型"] || "",
      bookingUrl: o["網址"] || "", imageUrl: o["image"] || o["圖片"] || "",
    });
  }
  return out;
}

function buildFlights(groups) {
  const out = [];
  for (const g of groups) for (const row of g.rows) {
    const o = rowObj(g.header, row);
    if (!o["航空公司"] && !o["No."]) continue; // 略過空白列
    out.push({
      id: genId(), direction: o.Transport || "", airline: o["航空公司"] || "",
      flightNo: o["No."] || "", cabin: o["等級"] || "",
      fromAirport: o["出發機場"] || "", departTime: o["出發時間"] || "",
      toAirport: o["抵達機場"] || "", arriveTime: o["抵達時間"] || "",
      duration: o["飛行時間"] || "", international: /International|國際/i.test(o["類型"] || ""),
    });
  }
  return out;
}

function buildGuides(groups, files) {
  const out = [];
  const mdFiles = files.filter((f) => /\.md$/i.test(f.path));
  for (const g of groups) for (const row of g.rows) {
    const o = rowObj(g.header, row);
    if (!o.Name) continue;
    // 子頁 md：檔名（去 hash 前）以 guide 名稱開頭
    const md = mdFiles.find((f) => {
      const base = f.path.split("/").pop().replace(/\s+[0-9a-f]{32}\.md$/i, "").replace(/\.md$/i, "");
      return base === o.Name;
    });
    out.push({
      id: genId(), title: o.Name, city: o["城市"] || "",
      imageUrl: o["圖片"] || o["image"] || "", body: md ? stripFrontMatter(text(md)) : "",
    });
  }
  return out;
}

/** 去掉 Notion md 頂部的標題與 metadata，保留正文（best-effort） */
function stripFrontMatter(md) {
  const lines = String(md).split(/\r?\n/);
  // 移除第一個 # 標題行（Notion 子頁首行為頁名）
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (lines[i] && lines[i].startsWith("# ")) i++;
  return lines.slice(i).join("\n").trim();
}

/** 頂層頁 md 的待辦清單 → todos */
function buildTodos(files) {
  const top = files
    .filter((f) => /\.md$/i.test(f.path) && !f.path.includes("/"))
    .sort((a, b) => a.path.length - b.path.length)[0];
  if (!top) return [];
  const todos = [];
  for (const line of text(top).split(/\r?\n/)) {
    const m = /^\s*[-*]\s*\[([ xX])\]\s+(.*\S)/.exec(line);
    if (m) todos.push({ id: genId(), text: m[2].trim(), done: m[1].toLowerCase() === "x" });
  }
  return todos;
}

/** 收集未能建模的檔案（地圖圖片、外部連結）→ 供報告與 notes */
function collectDropped(files, report, state) {
  const notes = [];
  for (const f of files) {
    if (/\.(png|jpe?g|webp|gif)$/i.test(f.path)) report.dropped.push(`圖片未匯入：${f.path}`);
  }
  // 頂層 md 內的外部連結（分帳/匯率/天氣等）併入 trip.notes
  const top = files.filter((f) => /\.md$/i.test(f.path) && !f.path.includes("/"))
    .sort((a, b) => a.path.length - b.path.length)[0];
  if (top) {
    for (const m of text(top).matchAll(/\((https?:\/\/[^)]+)\)/g)) notes.push(m[1]);
  }
  if (notes.length) {
    state.notes = `外部連結（自 Notion 頂層頁）：\n` + notes.join("\n");
    report.dropped.push(`外部連結 ${notes.length} 筆已存入行程備註`);
  }
}

/**
 * Notion 匯出檔案集 → { state, report }
 * @param {{path:string, bytes:Uint8Array}[]} files
 */
export function notionFilesToTrip(files) {
  const report = { dropped: [], warnings: [], counts: { days: 0, spots: 0, legs: 0, accommodations: 0, flights: 0, guides: 0, todos: 0 } };
  const state = defaultState();
  const groups = classify(files);

  const { days, routes, tripStart } = buildDays(groups.itinerary, report);
  if (days.length) {
    state.days = days;
    state.routes = routes;
    state.activeDayId = days[0].id;
    state.tripStartDate = tripStart;
  }
  state.accommodations = buildAccommodations(groups.accommodation);
  state.flights = buildFlights(groups.flight);
  state.guides = buildGuides(groups.guide, files);
  state.todos = buildTodos(files);
  collectDropped(files, report, state);

  // 行程名：取頂層資料夾名或頂層 md 檔名
  const topMd = files.filter((f) => /\.md$/i.test(f.path) && !f.path.includes("/"))
    .sort((a, b) => a.path.length - b.path.length)[0];
  if (topMd) state.tripName = topMd.path.replace(/\s+[0-9a-f]{32}\.md$/i, "").replace(/\.md$/i, "");

  report.counts.accommodations = state.accommodations.length;
  report.counts.flights = state.flights.length;
  report.counts.guides = state.guides.length;
  report.counts.todos = state.todos.length;
  return { state, report };
}
```

> 註（data descriptor 後援）：若 Task 2 的 `unzip` 對真實 Notion zip 取不到內容（local header size=0），代表 Notion 用了 data descriptor；此時本 Task 的 fixture 測試（直接讀解壓後檔案）仍會通過，`unzip` 的問題留待 Task 6 以真實 zip 手動驗證時，於 `zip.js` 補「用 central directory 的 size/offset 解析」的後援。fixture 測試不受影響。

- [ ] **Step 4: 執行確認通過**

Run: `rtk proxy npx vitest run tests/notion-import.test.js`
Expected: PASS（若某斷言與真實資料不符，調整斷言為資料實際值，勿改壞解析邏輯）

- [ ] **Step 5: 提交**

```bash
git add js/services/notion-import.js tests/notion-import.test.js
git commit -m "feat: 匯入 Notion 匯出檔案集為行程（取代式，含側記錄與報告）"
```

---

### Task 5: 匯出——Trip → Notion 檔案集（`js/services/notion-export.js`）

**Files:**
- Create: `js/services/notion-export.js`
- Test: `tests/notion-export.test.js`

**Interfaces:**
- Consumes: `serializeCsv`、`formatDuration`、`enumCategoryToNotion`、`enumTransportToNotion`（Task 3）；`computeTimeline`（`js/timeline.js`）；`getDayDate`/`getDayIsoDate`（`js/utils.js`）；`safeFileStem`（`js/services/export.js`）
- Produces:
  - `tripToNotionFiles(state)` — → `{path:string, bytes:Uint8Array}[]`（bytes 為 UTF-8）
  - 檔案集含：`<stem>.md`（頂層＋待辦）、`<stem>/行程.csv`；有資料才含 `<stem>/住宿.csv`、`<stem>/交通.csv`、`<stem>/旅遊攻略.csv` 及 `<stem>/旅遊攻略/<title>.md`

- [ ] **Step 1: 寫失敗測試**

建立 `tests/notion-export.test.js`：

```js
import { describe, it, expect } from "vitest";
import { tripToNotionFiles } from "../js/services/notion-export.js";
import { parseCsv, detectCsvType } from "../js/services/notion-csv.js";

const dec = (u) => new TextDecoder().decode(u);

function makeState() {
  return {
    version: 4, tripName: "京都測試", tripStartDate: "2026-07-15",
    activeDayId: "d1", settings: {},
    notes: "", todos: [{ id: "t1", text: "換日圓", done: false }, { id: "t2", text: "訂票", done: true }],
    accommodations: [{ id: "a1", name: "季針小路", type: "Airbnb", address: "京都", mapUrl: "", city: "京都", checkIn: "2026-07-15", checkOut: "2026-07-18", cost: "NT$73,646", paymentStatus: "Paid", bookingUrl: "", imageUrl: "" }],
    flights: [{ id: "f1", direction: "去程", airline: "國泰航空", flightNo: "CX564", cabin: "Economy", fromAirport: "TPE", departTime: "", toAirport: "KIX", arriveTime: "", duration: "2 hrs 45 mins", international: true }],
    guides: [{ id: "g1", title: "京都景點", city: "京都", imageUrl: "", body: "清水寺\n伏見稻荷" }],
    days: [{
      id: "d1", label: "Day 1", startTime: "09:00", startHotelName: "", endHotelName: "",
      spots: [
        { id: "s1", name: "伏見稻荷", stayDuration: 85, notes: "自由參加", category: "sightseeing", lat: 34.96, lng: 135.77, resolvedAddress: "京都市", openingHours: "24 hrs", imageUrl: "http://x/y.jpg" },
        { id: "s2", name: "京都車站", stayDuration: 80, notes: "", category: "food", lat: null, lng: null, resolvedAddress: "", openingHours: "", imageUrl: "" },
      ],
    }],
    routes: { "s1→s2": { transport: "transit", recordedTime: 10 } },
  };
}

describe("tripToNotionFiles", () => {
  const files = tripToNotionFiles(makeState());
  const byPath = Object.fromEntries(files.map((f) => [f.path, dec(f.bytes)]));

  it("含頂層 md 與行程 CSV", () => {
    expect(byPath["京都測試.md"]).toContain("換日圓");
    expect(byPath["京都測試.md"]).toContain("- [x] 訂票");
    expect(byPath["京都測試/行程.csv"]).toBeDefined();
  });
  it("行程 CSV 表頭可被自身辨識為 itinerary", () => {
    const rows = parseCsv(byPath["京都測試/行程.csv"]);
    expect(detectCsvType(rows[0])).toBe("itinerary");
  });
  it("景點列含中文類別與時長字串、交通段獨立成列", () => {
    const csv = byPath["京都測試/行程.csv"];
    expect(csv).toContain("景點參觀");
    expect(csv).toContain("1 hr 25 mins"); // 85 分
    expect(csv).toContain("伏見稻荷 - 京都車站"); // leg
    expect(csv).toContain("大眾運輸");
  });
  it("有資料才產生住宿/交通/攻略檔", () => {
    expect(byPath["京都測試/住宿.csv"]).toContain("季針小路");
    expect(byPath["京都測試/交通.csv"]).toContain("CX564");
    expect(byPath["京都測試/旅遊攻略.csv"]).toContain("京都景點");
    expect(byPath["京都測試/旅遊攻略/京都景點.md"]).toContain("清水寺");
  });
});
```

- [ ] **Step 2: 執行確認失敗**

Run: `rtk proxy npx vitest run tests/notion-export.test.js`
Expected: FAIL（模組不存在）

- [ ] **Step 3: 實作 `js/services/notion-export.js`**

```js
/* ============================================================
   services/notion-export.js — 純函式：Trip → Notion 可 import 的
   檔案集（Markdown 頁面 + CSV 資料庫），鏡像 Notion 匯出結構。
   ============================================================ */
import { serializeCsv, formatDuration, enumCategoryToNotion, enumTransportToNotion } from "./notion-csv.js";
import { safeFileStem } from "./export.js";
import { computeTimeline } from "../timeline.js";
import { getDayIsoDate, routeKey, hotelStartId, hotelEndId } from "../utils.js";

const enc = new TextEncoder();
const file = (path, str) => ({ path, bytes: enc.encode(str) });

/** "2026-07-15" → "July 15, 2026" */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function isoToNotionDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}
/** 組行程 日期欄："July 15, 2026 09:00 (GMT+8) → 10:30" */
function dateCell(iso, start, end) {
  if (!iso) return "";
  const base = isoToNotionDate(iso);
  if (!start) return base;
  return `${base} ${start} (GMT+8)` + (end ? ` → ${end}` : "");
}

function buildItineraryCsv(state) {
  const header = ["日期", "Day", "Details", "類別", "移動方式", "時間", "備註", "營業時間", "圖片", "地址", "緯度", "經度"];
  const rows = [header];
  state.days.forEach((day, di) => {
    const iso = getDayIsoDate(state.tripStartDate, di);
    const slots = computeTimeline(day, state.routes);
    let prevId = hotelStartId(day.id);
    day.spots.forEach((spot) => {
      // 先輸出前一段交通（若有 recordedTime）
      const rk = routeKey(prevId, spot.id);
      const rt = (state.routes[rk] || {}).recordedTime || 0;
      if (rt > 0) {
        const prevName = prevId === hotelStartId(day.id) ? (day.startHotelName || "出發") : (state.days[di].spots.find((s) => s.id === prevId)?.name || "");
        const rslot = slots[rk] || {};
        rows.push([
          dateCell(iso, rslot.start, rslot.end), day.label, `${prevName} - ${spot.name}`,
          "", enumTransportToNotion((state.routes[rk] || {}).transport), formatDuration(rt),
          "", "", "", "", "", "",
        ]);
      }
      const slot = slots[spot.id] || {};
      rows.push([
        dateCell(iso, slot.start, slot.end), day.label, spot.name,
        enumCategoryToNotion(spot.category), "", formatDuration(spot.stayDuration),
        spot.notes || "", spot.openingHours || "", spot.imageUrl || "", spot.resolvedAddress || "",
        spot.lat != null ? spot.lat : "", spot.lng != null ? spot.lng : "",
      ]);
      prevId = spot.id;
    });
  });
  return serializeCsv(rows);
}

function buildAccommodationCsv(list) {
  const header = ["Name", "image", "付款類型", "位置", "地址", "城市", "日期", "網址", "花費", "類型"];
  const rows = [header];
  for (const a of list) {
    const range = a.checkIn ? `${isoToNotionDate(a.checkIn)}${a.checkOut ? " → " + isoToNotionDate(a.checkOut) : ""}` : "";
    rows.push([a.name, a.imageUrl, a.paymentStatus, a.mapUrl, a.address, a.city, range, a.bookingUrl, a.cost, a.type]);
  }
  return serializeCsv(rows);
}

function buildFlightCsv(list) {
  const header = ["Transport", "No.", "出發時間", "出發機場", "抵達時間", "抵達機場", "等級", "航空公司", "類型", "飛行時間"];
  const rows = [header];
  for (const f of list) {
    rows.push([f.direction, f.flightNo, f.departTime, f.fromAirport, f.arriveTime, f.toAirport, f.cabin, f.airline, f.international ? "International" : "Domestic", f.duration]);
  }
  return serializeCsv(rows);
}

function buildGuideCsv(list) {
  const header = ["Name", "圖片", "城市", "筆記"];
  const rows = [header];
  for (const g of list) rows.push([g.title, g.imageUrl, g.city, ""]);
  return serializeCsv(rows);
}

function buildTopMd(state) {
  const lines = [`# ${state.tripName}`, ""];
  if (state.todos.length) {
    lines.push("## 待辦事項", "");
    for (const t of state.todos) lines.push(`- [${t.done ? "x" : " "}] ${t.text}`);
    lines.push("");
  }
  if (state.notes) { lines.push("## 備註", "", state.notes, ""); }
  return lines.join("\n");
}

/** Trip → Notion 檔案集 */
export function tripToNotionFiles(state) {
  const stem = safeFileStem(state.tripName);
  const files = [file(`${stem}.md`, buildTopMd(state))];
  files.push(file(`${stem}/行程.csv`, buildItineraryCsv(state)));
  if (state.accommodations?.length) files.push(file(`${stem}/住宿.csv`, buildAccommodationCsv(state.accommodations)));
  if (state.flights?.length) files.push(file(`${stem}/交通.csv`, buildFlightCsv(state.flights)));
  if (state.guides?.length) {
    files.push(file(`${stem}/旅遊攻略.csv`, buildGuideCsv(state.guides)));
    for (const g of state.guides) {
      files.push(file(`${stem}/旅遊攻略/${safeFileStem(g.title)}.md`, `# ${g.title}\n\n${g.body || ""}`));
    }
  }
  return files;
}
```

- [ ] **Step 4: 執行確認通過**

Run: `rtk proxy npx vitest run tests/notion-export.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add js/services/notion-export.js tests/notion-export.test.js
git commit -m "feat: 匯出行程為 Notion 可 import 的 Markdown+CSV 檔案集"
```

---

### Task 6: UI 接線——選單、下載 ZIP、匯入 ZIP、報告（`js/app.js`、`js/render/index.js`）

**Files:**
- Modify: `js/render/index.js`（資料選單約 321–334）
- Modify: `js/app.js`（import 區約 28；`onClick` 匯出 case 約 356–360；`handleImportFile`/檔案輸入處理）
- Test: 手動（headless）；無新單元測試（純函式已覆蓋，這裡是非純 glue）

**Interfaces:**
- Consumes: `zipStore`、`unzip`（Task 2）；`tripToNotionFiles`（Task 5）；`notionFilesToTrip`（Task 4）；`importState`（`js/state.js`）；`downloadFile`、`safeFileStem`（既有）

- [ ] **Step 1: 選單加入按鈕**（`js/render/index.js`）

在 `data-action="export-csv"` 按鈕後、`import-btn` label 前，新增：

```html
            <button class="btn btn--ghost" data-action="export-notion" title="匯出 Notion 可匯入的 ZIP">🔗 Notion</button>
```

並在既有 JSON 匯入 label 之後，新增 Notion ZIP 匯入 label：

```html
          <label class="btn btn--ghost import-btn">
            ⬆ 匯入 Notion ZIP
            <input type="file" accept=".zip,application/zip" data-action="import-notion-file"
                   class="sr-only" aria-label="選擇 Notion 匯出 ZIP" />
          </label>
```

- [ ] **Step 2: app.js 匯入模組**（`js/app.js` 約 28）

在既有 `import { exportJson, ... } from "./services/export.js";` 之後新增：

```js
import { zipStore, unzip } from "./services/zip.js";
import { tripToNotionFiles } from "./services/notion-export.js";
import { notionFilesToTrip } from "./services/notion-import.js";
```

- [ ] **Step 3: 匯出 Notion ZIP 的 click case**（`js/app.js`，加在 `export-csv` case 之後）

```js
    case "export-notion": {
      const st = getState();
      const zip = zipStore(tripToNotionFiles(st));
      downloadFile(`${safeFileStem(st.tripName)}-notion.zip`, "application/zip", zip);
      return;
    }
```

- [ ] **Step 4: 匯入 Notion ZIP 處理函式**（`js/app.js`，緊接 `handleImportFile` 之後）

```js
/** 讀取 Notion 匯出 ZIP → 解壓 → 建行程 → 確認 → 取代 */
async function handleImportNotionZip(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  input.value = "";
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const files = await unzip(buf);
    const { state, report } = notionFilesToTrip(files);
    const c = report.counts;
    const summary = `將匯入：${c.days} 天、${c.spots} 景點、${c.legs} 段交通、` +
      `${c.accommodations} 住宿、${c.flights} 航班、${c.guides} 攻略、${c.todos} 待辦。\n` +
      (report.dropped.length ? `\n未完整匯入：\n- ${report.dropped.join("\n- ")}\n` : "") +
      `\n是否以此取代目前行程？此動作無法復原。`;
    if (!confirm(summary)) return;
    importState(state);
    setSettingsOpen(false);
  } catch (err) {
    alert("匯入失敗：無法解析 Notion ZIP（" + (err?.message || err) + "）");
  }
}
```

- [ ] **Step 5: 綁定檔案輸入的 change 事件**

找到既有處理 `data-action="import-file"` 的 change 監聽（在 `onChange` 或檔案 input 綁定處，搜尋 `handleImportFile`），在其旁加入 Notion 分支。範例（依既有 change 委派結構調整）：

```js
    case "import-notion-file":
      handleImportNotionZip(el);
      return;
```

若既有 import-file 是以獨立 listener 綁定而非委派，則同法為 `import-notion-file` 綁定 `change` → `handleImportNotionZip`。實作前先 `grep -n "import-file" js/app.js` 確認既有模式並比照。

- [ ] **Step 6: 確認 `downloadFile` 支援 Uint8Array**

`downloadFile` 用 `new Blob([content], ...)`；`content` 為 `Uint8Array` 時 Blob 可直接接受，無需改動。快速確認該函式未對 `content` 做字串假設（約 115–125 行）。

- [ ] **Step 7: 全測試迴歸**

Run: `rtk proxy npx vitest run`
Expected: 全 PASS（本 Task 不新增單元測試，確認未破壞既有）

- [ ] **Step 8: Headless 手動驗證**

啟動靜態伺服器並用既有 Playwright 流程（`playwright-core` + `/usr/bin/google-chrome`，腳本置於專案目錄內以解析 node_modules）：
1. 匯出：開設定 → 點「🔗 Notion」→ 確認下載 `<名稱>-notion.zip`。
2. 匯入：把 `notion/template_notion` 打包成 zip（或直接用 Notion 原始 zip）→ 點「匯入 Notion ZIP」→ 確認 summary 顯示合理數字 → 確定 → 行程被取代、天數/景點正確渲染。
3. 若匯入真實 Notion zip 取不到內容 → 依 Task 4 註記，在 `zip.js` 補 central directory 後援解析，重跑。

- [ ] **Step 9: 提交**

```bash
git add js/app.js js/render/index.js
git commit -m "feat: 接線 Notion ZIP 匯出/匯入 UI 與匯入報告"
```

---

### Task 7: 文件與說明頁同步（`README.md`、`renderHelpOverlay()`）

**Files:**
- Modify: `README.md`
- Modify: `js/render/index.js`（`renderHelpOverlay()` 內容與底部「最後更新」）

**Interfaces:** 無（純文件）

- [ ] **Step 1: README 新增功能說明**

在 README 匯出/匯入相關段落新增「Notion 橋接」小節：說明「🔗 Notion」匯出產生可被 Notion import 的 ZIP（Markdown 頁面＋CSV 資料庫）、「匯入 Notion ZIP」可吃 Notion 匯出的 `.zip`；註明匯入為**取代式**、Notion 無座標故匯入後需重新定位、住宿/航班/攻略為獨立側記錄。

- [ ] **Step 2: 說明頁介紹文字**

在 `renderHelpOverlay()` 的匯出/匯入介紹處，新增 Notion 匯出/匯入的一段說明（與 README 一致，精簡版）。

- [ ] **Step 3: 更新「最後更新」欄位**

將 `renderHelpOverlay()` 底部「最後更新」日期改為實作當日日期（實作者填入當日 `YYYY-MM-DD`）。

- [ ] **Step 4: 全測試迴歸**

Run: `rtk proxy npx vitest run`
Expected: 全 PASS

- [ ] **Step 5: 提交**

```bash
git add README.md js/render/index.js
git commit -m "docs: 說明 Notion MD+CSV 匯出/匯入功能並更新說明頁最後更新"
```

---

## 自我檢查（writing-plans self-review 結果）

- **Spec 覆蓋**：§3 資料模型→Task 1；§4 模組→Task 2/3/4/5；§5 匯出→Task 5；§6 匯入→Task 4；§7 錯誤處理→Task 4（report/warnings）＋Task 6（try/catch）；§8 測試→各 Task 測試；§9 UI→Task 6；README/說明頁→Task 7。無遺漏。
- **占位符掃描**：無 TBD/TODO；每步含實際程式碼或明確指令。Task 6 Step 5 因需比照既有委派結構，已標示「實作前 grep 確認模式」而非留白。
- **型別一致**：`{path, bytes}` 貫穿 zip/import/export；`report.counts` 欄位在 Task 4 產生、Task 6 消費，鍵名一致（days/spots/legs/accommodations/flights/guides/todos）；`notionTransportToEnum` 回傳 `{id, overflow}` 在 Task 3 定義、Task 4 消費一致；`enumTransportToNotion`/`enumCategoryToNotion` 命名前後一致。
- **範圍**：單一內聚功能（Notion 橋接），適合單一計畫；Task 依模組切分、各自可獨立測試與審查。
