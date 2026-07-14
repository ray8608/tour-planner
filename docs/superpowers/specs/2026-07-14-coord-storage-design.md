# 座標儲存與匯出確認功能設計

**日期**：2026-07-14  
**功能**：在景點輸入中加入座標儲存，改善 KML 匯出定位精準度；新增匯出前預覽確認 Dialog；新增 CSV 匯出

---

## 目標

1. **座標儲存**：景點查詢座標後，存入 spot 物件，避免每次匯出重新 geocode
2. **位置確認**：讓使用者在匯出前確認每個景點的地址是否正確
3. **CSV 匯出**：新增匯出試算表功能，包含座標欄位

---

## 資料模型

### Spot 物件新增欄位

```javascript
{
  // 既有欄位
  id, name, stayDuration, notes, category,

  // 新增欄位
  lat: null,             // number | null — WGS84 緯度
  lng: null,             // number | null — WGS84 經度
  resolvedAddress: null  // string | null — 顯示用地址文字
}
```

`migrateState()` 無需特別處理——既有 spot 缺少這些欄位時讀取為 `undefined`，與 `null` 等效，不影響邏輯。

---

## Geocoding 架構

### 有 Google Maps API Key 時（Places Autocomplete）

1. 在 `document` 層監聽 `focusin` 事件，目標為 `.spot-name` class 的 input
2. 首次 focus → 呼叫 `attachSpotAutocomplete(el, spotId, dayId)`
   - 在 el 上設 `el._autocomplete = true` 標記，防止 render() 後重複 attach
   - 建立 `google.maps.places.Autocomplete` 實例
3. 使用者從下拉清單選取 → `place_changed` 事件 → 取得 `place.geometry.location` 和 `place.formatted_address`
4. 呼叫 `setState()` 將 `lat`、`lng`、`resolvedAddress` 存入對應 spot

**按🔍按鈕行為（有 key）**：聚焦該景點的 input，觸發 Autocomplete 下拉

### 無 Google Maps API Key 時（Nominatim）

**按🔍按鈕行為（無 key）**：
1. 呼叫 `nominatimGeocode(spot.name)`
2. 結果存入 spot 的 `lat`、`lng`、`resolvedAddress`，呼叫 `setState()`
3. 查詢中按鈕顯示 loading 狀態（禁用 + 文字改為「查詢中…」）

### 新函數清單

| 函數 | 說明 |
|------|------|
| `attachSpotAutocomplete(el, spotId, dayId)` | 對 input 元素 attach Places Autocomplete，綁定 place_changed |
| `geocodeSpotByButton(spotId, dayId)` | 無 key 時按鈕觸發，呼叫 Nominatim 並更新 spot |

---

## Spot 卡片 UI

### 佈局

```
[ 🔍 ] [ 景點名稱 input               ] [ 🟢/🔴 ]
        台北市信義區信義路五段7號（小字，灰色）
```

### 元素說明

| 元素 | 說明 |
|------|------|
| 🔍 按鈕 | 有 key → 聚焦 input（觸發 Autocomplete）；無 key → 呼叫 Nominatim |
| 地址小字 | 顯示 `resolvedAddress`（灰色，僅在 resolvedAddress 非空時顯示） |
| 🟢 圖示 | 有座標；點擊 → `window.open('https://maps.google.com/?q={lat},{lng}', '_blank')` |
| 🔴 圖示 | 無座標；點擊 → `window.open('https://maps.google.com/?q={encodedName}', '_blank')` |

🔍 按鈕的 `data-action`：
- 有 key：`focus-spot-autocomplete`
- 無 key：`geocode-spot`

兩者皆傳 `data-spot-id` 和 `data-day-id`。

---

## 匯出前預覽 Dialog

### 觸發時機

點「匯出 KML」或「匯出 CSV」後，顯示 Dialog 前先批次補齊缺失座標：
1. 收集所有缺少 `lat/lng` 的景點與飯店名稱
2. 若有缺失 → 顯示進度 overlay，逐一 Nominatim geocode，結果暫存於 `coordMap`（不寫回 state，不影響使用者資料）
3. 補齊後顯示 Dialog

