# KML 匯出功能設計

**日期**：2026-07-14  
**功能**：將旅遊行程匯出為 KML 檔案，可直接匯入 Google My Maps 查看

---

## 目標

讓使用者能將規劃好的行程一鍵匯出為 `.kml` 檔案，匯入 Google My Maps 後得到：
- 每天一個圖層（Layer）
- 各景點與飯店的地圖 Pin
- 當天移動路徑折線

---

## 架構

### 新增函數

| 函數 | 用途 |
|------|------|
| `exportKML()` | 主流程：orchestrate geocoding → 產生 KML → 下載 |
| `geocodeForKML(name)` | 單一地名查座標，含 sessionStorage 快取 |
| `generateKML(days, coordMap)` | 接收天數資料與座標 map，回傳 KML 字串 |

### 資料流

```
使用者點「匯出 KML」
  → 收集所有唯一名稱（飯店出發點、飯店返回點、各天所有景點名稱）
  → 顯示進度覆蓋層「正在查詢座標 0 / N…」
  → 逐一 geocodeForKML()
      - 先查 sessionStorage（key: `kml-geo:${name}`）
      - cache miss → 呼叫 Nominatim API
      - 失敗 → 記錄為 null（降級：不含座標）
      - 更新進度計數
  → 呼叫 generateKML(state.days, coordMap)
  → 觸發 .kml 下載
  → 關閉進度覆蓋層
```

---

## KML 結構

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>{tripName}</name>

    <!-- N 天 × 2 種樣式（Pin + 折線） -->
    <Style id="pin-0"><IconStyle>...</IconStyle></Style>
    <Style id="line-0"><LineStyle>...</LineStyle></Style>
    ...

    <!-- 每天一個 Folder -->
    <Folder>
      <name>第1天｜{day.label}</name>

      <!-- 🏨 出發飯店（若 startHotelName 非空） -->
      <Placemark>
        <name>🏨 {startHotelName}</name>
        <description>出發</description>
        <styleUrl>#pin-0</styleUrl>
        <Point><coordinates>{lng},{lat},0</coordinates></Point>
      </Placemark>

      <!-- 📍 景點（依序） -->
      <Placemark>
        <name>📍 {N}. {spot.name}</name>
        <description>
          抵達：{start}　離開：{end}　停留：{stayDuration}分鐘
          {spot.notes}（若有）
        </description>
        <styleUrl>#pin-0</styleUrl>
        <Point><coordinates>{lng},{lat},0</coordinates></Point>
      </Placemark>

      <!-- 🏨 返回飯店（若 endHotelName 非空） -->
      <Placemark>
        <name>🏨 {endHotelName}</name>
        <description>返回</description>
        <styleUrl>#pin-0</styleUrl>
        <Point><coordinates>{lng},{lat},0</coordinates></Point>
      </Placemark>

      <!-- 折線（只含有座標的節點） -->
      <Placemark>
        <name>第{N}天路線</name>
        <styleUrl>#line-0</styleUrl>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>
            {lng1},{lat1},0 {lng2},{lat2},0 ...
          </coordinates>
        </LineString>
      </Placemark>

    </Folder>
    ...
  </Document>
</kml>
```

### 座標缺失處理

- 某節點 geocode 失敗 → 仍輸出 Placemark（保留名稱與描述），但省略 `<Point>` 子元素；使用者匯入 My Maps 後可手動拖曳定位
- 折線只串連有座標的節點；若有座標的節點少於 2 個，折線 Placemark 整個省略

---

## 顏色配對（8 天循環，超過 8 天從頭循環）

KML 顏色格式為 `aabbggrr`（完全不透明 alpha=ff）。

| 天 | Pin（景點/飯店） | 折線 |
|----|-----------------|------|
| 0 | 紅 `ff0000e5` | 橙 `ff0055ff` |
| 1 | 藍 `ffff3900` | 青 `ffffff00` |
| 2 | 綠 `ff00b300` | 黃綠 `ff00ffaa` |
| 3 | 紫 `ff990099` | 粉 `ffcc66ff` |
| 4 | 橙 `ff0080ff` | 黃 `ff00d7ff` |
| 5 | 青 `ffcccc00` | 靛 `ffcc6600` |
| 6 | 玫瑰 `ff6600cc` | 洋紅 `ffcc0099` |
| 7 | 金 `ff00ccff` | 棕橙 `ff0066cc` |

折線寬度：3.0（`<width>3</width>`）  
Pin 圖示：Google My Maps 內建 `http://maps.google.com/mapfiles/kml/paddle/wht-circle.png`，透過 `<color>` 套用當天顏色

---

## 進度覆蓋層

- 觸發後於畫面中央顯示 toast 風格覆蓋層
- 內容：「正在查詢座標 X / N…」
- 地理編碼完成後自動消失，不提供取消按鈕（Nominatim 呼叫很快）
- 若出現部分失敗，完成後顯示短暫提示「N 個景點未找到座標，已略過定位」，3 秒後自動消失

---

## sessionStorage 快取

- Key 格式：`kml-geo:${name}`（name 為去頭尾空白後的景點名稱）
- Value：`JSON.stringify({ lat, lng })` 或 `"null"`（明確記錄查詢失敗）
- 生命週期：sessionStorage（關閉頁籤後清除），無需手動管理

---

## UI 變更

### 匯出按鈕

在現有「匯出 JSON」「匯出 ICS」按鈕旁新增：

```html
<button data-action="export-kml">匯出 KML（Google My Maps）</button>
```

位置與現有匯出按鈕相同（工具面板 / 選單內）。

### Help 說明頁面

在 `renderHelpOverlay()` 的匯出說明段落補充：

> **匯出 KML**：將行程匯出為 `.kml` 檔案，可匯入 Google My Maps。每天為獨立圖層，包含景點 Pin 與路線折線。

---

## 邊界條件

| 情況 | 處理方式 |
|------|----------|
| 景點名稱為空 | 跳過該景點（不 geocode、不加 Placemark） |
| 飯店名稱為空 | 跳過飯店節點 |
| 整天景點皆無座標 | 仍輸出 Folder，但無 LineString |
| 行程天數 0 天 | 匯出含 Document 但無 Folder 的空 KML |
| Nominatim rate limit（429） | 視為失敗，記錄 null，繼續下一個 |

---

## 不在本次範圍內

- 自動開啟 Google My Maps 上傳頁（需跳出至外部網站，本次不做）
- 行程類別圖示（不同 category 用不同 Pin 圖示）
- 路線折線的實際走法（依 OSRM 路徑，而非直線）——KML LineString 目前為直線連接
