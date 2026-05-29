# 天氣預報功能設計文件

**日期：** 2026-05-29
**狀態：** 草稿

---

## 1. 概述

為每天行程加入當日天氣預報資訊。使用者設定旅遊城市後，系統以 Open-Meteo 免費 API 取得天氣資料，在每天的行程標頭顯示天氣圖示、最高／最低溫度與降雨機率。

**設計原則：**
- 零 API key，純前端，不依賴任何後端
- 日期未設定（`state.tripStartDate` 為空）時靜默不顯示，不報錯
- 天氣資料快取於 localStorage，同城市同日期只發一次請求
- 網路失敗不影響主功能，降級為靜默不顯示

---

## 2. API 規格

### 2.1 Geocoding API（城市名稱 → 座標）

**Endpoint**

```
GET https://geocoding-api.open-meteo.com/v1/search
```

**請求參數**

| 參數 | 值 | 說明 |
|---|---|---|
| `name` | 城市名稱字串 | 支援中英文，如 `Tokyo`、`台北` |
| `count` | `1` | 只取第一筆結果 |
| `language` | `en` | 結果語言 |
| `format` | `json` | 固定值 |

**範例請求**

```
GET https://geocoding-api.open-meteo.com/v1/search?name=Taipei&count=1&language=en&format=json
```

**回應結構（取用欄位）**

```json
{
  "results": [
    {
      "latitude": 25.05306,
      "longitude": 121.52639,
      "timezone": "Asia/Taipei",
      "name": "Taipei",
      "country": "Taiwan"
    }
  ]
}
```

- `results` 陣列為空 → 城市名稱無法解析，於設定 UI 顯示「找不到城市」提示
- 取 `results[0]` 的 `latitude`、`longitude`、`timezone`

### 2.2 Forecast API（天氣預報）

**Endpoint**

```
GET https://api.open-meteo.com/v1/forecast
```

**請求參數**

| 參數 | 值 | 說明 |
|---|---|---|
| `latitude` | 數字 | 來自 Geocoding 結果 |
| `longitude` | 數字 | 來自 Geocoding 結果 |
| `daily` | `temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` | 需要的日資料欄位 |
| `timezone` | 來自 Geocoding 結果（如 `Asia/Taipei`） | 確保日期邊界正確 |
| `start_date` | ISO 日期字串（如 `2025-06-15`） | 行程第一天 |
| `end_date` | ISO 日期字串 | 行程最後一天 |
| `forecast_days` | 不傳（使用 start/end_date 取代） | — |

**範例請求**

```
GET https://api.open-meteo.com/v1/forecast?latitude=25.05306&longitude=121.52639&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=Asia%2FTaipei&start_date=2025-06-15&end_date=2025-06-17
```

**回應結構（取用欄位）**

```json
{
  "daily": {
    "time":                          ["2025-06-15", "2025-06-16", "2025-06-17"],
    "temperature_2m_max":            [29.4, 31.2, 28.8],
    "temperature_2m_min":            [23.1, 24.0, 22.5],
    "precipitation_probability_max": [80, 20, 45],
    "weathercode":                   [80, 1, 3]
  }
}
```

- `daily.time[i]` 對應該日的 ISO 日期字串，用來對齊行程天數
- `weathercode` 為 WMO 代碼，用於選取天氣圖示（見 2.3）
- Open-Meteo 最多提供未來 16 天預報；超出範圍的日期回傳資料為 `null`

### 2.3 WMO Weathercode → 圖示映射

使用 Unicode Emoji，無外部圖示依賴。

| 代碼範圍 | 天氣描述 | Emoji |
|---|---|---|
| 0 | 晴天 | ☀️ |
| 1 | 大致晴朗 | 🌤️ |
| 2 | 部分多雲 | ⛅ |
| 3 | 陰天 | ☁️ |
| 45, 48 | 霧 | 🌫️ |
| 51, 53, 55 | 毛毛雨 | 🌦️ |
| 56, 57 | 凍雨 | 🌧️ |
| 61, 63, 65 | 雨 | 🌧️ |
| 66, 67 | 凍雨（大） | 🌨️ |
| 71, 73, 75, 77 | 雪 | 🌨️ |
| 80, 81, 82 | 陣雨 | 🌦️ |
| 85, 86 | 陣雪 | 🌨️ |
| 95 | 雷雨 | ⛈️ |
| 96, 99 | 強雷雨 | ⛈️ |
| 其他 / null | 未知 | — （不顯示） |