> **注意**：批次 geocode 結果只用於本次匯出，不寫回 spot 物件。使用者若需永久儲存座標，應透過🔍按鈕主動操作。

### Dialog 內容

```
┌─────────────────────────────────────────┐
│  確認地點座標                              │
│                                         │
│  🟢  台北101              第1天           │
│      台北市信義區信義路五段7號               │
│  🔴  國立故宮博物院         第1天           │
│      （未找到座標）                        │
│  🟢  西門紅樓              第2天           │
│      台北市萬華區成都路10號                 │
│                                         │
│  ℹ️ 紅色地點將略過定位，其餘正常匯出         │
│                                         │
│  [ 取消 ]          [ 確認匯出 ]            │
└─────────────────────────────────────────┘
```

- Dialog 以 `div` 覆蓋全螢幕（`position:fixed`，z-index 高於其他 overlay）
- 若所有地點皆有座標，仍顯示 Dialog 供確認（但無🔴項目）
- 點「取消」→ 關閉 Dialog，不下載
- 點「確認匯出」→ 執行實際匯出（KML 或 CSV）

### 共用函數

```javascript
async function showExportPreviewDialog(coordMap, onConfirm)
```

- `coordMap`：`{ name: {lat, lng} | null }` — 彙整 spot 自身座標 + 本次批次查詢結果
- `onConfirm`：確認後呼叫的 callback（產生並下載檔案）

---

## CSV 匯出

### 欄位

| 欄位 | 說明 |
|------|------|
| 景點名稱 | `spot.name` |
| 天 | 第 N 天（`dayIdx + 1`） |
| 抵達時間 | `slot.start`（來自 `computeTimeline`） |
| 離開時間 | `slot.end` |
| 停留時間(分) | `spot.stayDuration` |
| 備註 | `spot.notes` |
| 緯度 | `lat`（來自 spot 或 coordMap，空則留空） |
| 經度 | `lng`（來自 spot 或 coordMap，空則留空） |

### 觸發路徑

匯出下拉 → 「📊 匯出試算表 (.csv)」→ 批次 geocode 缺失座標 → 預覽 Dialog → 下載 `.csv`

### 新函數

```javascript
function generateCSV(days, coordMap)  // 純函數，回傳 CSV 字串
async function exportCSV()            // 主流程：geocode → dialog → 下載
```

---

## KML 匯出變更

現有 `exportKML()` 調整：
1. 先讀取 spot 自身的 `lat/lng`（若已儲存）
2. 缺失的才走 Nominatim 批次查詢
3. 查詢後顯示預覽 Dialog（複用 `showExportPreviewDialog`）
4. 確認後下載

---

## UI 變更彙整

### 匯出下拉選單

新增按鈕：`📊 匯出試算表 (.csv)`（位於「匯出 KML」之後）

### Help 說明頁面

補充：
- **🔍 查座標**：點擊景點卡片上的放大鏡圖示可查詢並儲存該景點的地理座標；有座標的景點匯出時定位更精準
- **匯出試算表 (.csv)**：下載包含景點名稱、時間、備註與座標的試算表檔案

### 最後更新欄位

更新 `renderHelpOverlay()` 底部「最後更新」為 `2026-07-14`。

---

## 邊界條件

| 情況 | 處理方式 |
|------|----------|
| 景點名稱為空 | 不顯示🔍按鈕與狀態圖示；geocode 跳過 |
| Nominatim 查詢中再次點🔍 | 忽略（按鈕 disabled） |
| Places Autocomplete 未選取直接 blur | 不儲存座標（不觸發 `place_changed`） |
| render() 重繪後 input 替換 | `el._autocomplete` 標記消失，下次 focus 重新 attach（正常行為） |
| 飯店名稱無座標 | 飯店節點列入預覽 Dialog，邏輯與景點相同 |
| 行程 0 天 | CSV/KML 匯出空內容，Dialog 顯示「無景點」 |

---

## 不在本次範圍內

- 手動拖曳調整 map pin 位置
- 座標從地圖選點（Map Picker）
- 批次 geocode 所有景點（只在匯出時觸發）
