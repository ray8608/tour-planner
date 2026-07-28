# 旅遊行程規劃工具 — 完整功能規格

> **目的**：本文件完整描述「旅遊行程規劃工具」的所有功能、資料結構、互動邏輯與技術細節，供任何 AI 依此重現相同功能的網頁應用程式。

---

## 目錄

1. [專案概述](#1-專案概述)
2. [技術架構](#2-技術架構)
3. [資料結構](#3-資料結構)
4. [狀態管理](#4-狀態管理)
5. [UI 功能詳細說明](#5-ui-功能詳細說明)
6. [版面配置（Layout A/B/C）](#6-版面配置-layout-abc)
7. [時間軸計算邏輯](#7-時間軸計算邏輯)
8. [景點管理](#8-景點管理)
9. [路線管理](#9-路線管理)
10. [地理編碼與地圖整合](#10-地理編碼與地圖整合)
11. [天氣功能](#11-天氣功能)
12. [自動填入交通時間](#12-自動填入交通時間)
13. [匯入/匯出功能](#13-匯入匯出功能)
14. [雲端共用（Firebase）](#14-雲端共用-firebase)
15. [設定面板](#15-設定面板)
16. [多行程管理](#16-多行程管理)
17. [拖曳排序](#17-拖曳排序)
18. [復原/重做（Undo/Redo）](#18-復原重做-undoredo)
19. [本地持久化](#19-本地持久化)
20. [主題與外觀](#20-主題與外觀)
21. [隱藏功能：超級使用者模式](#21-隱藏功能超級使用者模式)
22. [完整 Action 清單](#22-完整-action-清單)
23. [API 整合摘要](#23-api-整合摘要)

---

## 1. 專案概述

純瀏覽器旅遊行程規劃工具，**零後端、零框架、零建置流程**。所有程式碼集中於單一 HTML 檔案，直接在瀏覽器開啟即可使用。

### 核心能力

- 多日行程規劃，每日可新增多個景點
- 自動計算每個景點的抵達／離開時間（時間軸）
- 三種版面切換（頁籤式、側邊欄、垂直捲動）
- 四種色彩主題（深色、淺色、賽博龐克、奶油）
- 天氣預報顯示（Open-Meteo API）
- 地理編碼（Google Places / Nominatim / Photon）
- 自動查詢景點間交通時間（OSRM / Google Maps Directions）
- 匯出 JSON、ICS（行事曆）、KML（Google My Maps）、CSV
- Firebase Firestore 雲端共用
- 完整的 Undo/Redo 支援（最多 50 步）
- 拖曳排序（桌機滑鼠 + 行動觸控）
- 多行程管理（同一瀏覽器存多個行程）

---

## 2. 技術架構

### 技術棧

| 分類 | 選擇 |
|------|------|
| 框架 | 無（Vanilla JS） |
| 渲染 | 字串拼接 innerHTML（每次 `render()` 全重繪） |
| 狀態管理 | 單向資料流：`setState() → save() → render()` |
| 事件處理 | 事件委派（Event Delegation）掛在 `#app` |
| 持久化 | localStorage |
| 雲端 | Firebase Firestore（可選，ProjectId 空時停用） |
| 地理編碼 | Nominatim OSM + Photon fallback |
| 路線計算 | OSRM（免費）+ Google Maps Directions API（可選） |
| 天氣 | Open-Meteo API（免費） |
| 地圖搜尋 | Google Places Autocomplete Element（可選）+ Nominatim |

### 單檔結構

```
tour-planner.html
├── <style>          CSS 變數定義主題、RWD breakpoints（600px、480px）
├── <script> Firebase App Compat CDN
├── <script> Firebase Firestore Compat CDN
└── <script>         全部業務邏輯（約 4600 行）
```

### 渲染模式

```
setState(updater)
  └── updater(state)          修改 state
      └── saveTrips()         寫入 localStorage
          └── render()        重新生成 #app 的 innerHTML
```

事件全部透過 `data-action` 屬性識別，`data-*` 傳遞參數：

```html
<button data-action="delete-spot" data-day-id="d1" data-spot-id="s1">刪除</button>
```

`#app` 上的 click/input/change 事件委派統一處理。

---

## 3. 資料結構

### 3.1 頂層 State

```javascript
{
  tripName: "新旅程",          // 行程名稱（可編輯）
  tripStartDate: "2025-01-01", // YYYY-MM-DD 或 ""（行程開始日期）
  activeDayId: "d_abc123",     // 目前顯示的天 ID
  settings: { /* 見 3.2 */ },
  days: [ /* Day[] 見 3.3 */ ],
  routes: {                    // 路線資料，key = "fromId→toId"
    "hs_d1→s1": { transport: "driving", recordedTime: 30 },
    "s1→s2":    { transport: "transit", recordedTime: 45 },
    "s2→he_d1": { transport: "walking", recordedTime: 10 }
  }
}
```

### 3.2 Settings（設定）

```javascript
{
  layout: "A",                 // "A"｜"B"｜"C"
  theme: "dark",               // "dark"｜"light"｜"cyberpunk"｜"cream"
  defaultTransport: "driving", // "driving"｜"transit"｜"walking"
  fontSize: "normal",          // "small"｜"normal"｜"large"
  weatherCity: "台北",          // 顯示用城市名
  weatherGeo: {                // null 或：
    lat: 25.0330,
    lng: 121.5654,
    timezone: "Asia/Taipei",
    countryCode: "TW",
    resolvedName: "Taipei, Taiwan"
  },
  weatherModel: null,          // null = 自動，或 "jma_seamless"｜"icon_seamless" 等
  googleMapsApiKey: ""         // Google Maps API Key，"NONE" = 明確停用
}
```

### 3.3 Day（天）

```javascript
{
  id: "d_abc123",              // 唯一 ID（genId() 生成）
  label: "第1天",               // 顯示標籤（可編輯）
  startTime: "08:00",          // "HH:MM" 或 ""（出發時間）
  startHotelName: "台北飯店",   // 出發飯店名稱
  endHotelName: "台北飯店",     // 返回飯店名稱
  spots: [ /* Spot[] 見 3.4 */ ]
}
```

### 3.4 Spot（景點）

```javascript
{
  id: "s_xyz789",              // 唯一 ID
  name: "台北101",              // 景點名稱
  stayDuration: 90,            // 停留時間（分鐘）
  notes: "買票排隊約20分鐘",    // 備註（多行文字）
  category: "sightseeing",     // 景點類別（見下方）
  lat: 25.0338,                // 緯度（null = 未編碼）
  lng: 121.5645,               // 經度
  resolvedAddress: "台北市信義區信義路五段7號"  // 完整地址
}
```

**景點類別** (`category`)：

| 值 | 中文 | 左側色條 |
|----|------|----------|
| `sightseeing` | 景點 | 藍色 |
| `food` | 美食 | 橘色 |
| `shopping` | 購物 | 紫色 |
| `transit` | 交通 | 灰色 |
| `hotel` | 住宿 | 綠色 |
| `activity` | 活動 | 紅色 |
| `other` | 其他 | 淺灰色 |
| `null` | 未分類 | 無色條 |

### 3.5 Route（路線）

```javascript
// key: "fromId→toId"（Unicode 箭頭 U+2192）
{
  transport: "driving",  // "driving"｜"transit"｜"walking"（選填）
  recordedTime: 30       // 分鐘（選填，0 = 不計入）
}
```

**飯店節點 pseudo-ID**：
- 出發飯店：`"hs_" + dayId`（例：`"hs_d_abc123"`）
- 返回飯店：`"he_" + dayId`（例：`"he_d_abc123"`）

路線 key 範例：
```
"hs_d1→s1"      飯店出發 → 第一個景點
"s1→s2"         景點1 → 景點2
"s3→he_d1"      最後景點 → 飯店返回
```

### 3.6 多行程儲存結構（localStorage）

```javascript
// key: "travel-planner-trips-v2"
{
  trips: [ State, State, ... ],  // 所有行程陣列
  activeIdx: 0                    // 目前顯示的行程索引
}
```

---

## 4. 狀態管理

### 修改狀態

```javascript
// 唯一合法入口
setState(updater, options)
// updater(state) 直接修改 state
// options.recordHistory = true（預設）：push undo stack
// options.recordHistory = false：不記錄（例：版面切換）
```

### 共用面板狀態（不進 undo stack）

```javascript
// 直接修改，呼叫 render()
setShareState(obj)  // Object.assign(shareState, obj); render()
```

### Undo/Redo

```javascript
let undoStack = []   // State[] 深層副本，max 50
let redoStack = []

// setState 呼叫時（recordHistory=true）：
undoStack.push(deepClone(state))
redoStack = []

// undo：
state = undoStack.pop()
redoStack.push(current)

// redo：
state = redoStack.pop()
undoStack.push(current)
```

---

## 5. UI 功能詳細說明

### 5.1 頂部列（Header）

- **行程名稱**：可點擊直接編輯的 `contenteditable`，失焦後儲存
- **行程日期**：date input，設定後各天的日期徽章自動計算
- **行程切換按鈕**：開啟多行程清單 overlay
- **本機操作下拉選單**（local-menu）：
  - 匯出 JSON（下載備份）
  - 匯入 JSON（讀取備份）
  - 列印 / 儲存 PDF
  - 匯出 ICS（行事曆）
  - 匯出 KML（Google My Maps）
  - 匯出 CSV（試算表）
  - 管理座標（批次重新查詢）
- **共用按鈕**：開啟 Firebase 共用面板
- **說明按鈕**：開啟 help overlay
- **復原/重做按鈕**（Ctrl+Z / Ctrl+Y 亦可）
- **設定按鈕**：開啟設定面板

### 5.2 天管理

- **新增天**：按鈕，自動命名「第N天」
- **刪除天**：需至少保留 1 天
- **複製天**：複製所有景點與路線到新天
- **重新命名天**：點擊天標籤直接編輯
- **切換天**（Layout A/B）：點擊頁籤或側邊欄項目
- **行動版下拉**（Layout B 小螢幕）：下拉選單選擇天
- **出發時間**：每天可設定「HH:MM」格式出發時間，觸發時間軸計算
- **出發飯店名稱**：顯示於行程頂端
- **返回飯店名稱**：顯示於行程底端

### 5.3 景點操作

每個景點卡片包含：
- **景點名稱**：可編輯文字（inline input）
- **地址搜尋按鈕**：觸發地理編碼
- **地圖連結按鈕**：在 Google Maps 開啟景點位置
- **備註**：多行文字 textarea
- **類別選擇器**：色塊圖示，點擊開啟 7 選項的 picker
- **停留時間**：小時 select + 分鐘 select（0-23h, 0/10/15/20/30/45/55min）
- **景點選單**（三點選單）：
  - 移動到另一天
  - 複製到另一天
  - 刪除

景點卡片左側有彩色 category 色條。

### 5.4 路線操作

每兩個相鄰節點之間顯示路線行：
- **交通方式**：driving / transit / walking 按鈕切換
- **時間輸入**：小時 select + 分鐘 select
- **Google Maps 導航連結**：依兩端點座標或名稱開啟

飯店節點（出發、返回）也有對應的路線行。

### 5.5 每日統計欄

每天底部顯示：
- 景點數量
- 總停留時間（HH:MM 格式）
- 總交通時間
- 全天長度（出發時間 → 最後抵達飯店）
- **超時警告**（紅色）：若排程超過 24 小時

### 5.6 天氣徽章

每天標頭顯示當日天氣（需設定天氣城市）：
- 天氣 emoji（晴/陰/雨等）
- 最高溫 / 最低溫
- 資料來源：Open-Meteo，依 `tripStartDate` + 天次計算日期
- 快取：sessionStorage，3 小時 TTL，最多 10 個城市（LRU）

---

## 6. 版面配置 (Layout A/B/C)

### Layout A — 頁籤式

```
┌──────────────────────────────────────────┐
│  Header                                  │
├────────┬────────┬────────┬───────────────┤
│ 第1天  │ 第2天  │ 第3天  │  [+新增天]    │
├────────┴────────┴────────┴───────────────┤
│                                          │
│  [出發飯店]                              │
│  ├── 景點 1                              │
│  ├── 路線行                              │
│  ├── 景點 2                              │
│  └── [返回飯店]                          │
│                                          │
│  每日統計                                │
└──────────────────────────────────────────┘
```

- 頁籤可水平捲動
- 每次只顯示一天

### Layout B — 側邊欄

```
┌──────────────────────────────────────────┐
│  Header                                  │
├──────────┬───────────────────────────────┤
│          │                               │
│  第1天   │   [出發飯店]                  │
│  🌤 28°  │   ├── 景點 1                  │
│          │   ├── 路線行                  │
│  第2天   │   ├── 景點 2                  │
│  🌧 22°  │   └── [返回飯店]              │
│          │                               │
│  [+]     │   每日統計                    │
└──────────┴───────────────────────────────┘
```

- 側邊欄顯示天氣摘要
- 行動版以下拉選單取代側邊欄

### Layout C — 垂直捲動

```
┌──────────────────────────────────────────┐
│  Header                                  │
├──────────────────────────────────────────┤
│  第1天 🌤 28°              [+天] [複製]  │
│  [出發飯店]                              │
│  ├── 景點 1                              │
│  └── [返回飯店]                          │
├──────────────────────────────────────────┤
│  第2天 🌧 22°              [+天] [複製]  │
│  ...                                     │
└──────────────────────────────────────────┘
```

- 所有天同時顯示
- 適合列印 / PDF 匯出

---

## 7. 時間軸計算邏輯

### 核心函式：`computeTimeline(day)`

輸入：`Day` 物件（含 `startTime`、`spots`、`id`）
輸出：`slots` 物件，key = 節點 ID 或路線 key，value = `{start: "HH:MM", end: "HH:MM"|null}`

```
算法：

若 day.startTime 為空 → 回傳 {}

cursor = day.startTime
slots[hs_dayId] = {start: cursor, end: cursor}  // 飯店出發（0分鐘）

forEach spot in day.spots:
    prevId = 前一個節點 ID（首個 = hs_dayId，否則 = 上一個 spot.id）
    routeKey = prevId + "→" + spot.id
    routeMins = routes[routeKey]?.recordedTime ?? 0

    // 路線時段
    slots[routeKey] = {start: cursor, end: addMins(cursor, routeMins)}
    cursor = addMins(cursor, routeMins)

    // 景點時段
    slots[spot.id] = {start: cursor, end: addMins(cursor, spot.stayDuration)}
    cursor = addMins(cursor, spot.stayDuration)

// 返回飯店路線
lastId = 最後一個 spot.id（若無景點 = hs_dayId）
returnKey = lastId + "→" + he_dayId
returnMins = routes[returnKey]?.recordedTime ?? 0
slots[returnKey] = {start: cursor, end: addMins(cursor, returnMins)}
slots[he_dayId] = {start: addMins(cursor, returnMins), end: null}
```

### 時間輔助函式

```javascript
addMinsToHHMM("08:30", 90) → "10:00"
// 超過 24h 回卷（%1440）
```

### 每日統計：`computeDayStats(day, slots)`

```javascript
{
  spotCount: day.spots.length,
  stayTotal: sum(spot.stayDuration),   // 分鐘
  transitTotal: sum(route.recordedTime),
  totalMins: diff(slots[he_dayId].start, day.startTime),  // 處理跨午夜
  freeMins: totalMins - stayTotal - transitTotal  // 負數 = 超時
}
```

---

## 8. 景點管理

### 新增景點

1. 點擊「新增景點」按鈕 → `data-action="add-spot"`
2. `setState` 在 `activeDayId` 的 `spots` 陣列末端 push 新景點
3. 新景點預設：`stayDuration: 60`, `category: null`, 其餘空白

### 刪除景點

1. 點擊景點選單 → 刪除
2. `clearRoutesForSpot(state, spotId)` 移除相關路線（key 含該 spotId 的所有路線）
3. 從 `day.spots` 移除

### 移動景點到另一天

1. 點擊景點選單 → 移動到第 N 天
2. 從來源天移除，push 到目標天
3. 清除相關路線（與鄰居的路線一併移除）

### 複製景點到另一天

1. 點擊景點選單 → 複製到第 N 天
2. 深層複製景點物件，賦予新 ID
3. 不複製路線

### 類別選擇器（Cat Picker）

- 點擊類別圖示按鈕開啟 overlay（`catPickerOpenSpotId`）
- 顯示 7 個類別 + 「清除」選項
- 選擇後關閉，更新 `spot.category`

---

## 9. 路線管理

### 交通方式

每條路線三個按鈕（driving / transit / walking）互斥選擇。

- 初始值：`state.settings.defaultTransport`
- 圖示：🚗 / 🚌 / 🚶

### 時間輸入

- 小時 select（0–23）
- 分鐘 select（0/5/10/15/20/25/30/35/40/45/50/55）
- 合計 `recordedTime = hours*60 + minutes`

### Google Maps 導航連結

若兩端點均有座標（lat/lng）：
```
https://www.google.com/maps/dir/{lat1},{lng1}/{lat2},{lng2}/?travelmode=driving
```
若缺少座標，改用名稱：
```
https://www.google.com/maps/dir/{encodedName1}/{encodedName2}/
```

---

## 10. 地理編碼與地圖整合

### 景點搜尋流程

**有 Google Maps API Key 時**：
- 顯示 `<gmp-place-autocomplete>` 元素
- 監聽 `gmp-placeselect` 事件取得 `place.location`（LatLng）
- 儲存 `lat`, `lng`, `resolvedAddress`

**無 API Key 時（或 "NONE"）**：
- 輸入景點名稱後，點擊搜尋按鈕
- 呼叫 Nominatim API 查詢：
  ```
  https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1
  ```
- Photon fallback（komoot）：
  ```
  https://photon.komoot.io/api/?q=...&limit=1
  ```
- Rate limit：至少間隔 2 秒（Nominatim 規定）

### OSRM 交通時間查詢（`getOSRMDuration`）

**Driving / Walking**（OSRM 免費 API）：
```
https://router.project-osrm.org/route/v1/{mode}/{lng1},{lat1};{lng2},{lat2}?overview=false
```
回傳 `duration`（秒），除以 60 = 分鐘（ceiling）

**Transit**（需 Google Maps API）：
- 呼叫 Directions API
- 若無 key 則跳過（顯示「無法自動填入公共運輸時間」）

### Google Maps 開啟景點

有座標：`https://www.google.com/maps?q={lat},{lng}`
無座標：`https://www.google.com/maps/search/{encodedName}`

### 座標管理對話框

批次管理景點座標：
- 顯示所有有名稱的景點的座標狀態（✓ 已知 / ？未知）
- 逐一重新查詢（Nominatim）或全部批次查詢
- 查詢完成後更新 `spot.lat`, `spot.lng`, `spot.resolvedAddress`

---

## 11. 天氣功能

### 天氣城市設定

1. 在設定面板輸入城市名稱
2. 點擊確認 → Nominatim geocoding 取得 lat/lng/timezone
3. 儲存至 `settings.weatherGeo`

### 天氣資料取得（`fetchWeather`）

API：Open-Meteo `https://api.open-meteo.com/v1/forecast`

參數：
```
latitude, longitude, timezone,
daily=temperature_2m_max,temperature_2m_min,weathercode,
forecast_days=16,
models={autoSelectedModel}
```

**模型自動選擇**（依 `countryCode`）：
| 國家 | 模型 |
|------|------|
| JP, TW | `jma_seamless` |
| CN | `cma_grapes_global` |
| KR, DE, FR, AT, CH | `icon_seamless` |
| 其他 | `best_match` |

使用者可在設定面板覆蓋為：
- `best_match`（自動）
- `jma_seamless`（日本氣象廳）
- `icon_seamless`（德國氣象局）
- `gfs_seamless`（美國 GFS）
- `cma_grapes_global`（中國氣象局）

### WMO 天氣代碼 → Emoji

```javascript
// 部分對應
0        → "☀️"  晴天
1-3      → "🌤"  局部晴
45, 48   → "🌫"  霧
51-67    → "🌧"  雨
71-77    → "❄️"  雪
80-82    → "🌦"  陣雨
95-99    → "⛈"  雷雨
```

### 快取策略

```javascript
// sessionStorage key: "weather-cache-v2"
{
  "{lat},{lng}": {
    data: {...},        // 完整 API 回應
    fetchedAt: timestamp,
    timezone: "..."
  }
}
// TTL: 3 小時，LRU 上限 10 個城市
```

---

## 12. 自動填入交通時間

### 觸發方式

- **單天填入**：每天標頭有「🔄自動填入」按鈕（`data-action="auto-fill-day"`）
- **全部天填入**：全域按鈕（`data-action="auto-fill-all"`）

### 流程

1. 收集需查詢的路線（相鄰景點對，含飯店節點），篩除已有時間的路線
2. 顯示對話框：列出所有將查詢的路線段
3. 選項：
   - **緩衝時間**：額外加幾分鐘（input，預設 0）
   - **覆蓋已有時間**：checkbox（預設不勾）
4. 確認後：
   - 並行呼叫 OSRM / Google Maps Directions API
   - 有座標的路線自動查詢；Transit 模式且有 API Key 才查公共運輸
   - 結果 + 緩衝時間 → `setState` 批次更新所有路線

### 路線段格式（對話框顯示）

```
飯店出發 → 台北101    driving  (查詢中...)
台北101 → 故宮博物院  transit  已有 45 分鐘（跳過）
故宮博物院 → 飯店返回 walking  (查詢中...)
```

---

## 13. 匯入/匯出功能

### 13.1 匯出 JSON

- 序列化目前 `state`（含 days、routes、settings）
- 下載為 `{tripName}-{YYYY-MM-DD}.json`

### 13.2 匯入 JSON

1. `<input type="file" accept=".json">` 選擇檔案
2. 讀取並解析 JSON
3. 驗證：必須有 `days` 陣列
4. 確認對話框：「是否覆蓋目前行程？」
5. `migrateState()` 處理舊版相容（見下）
6. 取代目前 `state`

### 13.3 資料遷移（`migrateState`）

處理歷史版本資料升級：

```javascript
// 舊版 hotelName → 拆分為 startHotelName + endHotelName
if (day.hotelName) {
  day.startHotelName = day.hotelName
  day.endHotelName = day.hotelName
  delete day.hotelName
}

// 確保每個 spot 有 category、lat、lng、resolvedAddress
// 確保 settings 有所有必要欄位（填入預設值）
```

### 13.4 匯出 ICS（行事曆）

- 每個景點生成一個 `VEVENT`
- `DTSTART`/`DTEND`：依時間軸計算結果 + `tripStartDate`
- 沒有日期 → 全天事件（VALUE=DATE）
- `SUMMARY`：景點名稱
- `DESCRIPTION`：備註
- `GEO`：若有座標，附上緯度;經度
- 下載為 `{tripName}.ics`

### 13.5 匯出 KML（Google My Maps）

格式：KML 2.2

結構：
```xml
<kml>
  <Document>
    <Style id="day1-style">
      <IconStyle>...</IconStyle>
      <LineStyle><color>ff{dayColor}</color></LineStyle>
    </Style>
    <Folder><name>第1天</name>
      <!-- 出發飯店 Placemark -->
      <!-- 景點 1 Placemark (有座標) -->
      <!-- 景點 2 Placemark (無座標，僅名稱) -->
      <!-- 折線 LineString（只含有座標的節點） -->
    </Folder>
    <!-- 第2天 Folder... -->
  </Document>
</kml>
```

流程：
1. 顯示「預覽座標狀態」對話框：綠色（有座標）/ 紅色（無座標）
2. 無座標景點 → 自動呼叫 Nominatim 查詢（有快取 sessionStorage `kml-geo-cache`）
3. 查詢完畢後允許下載

每天一種顏色（循環從預設 8 色調色盤）。

### 13.6 匯出 CSV（試算表）

UTF-8 BOM（Excel 相容）+ 標題列 + 每景點一行：

```
名稱,天,抵達時間,離開時間,停留時間(分),備註,緯度,經度
台北101,第1天,09:30,11:00,90,"觀景台",25.0338,121.5645
```

---

## 14. 雲端共用（Firebase）

### 14.1 前提

- Firebase 專案需在 HTML 中設定 `FIREBASE_CONFIG`
- `FIREBASE_CONFIG.projectId` 為空字串時，整個雲端功能停用（按鈕隱藏）
- Firestore collection：`shared_trips`

### 14.2 Document 結構

```javascript
{
  tripName: string,
  uploadedAt: Timestamp,
  data: State,                  // 完整 state 物件
  deletePasswordHash: string,   // SHA-256（hex）
  visibility: "public" | "private",
  secretCodeHash: string | null // private 才有
}
```

### 14.3 密碼雜湊

使用 Web Crypto API：
```javascript
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(text))
  return [...new Uint8Array(buf)]
    .map(b => b.toString(16).padStart(2, "0")).join("")
}
```
**明文永不儲存**，只存 hash。

### 14.4 上傳流程

1. 點擊「上傳行程」→ 選擇公開/私人
2. 若私人 → 輸入秘密暗號（分享碼）
3. 輸入刪除密碼（至少 1 字元）
4. 呼叫 `addDoc`，寫入完整 state
5. 成功後顯示分享連結：`{origin}?import={docId}`
6. 將 `docId` 存入 `localStorage['travel-planner-imported-doc-id']`

### 14.5 瀏覽/匯入公開行程

1. 開啟共用面板 → 讀取 `visibility == "public"` 的文件
2. 顯示清單：行程名稱、上傳時間
3. 點擊「匯入」→ 確認對話框
4. 取得文件 data → `migrateState()` → 取代目前行程

### 14.6 私人行程查詢

1. 切換到「私人」頁籤
2. 輸入秘密暗號 → SHA-256 hash
3. Firestore query：`where("secretCodeHash", "==", hash)`
4. 顯示符合的行程清單

### 14.7 URL 直接匯入

1. 其他人收到連結 `?import={docId}`
2. 頁面載入時 `handleImportParam()` 偵測參數
3. 確認對話框 → 取回文件 → 匯入
4. `history.replaceState()` 移除 URL 參數

### 14.8 覆寫（更新雲端行程）

前提：必須是自己上傳的行程（知道刪除密碼）

1. 點擊「覆寫」按鈕
2. 輸入原刪除密碼
3. 選擇是否同步更新雲端行程名稱
4. 驗證 hash 一致後，更新 `data`、`tripName`、`uploadedAt`

### 14.9 刪除雲端行程

1. 點擊「刪除」→ 輸入刪除密碼
2. 驗證 hash → `deleteDoc`

### 14.10 修改刪除密碼

在「管理」對話框：
1. 輸入舊密碼 + 新密碼
2. 驗證舊 hash → 更新 `deletePasswordHash`

---

## 15. 設定面板

### 開關

右上角設定圖示按鈕，點擊後在右側滑入面板（或 overlay）。

### 設定項目

| 設定 | UI 元件 | 說明 |
|------|---------|------|
| 版面 | 3個按鈕（A/B/C） | 切換版面，不記錄 undo |
| 主題 | 4個按鈕 | dark/light/cyberpunk/cream |
| 字體大小 | 3個按鈕 | small/normal/large |
| 預設交通方式 | 3個按鈕 | 新路線預設值 |
| 天氣城市 | text input + 確認按鈕 | geocoding 查詢 |
| 天氣模型 | `<select>` | 覆蓋自動選擇 |
| Google Maps API Key | radio（停用/啟用） + text input | 啟用進階功能 |

### Google Maps API Key 模式

- **停用**（NONE）：使用 Nominatim 搜尋、OSRM 路線（免費，無需 key）
- **啟用**：輸入 key → 啟用 Places Autocomplete + Directions API

---

## 16. 多行程管理

### 資料結構

localStorage 儲存陣列，可有多個 State：
```javascript
{ trips: [State, State, ...], activeIdx: 0 }
```

### 行程清單 Overlay

- 點擊「切換行程」按鈕開啟
- 列出所有行程名稱
- 點擊切換 `activeTripIdx`
- 「新增行程」按鈕 → push 空白 State，切換到新行程
- 「刪除行程」按鈕（至少保留 1 個）

---

## 17. 拖曳排序

景點支援拖曳重新排序（**同一天內**）。

### 桌機（HTML5 Drag and Drop）

- 每個景點卡片有拖曳把手圖示（`draggable="true"`）
- `dragstart`：記錄拖曳的 spotId
- `dragover`：顯示插入指示線（placeholder）
- `drop`：計算新位置，`setState` 重排 `spots` 陣列

### 行動版（Touch Drag）

- 長按 200ms 觸發拖曳模式
- 生成 ghost 元素跟隨手指移動
- `touchmove`：偵測目前在哪個景點上方（插入前/後）
- `touchend`：確定新位置，更新 state

---

## 18. 復原/重做 (Undo/Redo)

### 觸發方式

- Ctrl+Z / Cmd+Z：復原
- Ctrl+Y / Cmd+Shift+Z：重做
- 頂部 ← → 按鈕

### 行為

- 每次 `setState(fn, {recordHistory: true})`（預設）：
  1. 深層複製目前 `state` push 到 `undoStack`
  2. 清空 `redoStack`
- 復原：
  1. pop `undoStack` 取得舊 state
  2. 目前 state push 到 `redoStack`
  3. 更新 state、存檔、重繪
- 重做：反向操作
- 上限：`undoStack` 最多 50 個版本，超出移除最舊

**不記錄 undo 的操作**：版面切換、主題切換、字體切換（UI 設定）

---

## 19. 本地持久化

### localStorage Keys

| Key | 內容 | 說明 |
|-----|------|------|
| `travel-planner-trips-v2` | `{trips, activeIdx}` | 所有行程（主要儲存） |
| `travel-planner-v1` | 舊版單行程 State | 升級遷移用 |
| `travel-planner-imported-doc-id` | docId string | 最後匯入的雲端行程 ID |
| `travel-planner-superuser` | boolean | 超級使用者狀態 |

### sessionStorage Keys

| Key | 內容 |
|-----|------|
| `weather-cache-v2` | 天氣快取 JSON |
| `kml-geo-cache` | KML 匯出時的地理編碼快取 |

### 初始化流程

```
頁面載入
  → loadTrips()
    → 讀 travel-planner-trips-v2
    → 若無，讀舊版 travel-planner-v1 並升級
    → 若無，建立預設空白行程
  → migrateState() 每個行程
  → handleImportParam()（偵測 ?import=）
  → render()
```

---

## 20. 主題與外觀

### 四種主題

主題透過 CSS 自訂屬性（`--var-name`）定義，`<html>` 加 class 切換：

| 主題 | 描述 |
|------|------|
| `dark`（預設） | 深色背景、低對比、現代感 |
| `light` | 淺色背景、高對比 |
| `cyberpunk` | 高飽和螢光色、霓虹感 |
| `cream` | 暖米色、柔和文字 |

### 字體大小

```css
html.font-small  { font-size: 13px; }
html.font-normal { font-size: 15px; }
html.font-large  { font-size: 17px; }
```

### RWD Breakpoints

- `600px`：行動版版面調整（側邊欄改下拉選單、頂部列壓縮）
- `480px`：更小螢幕的額外壓縮

### 行動版底部快捷列

小螢幕底部固定浮動列：
- 「+ 景點」快速新增
- 「+ 天」快速新增天

---

## 21. 隱藏功能：超級使用者模式

### 啟用方式

1. 開啟說明 overlay
2. 點擊說明頁底部的「`$`」符號（不顯眼的隱藏連結）
3. 輸入密碼 `6666`
4. 確認後設定 `localStorage['travel-planner-superuser'] = true`

### 超級使用者特權

- 在共用面板可查看**所有私人行程**（不需暗號）
- 可**不輸入刪除密碼**直接刪除任何行程

### 停用

- 再次點擊 `$` 符號，提示已啟用，再次輸入或清除

---

## 22. 完整 Action 清單

以下為所有 `data-action` 值及其觸發的操作：

### 行程管理

| action | 觸發 | 說明 |
|--------|------|------|
| `trip-name` | input/blur | 更新行程名稱 |
| `trip-start-date` | change | 設定行程開始日期 |
| `open-trips` | click | 開啟多行程清單 |
| `close-trips` | click | 關閉多行程清單 |
| `switch-trip` | click | 切換行程（data-idx） |
| `delete-trip` | click | 刪除行程（data-idx） |
| `new-trip-in-list` | click | 在清單中新增行程 |

### 本機操作

| action | 觸發 | 說明 |
|--------|------|------|
| `toggle-local-menu` | click | 切換本機操作下拉 |
| `close-local-menu` | click | 關閉本機操作下拉 |
| `export-json` | click | 匯出 JSON |
| `import-json` | change | 匯入 JSON（file input） |
| `print-trip` | click | 列印 |
| `export-ics` | click | 匯出 ICS |
| `export-kml` | click | 匯出 KML |
| `export-csv` | click | 匯出 CSV |
| `manage-coords` | click | 開啟座標管理對話框 |

### 天管理

| action | 觸發 | 說明 |
|--------|------|------|
| `add-day` | click | 新增天 |
| `select-day` | click | 切換活躍天（data-day-id） |
| `delete-day` | click | 刪除天（data-day-id） |
| `day-name` | input/blur | 更新天標籤（data-day-id） |
| `copy-day` | click | 複製天（data-day-id） |
| `day-start-time` | blur | 設定出發時間（data-day-id） |
| `hotel-start-name` | input/blur | 設定出發飯店名稱 |
| `hotel-end-name` | input/blur | 設定返回飯店名稱 |
| `toggle-day-dropdown` | click | 行動版天下拉選單 |
| `close-day-dropdown` | click | 關閉天下拉 |

### 景點管理

| action | 觸發 | 說明 |
|--------|------|------|
| `add-spot` | click | 新增景點（data-day-id） |
| `spot-name` | input/blur | 更新景點名稱（data-spot-id） |
| `spot-notes` | input/blur | 更新備註（data-spot-id） |
| `spot-dur-h` | change | 更新停留時數（data-spot-id） |
| `spot-dur-m` | change | 更新停留分鐘（data-spot-id） |
| `delete-spot` | click | 刪除景點（data-spot-id, data-day-id） |
| `open-cat-picker` | click | 開啟類別選擇器（data-spot-id） |
| `close-cat-picker` | click | 關閉類別選擇器 |
| `set-cat` | click | 設定類別（data-spot-id, data-cat） |
| `toggle-spot-menu` | click | 開啟景點選單（data-spot-id） |
| `close-spot-menu` | click | 關閉景點選單 |
| `move-spot-to-day` | click | 移動景點到另一天 |
| `copy-spot-to-day` | click | 複製景點到另一天 |
| `geocode-spot` | click | 地理編碼景點（Nominatim） |
| `focus-spot-autocomplete` | click | 觸發 Google Places 搜尋 |
| `open-spot-map` | click | 在 Google Maps 開啟景點 |

### 路線管理

| action | 觸發 | 說明 |
|--------|------|------|
| `route-transport` | change | 更改交通方式（data-from, data-to） |
| `route-time-h` | change | 更改路線時數 |
| `route-time-m` | change | 更改路線分鐘 |
| `auto-fill-day` | click | 自動填入單天（data-day-id） |
| `auto-fill-all` | click | 自動填入全部天 |
| `close-autofill-dialog` | click | 關閉自動填入對話框 |
| `confirm-autofill` | click | 執行自動填入 |

### 雲端共用

| action | 觸發 | 說明 |
|--------|------|------|
| `open-share` | click | 開啟共用面板 |
| `close-share` | click | 關閉共用面板 |
| `switch-share-tab` | click | 切換公開/私人頁籤 |
| `query-private-trips` | click | 查詢私人行程（輸入暗號） |
| `private-code-input` | input | 輸入私人暗號 |
| `open-upload-dialog` | click | 開啟上傳對話框（公開） |
| `open-upload-dialog-private` | click | 開啟上傳對話框（私人） |
| `set-upload-visibility` | click | 切換上傳可見度 |
| `upload-secret-code-input` | input | 輸入上傳暗號 |
| `close-share-dialog` | click | 關閉共用子對話框 |
| `confirm-upload` | click | 確認上傳 |
| `import-shared-trip` | click | 匯入雲端行程（data-doc-id） |
| `copy-share-url` | click | 複製分享連結 |
| `copy-trip-link` | click | 複製行程連結（data-doc-id） |
| `open-overwrite-dialog` | click | 開啟覆寫對話框（data-doc-id） |
| `set-overwrite-update-name` | click | 切換是否同步名稱 |
| `confirm-overwrite` | click | 確認覆寫 |
| `open-manage-dialog` | click | 開啟管理對話框（data-doc-id） |
| `manage-change-pw-view` | click | 切換至修改密碼頁面 |
| `manage-back` | click | 返回管理主頁 |
| `manage-delete` | click | 從管理頁開啟刪除 |
| `manage-change-pw-submit` | click | 提交修改密碼 |
| `confirm-delete` | click | 確認刪除雲端行程 |

### 設定

| action | 觸發 | 說明 |
|--------|------|------|
| `toggle-settings` | click | 開啟/關閉設定面板 |
| `close-settings` | click | 關閉設定面板 |
| `setting` | click | 變更設定（data-key, data-value） |
| `weather-city-input` | input | 輸入天氣城市 |
| `confirm-weather-city` | click | 確認天氣城市（geocoding） |
| `weather-model-select` | change | 選擇天氣模型 |
| `gmaps-key-mode` | change | 切換 Google Maps Key 模式 |
| `gmaps-api-key-input` | input | 輸入 Google Maps API Key |

### UI 輔助

| action | 觸發 | 說明 |
|--------|------|------|
| `open-help` | click | 開啟說明 overlay |
| `close-help` | click | 關閉說明 overlay |
| `undo` | click | 復原 |
| `redo` | click | 重做 |
| `toggle-superuser-prompt` | click | 切換超級使用者輸入 |
| `submit-superuser-pw` | click | 提交超級使用者密碼 |

---

## 23. API 整合摘要

| API | 用途 | 費用 | 需要 Key |
|-----|------|------|----------|
| Open-Meteo | 天氣預報 | 免費 | 否 |
| Nominatim (OSM) | 地理編碼、景點搜尋 | 免費 | 否（Rate limit: 1 req/2s） |
| Photon (komoot) | 地理編碼 fallback | 免費 | 否 |
| OSRM | Driving/Walking 時間 | 免費 | 否 |
| Google Maps Places | 景點搜尋 Autocomplete | 付費 | 是（可選） |
| Google Maps Directions | Transit 時間計算 | 付費 | 是（可選） |
| Google Maps (連結) | 開啟地圖、導航 | 免費 | 否 |
| Firebase Firestore | 雲端共用 | 免費額度內免費 | 需自行建立專案 |

### 最小可用模式（完全免費，無需任何 Key）

即使不設定任何 API Key，下列功能仍完全運作：
- 完整的行程規劃、編輯、排序
- 時間軸計算
- Nominatim 地理編碼（速度較慢）
- OSRM 駕車/步行時間查詢
- 天氣預報
- 所有匯出格式（JSON、ICS、KML、CSV）
- Undo/Redo、多行程管理

**需要 Google Maps API Key 才有的功能**：
- Google Places Autocomplete（搜尋景點更方便）
- 公共運輸時間自動查詢

**需要 Firebase 設定才有的功能**：
- 雲端上傳/匯入/分享

---

*文件產生日期：2026-07-27*
*對應程式碼：`tour-planner.html`（4667 行）*