```js
function wmoToEmoji(code) {
  if (code === null || code === undefined) return '';
  if (code === 0)                          return '☀️';
  if (code === 1)                          return '🌤️';
  if (code === 2)                          return '⛅';
  if (code === 3)                          return '☁️';
  if ([45, 48].includes(code))             return '🌫️';
  if ([51,53,55,80,81,82].includes(code))  return '🌦️';
  if ([56,57,61,63,65,66,67].includes(code)) return '🌧️';
  if ([71,73,75,77,85,86].includes(code))  return '🌨️';
  if ([95,96,99].includes(code))           return '⛈️';
  return '';
}
```

---

## 3. 城市設定 UI

### 3.1 設定位置

在現有 **設定面板**（`renderSettingsPanel()`）底部新增「天氣城市」設定組，位置在「預設交通方式」之後。

```
┌─────────────────────────────┐
│  ⚙️ 設定                    │
│  ...（現有設定）              │
│  天氣城市                    │
│  [Tokyo            ] [確認] │  ← 輸入框 + 確認按鈕
│  ✓ 東京，日本               │  ← Geocoding 成功後顯示解析結果
│  ⚠️ 找不到城市               │  ← 失敗時顯示
└─────────────────────────────┘
```

**行為：**
- 輸入框：`state.settings.weatherCity`（字串，初始為空字串 `''`）
- 按確認按鈕後觸發 Geocoding 查詢；查詢期間按鈕顯示「查詢中…」並 disabled
- 成功：將 `{ lat, lng, timezone, resolvedName }` 存入 `state.settings.weatherGeo`，顯示解析地名（如「東京，日本」）
- 失敗：清除 `state.settings.weatherGeo`，顯示錯誤文字
- 城市名稱變更後（按確認前）舊的 `weatherGeo` 保持有效直到新查詢完成

### 3.2 設計決策：全局一個城市

採全局單一城市，不做每天獨立設定。理由：
- 大多數行程在同一城市或相近地區，每天獨立設定增加操作負擔
- 城市欄位放在 settings 面板，結構簡潔
- 若未來有需求可在 `day` 層新增 `weatherCityOverride` 做覆蓋

---

## 4. 天氣顯示 UI

### 4.1 顯示位置

在 `renderDayHeader(day)` 回傳的 HTML 中，於日期字串之後、刪除按鈕之前插入天氣徽章：

```
┌────────────────────────────────────────┐
│  [第一天]  6/15(日)  🌦️ 28°/23° 80%  [🗑] │
└────────────────────────────────────────┘
```

Layout B 的側邊欄天數列表（`renderLayoutB()` 中的 day tab）亦顯示縮略版（僅圖示 + 最高溫）：

```
第一天  6/15  🌦️ 28°
```

### 4.2 天氣徽章 HTML 結構

```html
<span class="weather-badge">
  <span class="weather-icon">🌦️</span>
  <span class="weather-temp">28°/23°</span>
  <span class="weather-rain">💧80%</span>
</span>
```

- 氣溫以整數顯示（`Math.round()`），單位 °C
- 降雨機率 < 20% 時省略 💧 部分，減少視覺雜訊
- 資料尚未載入時：不渲染 `.weather-badge`（空字串）
- 資料為 null（超出預報範圍）時：不渲染

### 4.3 CSS

```css
.weather-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.weather-temp { font-weight: 500; color: var(--text); }
.weather-rain { color: #60a5fa; }
```

---

## 5. 快取策略

### 5.1 快取 Key 設計

```
weather-cache-v1
```

單一 localStorage key，值為 JSON 物件，結構如下：

```js
{
  "<city_normalized>": {
    lat: 25.05306,
    lng: 121.52639,
    timezone: "Asia/Taipei",
    resolvedName: "Taipei, Taiwan",
    fetchedAt: 1717027200000,   // Date.now()，geocoding 完成時刻
    forecast: {
      "2025-06-15": { tempMax: 29, tempMin: 23, precipProb: 80, weathercode: 80 },
      "2025-06-16": { tempMax: 31, tempMin: 24, precipProb: 20, weathercode: 1 }
    },
    forecastFetchedAt: 1717027201000  // forecast 請求完成時刻
  }
}
```

- `city_normalized`：`city.trim().toLowerCase()`
- Geocoding 結果（座標）有效期：**7 天**（城市座標不會變）
- Forecast 結果有效期：**3 小時**（預報資料每小時更新）
- 快取命中判斷：`(Date.now() - forecastFetchedAt) < 3 * 60 * 60 * 1000`

