# Design: 一鍵自動填通勤時間

**日期**：2026-06-26  
**狀態**：已核准，待實作

---

## 概述

在每天行程標題列及全域設定面板各新增一個按鈕，按下後自動向外部路線 API 查詢當天（或全部天）所有景點間的通勤時間，並批次填入 `state.routes[key].recordedTime`。支援使用者指定緩衝時間，填入值為「API 查詢結果 + 緩衝時間」。

---

## 資料變更

### state.settings 新增欄位

```js
googleMapsApiKey: 'NONE'
// 'NONE' = 沒有 key（預設值，大眾運輸路線略過）
// 其他非空字串 = 有效的 Google Maps API key
```

路線資料結構 (`state.routes[key]`) 無需變更，現有 `recordedTime` 欄位即為寫入目標。

---

## 架構：雙路線 API

| 模式 | Geocoding | Routing API | 支援交通方式 |
|---|---|---|---|
| 無 key（`NONE` 或尚未設定） | Nominatim (OSM) | OSRM 公開 API | 開車、步行 |
| 有 Google Maps key | 不需要（直接傳地名） | Google Maps Directions API | 開車、步行、大眾運輸 |

### 免費路徑（Nominatim + OSRM）

- **Geocoding**：`https://nominatim.openstreetmap.org/search?q={name}&format=json&limit=1`
  - 取第一筆結果的 `lat`, `lon`
  - 請求需帶 `User-Agent: tour-planner` header（遵守 Nominatim usage policy）
  - 請求間隔 ≥ 1 秒（遵守 Nominatim usage policy rate limit）
- **Routing**：`https://router.project-osrm.org/route/v1/{profile}/{lng1},{lat1};{lng2},{lat2}?overview=false`
  - `profile` 對應：`driving`（開車）→ `driving`、`walking`（步行）→ `foot`
  - 回傳 `routes[0].duration`（秒），換算為分鐘（無條件進位）

### 付費路徑（Google Maps Directions API）

- **Endpoint**：`https://maps.googleapis.com/maps/api/directions/json`
- **參數**：`origin={fromName}&destination={toName}&mode={travelMode}&key={apiKey}`
- `travelMode`：`driving` / `walking` / `transit`
- 回傳 `routes[0].legs[0].duration.value`（秒）

---

## 執行流程

```
按下按鈕（單天 or 全部）
  ↓
收集所有待填路線段（hotel→spot1, spot1→spot2, ..., lastSpot→hotel）
  ↓
若 googleMapsApiKey 為 'NONE' → 過濾掉 transport = 'transit' 的路線（計入「略過」）
  ↓
跳出確認對話框（見下節）
  ↓
依序處理每條路線（Nominatim 需串行 + 1s 間隔；Google Maps 可並行）：
  ├─ 有效 key → Google Maps Directions API
  └─ 無 key → Nominatim geocode(from) → 等1s → Nominatim geocode(to) → OSRM
  ↓
填入 recordedTime = Math.ceil(apiSeconds / 60) + bufferMins
  ↓
顯示完成 toast
```

---

## UI 配置

### A. 每天按鈕

位置：每天標題列右側，與「+ 新增景點」等控制項並排。

```
[ 第1天  08:00  出發飯店⌄ ]  [ ⏱ 自動填通勤 ]  [ + 新增景點 ] ...
```

按下後立即進入 loading 狀態（disabled）。

### B. 全域按鈕

位置：設定面板（齒輪），新增「工具」區塊。

```
─── 工具 ───
[ ⏱ 自動填所有天的通勤時間 ]
```

### C. Google Maps API Key 設定

位置：設定面板，新增「Google Maps」區塊。

```
─── Google Maps ───
● 沒有 key（大眾運輸路線將略過）
○ 使用 API Key：[________________________________]
```

- 預設選「沒有 key」（`NONE`）
- 選「使用 API Key」時顯示輸入框
- key 值即時存入 `state.settings.googleMapsApiKey`

---

## 確認對話框

按下任一按鈕後彈出，統一處理「覆蓋確認」與「緩衝時間」。

```
┌─────────────────────────────────────────┐
│  自動填通勤時間                           │
│                                         │
│  找到 5 條路線待填入                      │
│  ⚠ 其中 2 條已有時間，是否覆蓋？  ☑ 覆蓋  │
│  （若不勾選，已有時間的路線將略過）         │
│                                         │
│  緩衝時間：[  0  ] 分鐘                   │
│  （每段通勤時間自動加上此緩衝）            │
│                                         │
│          [ 取消 ]  [ 開始填入 ]           │
└─────────────────────────────────────────┘
```

- 若所有路線都沒有既有時間，「覆蓋」那行不顯示
- 緩衝時間預設 0，輸入 0 以上整數
- 按「取消」不做任何修改

---

## 錯誤處理

| 情況 | 行為 | 計入 |
|---|---|---|
| transport = transit 且 key = 'NONE' | 跳過 | 略過 |
| 景點名稱為空 | 跳過 | 略過 |
| Nominatim 找不到地名 | 跳過 | 失敗 |
| OSRM 回傳錯誤 | 跳過 | 失敗 |
| Google Maps API 回傳錯誤 | 跳過 | 失敗 |
| 不勾選覆蓋且路線已有時間 | 跳過 | 略過 |

### 完成 toast 範例

```
✅ 通勤時間填入完成：成功 4 條、略過 1 條（大眾運輸需 key）
⚠ 完成：成功 3 條、略過 1 條、失敗 1 條（找不到地點）
```

---

## 函式規劃

| 函式 | 說明 |
|---|---|
| `collectRouteSegments(dayOrDays)` | 收集指定天（單天 or 全部）的路線段列表，含 from/to 名稱（`routeKey`、地名字串）與 transport；飯店節點使用 `day.startHotelName` / `day.endHotelName` 作為地名 |
| `nominatimGeocode(name)` | 呼叫 Nominatim，回傳 `{lat, lng}` 或 `null` |
| `osrmRoute(from, to, profile)` | 呼叫 OSRM，回傳秒數或 `null` |
| `googleMapsRoute(fromName, toName, mode, key)` | 呼叫 Directions API，回傳秒數或 `null` |
| `autoFillCommuteTime(segments, opts)` | 主流程：接收路線段陣列與選項（bufferMins, overwrite, key），執行查詢並批次 setState |
| `showAutoFillDialog(segments, onConfirm)` | 渲染確認對話框 |

---

## 不在本次範圍

- 快取 geocoding 結果（未來可優化：同名景點只查一次）
- 行程日期 + 出發時間帶入 Google Maps（transit 時刻表最佳化）
- 騎車（bike）模式