### 5.2 快取大小控制

每次寫入快取時，若快取中的城市數量超過 10 個，刪除最舊的（`forecastFetchedAt` 最小的）。旅遊行程規劃工具的城市數量極少，此限制只作保護。

### 5.3 相關函數

```js
const WEATHER_CACHE_KEY = 'weather-cache-v1';

function loadWeatherCache() {
  try { return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)) || {}; }
  catch (_) { return {}; }
}

function saveWeatherCache(cache) {
  localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
}

function getCachedForecast(city, date) {
  const cache = loadWeatherCache();
  const key = city.trim().toLowerCase();
  const entry = cache[key];
  if (!entry) return null;
  if ((Date.now() - entry.forecastFetchedAt) > 3 * 60 * 60 * 1000) return null;
  return entry.forecast[date] ?? null;   // null = 超出預報範圍，undefined = 尚未請求
}
```

---

## 6. 資料結構變更

### 6.1 `state.settings` 新增欄位

```js
settings: {
  // 現有欄位
  layout: 'A',
  theme: 'cream',
  defaultTransport: 'driving',
  fontSize: 'normal',
  // 新增欄位
  weatherCity: '',          // 使用者輸入的城市名稱
  weatherGeo: null,         // { lat, lng, timezone, resolvedName } | null
}
```

### 6.2 `defaultState()` 對應更新

`defaultState()` 回傳的 `settings` 加上：

```js
weatherCity: '',
weatherGeo: null,
```

### 6.3 `migrateState()` 對應更新

在 `migrateState(s)` 補上：

```js
if (!s.settings.weatherCity) s.settings.weatherCity = '';
if (!s.settings.weatherGeo)  s.settings.weatherGeo  = null;
```

### 6.4 不修改 `day` 物件結構

天氣資料純粹是展示層輔助資訊，存於 localStorage 快取而非 state，不污染 `day` 物件，也不影響雲端共用的資料結構。

---

## 7. 行為規範

### 7.1 不顯示天氣的情境

| 情境 | 處理 |
|---|---|
| `state.tripStartDate` 為空 | 靜默不顯示，不請求 API |
| `state.settings.weatherCity` 為空 | 靜默不顯示 |
| `state.settings.weatherGeo` 為 null（城市尚未解析） | 靜默不顯示 |
| 日期超出 Open-Meteo 預報範圍（16 天後） | 不顯示（API 回傳 null） |
| 快取存在但 `forecast[date]` 為 null | 不顯示（超出預報範圍的確認結果） |

### 7.2 網路錯誤處理

- Geocoding 失敗（網路錯誤或 500）：設定面板顯示「無法查詢城市，請稍後再試」，`weatherGeo` 保持原值（若之前有成功的值則保留）
- Forecast 請求失敗：不顯示天氣徽章，不彈錯誤；下次 `render()` 時若快取仍過期則靜默重試
- 不使用 `alert()`，不中斷使用者操作

### 7.3 載入中狀態

- Geocoding 查詢期間：確認按鈕文字改為「查詢中…」，disabled；輸入框保持可編輯
- Forecast 請求期間：行程標頭天氣位置顯示 `⏳`（僅在首次請求，快取未命中時），寬度固定避免版面跳動
- 使用模組級變數 `weatherLoading = false` 防止並發請求

### 7.4 請求時機

`render()` 呼叫時，若：
1. `state.tripStartDate` 非空
2. `state.settings.weatherGeo` 非 null
3. 有任何一天的日期快取未命中

則在 `render()` 結束後非同步觸發 `fetchWeatherIfNeeded()`。使用 `setTimeout(fetchWeatherIfNeeded, 0)` 讓渲染不被阻塞。

`fetchWeatherIfNeeded()` 一次性取得整個行程日期範圍的 forecast（單一 API 請求），而非每天發一次請求。

---

## 8. 實作要點

### 8.1 新增函數清單

| 函數 | 說明 |
|---|---|
| `wmoToEmoji(code)` | WMO 代碼轉 Emoji（純函數） |
| `loadWeatherCache()` | 讀取 localStorage 快取 |
| `saveWeatherCache(cache)` | 寫入 localStorage 快取（含大小控制） |
| `getCachedForecast(city, date)` | 取單日快取，回傳資料物件或 null |
| `geocodeCity(cityName)` | 呼叫 Geocoding API，回傳 `{ lat, lng, timezone, resolvedName }` |
| `fetchForecast(lat, lng, timezone, startDate, endDate)` | 呼叫 Forecast API，回傳 `{ [date]: { tempMax, tempMin, precipProb, weathercode } }` |
| `fetchWeatherIfNeeded()` | 判斷快取是否過期，未過期直接 render，過期則請求後存快取再 render |
| `renderWeatherBadge(dayIndex)` | 回傳天氣徽章 HTML 字串，供 `renderDayHeader` 插入 |

### 8.2 `renderDayHeader` 修改方式

```js
function renderDayHeader(day) {
  const dayIndex = state.days.findIndex(d => d.id === day.id);
  const dateStr  = getDayDate(dayIndex);
  const isoDate  = getDayIsoDate(dayIndex);           // 新增：回傳 YYYY-MM-DD 或 ''
  const weatherHtml = isoDate ? renderWeatherBadge(dayIndex, isoDate) : '';
  return `
    <div class="day-content-header">
      <input class="day-name-input" value="${escHtml(day.label)}"
        data-action="day-name" data-day-id="${day.id}">
      ${dateStr ? `<span style="font-size:12px;color:var(--text-muted)">${escHtml(dateStr)}</span>` : ''}
      ${weatherHtml}
      ${renderDeleteDayBtn(day)}
    </div>`;
}
```

新增 `getDayIsoDate(dayIndex)` 回傳 `YYYY-MM-DD` 格式（供 API 使用），與現有 `getDayDate()` 回傳的顯示格式分開：

```js
function getDayIsoDate(dayIndex) {
  if (!state.tripStartDate) return '';
  const d = new Date(state.tripStartDate + 'T00:00:00');
  d.setDate(d.getDate() + dayIndex);
  return d.toISOString().slice(0, 10);   // "YYYY-MM-DD"
}
```

### 8.3 Geocoding 事件處理

在現有 event delegation 的 `data-action` 分派區段加入：

```js
case 'confirm-weather-city': {
  const city = state.settings.weatherCity.trim();
  if (!city) break;
  // 設 loading 狀態後 render，再非同步查詢
  weatherGeoLoading = true;
  render();
  geocodeCity(city).then(geo => {
    weatherGeoLoading = false;
    setState(s => { s.settings.weatherGeo = geo; });
  }).catch(() => {
    weatherGeoLoading = false;
    weatherGeoError = '無法查詢城市，請稍後再試';
    render();
  });
  break;
}
case 'weather-city-input': {
  setState(s => { s.settings.weatherCity = e.target.value; });
  break;
}
```

`weatherGeoLoading` 與 `weatherGeoError` 為模組級變數（類似 `settingsOpen`），不進 state：

```js
let weatherGeoLoading = false;
let weatherGeoError   = '';
```

### 8.4 Forecast 請求範圍計算

取行程第一天與最後一天的 ISO 日期作為 `start_date` / `end_date`：

```js
async function fetchWeatherIfNeeded() {
  if (!state.tripStartDate || !state.settings.weatherGeo) return;
  const { lat, lng, timezone } = state.settings.weatherGeo;
  const city = state.settings.weatherCity.trim().toLowerCase();
  const dates = state.days.map((_, i) => getDayIsoDate(i)).filter(Boolean);
  if (!dates.length) return;
  const startDate = dates[0];
  const endDate   = dates[dates.length - 1];
  // 判斷是否全部命中快取
  const cache = loadWeatherCache();
  const entry = cache[city];
  const allCached = entry
    && (Date.now() - entry.forecastFetchedAt) < 3 * 60 * 60 * 1000
    && dates.every(d => d in entry.forecast);
  if (allCached) return;  // 全部命中，不請求
  try {
    const forecast = await fetchForecast(lat, lng, timezone, startDate, endDate);
    const newEntry = {
      ...( entry || { lat, lng, timezone, resolvedName: state.settings.weatherGeo.resolvedName, fetchedAt: Date.now() }),
      forecast: { ...(entry?.forecast || {}), ...forecast },
      forecastFetchedAt: Date.now(),
    };
    const newCache = { ...cache, [city]: newEntry };
    saveWeatherCache(newCache);
    render();
  } catch (_) {
    // 失敗靜默忽略，下次 render 再試
  }
}
```

### 8.5 不需修改的部分

- Firebase / 雲端共用相關函數：天氣資料不進 `state`，上傳雲端的資料不含天氣快取
- 匯入行程時：`migrateState()` 補上預設值即可，`weatherGeo` 清空（匯入者城市可能不同）
- Layout C（垂直捲動）：`renderDayHeader` 共用，天氣自動出現
