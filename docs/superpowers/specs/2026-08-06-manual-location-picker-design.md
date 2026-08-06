# 設計:難以自動定位時的「手動/候選地點」選取

日期:2026-08-06
狀態:設計已核可,待寫實作計畫

## 背景與問題

目前景點與飯店的座標定位完全依賴「用名稱自動 geocode 取第一筆」:

- 景點卡片有一顆 🔍/📍 按鈕(`data-action="geocode-spot"`),點下去以名稱查 `geocodePlace()`,只取第一筆結果寫回 `spot.lat/lng/resolvedAddress`。
- 飯店(`startHotelName`/`endHotelName`)**沒有任何座標欄位**,也沒有定位按鈕;僅在「自動填通勤」時暫時 geocode、不落地。
- 地理編碼(Nominatim/Photon/Google Geocoder)目前都只取 `limit=1` 的第一筆。

當名稱難以自動定位(冷門地名、同名多地、需要更精確地址)時,使用者無法:
1. 手動輸入更精確的地址/關鍵字重新查詢;
2. 從多個「可能或接近」的候選地點中挑選正確的一個。

舊版 `tour-planner.html` 曾以 Google Places 自動完成(`showGooglePlaceSearch`)提供類似能力,但僅限有 Google 金鑰時。本次要在現行模組化架構下、以預設免費 OSM 服務為主,補回並強化這個能力。

## 目標

- 景點與飯店都能在自動定位不理想時,**手動輸入地址重查** 或 **從候選清單挑選**。
- 飯店取得可持久化的座標,並讓下游(通勤估算、KML 匯出、座標管理)受惠。
- 不引入 Google Places SDK 依賴;候選來源沿用目前啟用的服務(Google Geocoder 或 OSM,兩者皆能回多筆)。

## 非目標(YAGNI)

- 不做地圖點選(map click-to-pin)。
- 不做即時 as-you-type 自動完成;採「輸入 → 按搜尋 → 列清單」。
- 不支援直接手打經緯度數值(手動輸入指的是地址/地名字串)。
- 不重構飯店為物件結構(採扁平平行欄位,降低對既有引用的衝擊)。

## 設計

### 1. 資料模型 + 遷移

飯店新增與景點對稱的扁平座標欄位(`js/state.js` 的 `makeDay`):

```js
startHotelName: "", startHotelLat: null, startHotelLng: null, startHotelAddress: "",
endHotelName:   "", endHotelLat:   null, endHotelLng:   null, endHotelAddress:   "",
```

- `migrateState(raw)`:舊資料缺這些欄位時補 `null`/`""`(比照既有 `startHotelName`/`endHotelName` 遷移處理的位置)。
- 行為對齊景點:**編輯飯店名稱不清掉既有座標**,座標僅由定位動作更新;與現有景點名稱編輯行為一致。

### 2. 候選地理編碼層(services)

沿用現有「純解析函式 + fetch 薄層」風格,新增多筆版本;既有單筆函式與 `geocodePlace`(批次工具用,`limit=1`、含節流)保持不變。

- `js/services/geocode.js`
  - `parseNominatimAll(data, limit)` → `Array<{lat,lng,address}>`
  - `parsePhotonAll(data, limit)` → `Array<{lat,lng,address}>`
  - `geocodeCandidates(name, fetchImpl=fetch)`:Nominatim `limit=5`,失敗回退 Photon;回傳陣列(可能為空)。沿用現有 2s 節流。
- `js/services/gmaps.js`
  - `parseGeocoderResultsAll(results)` → `Array<{lat,lng,address}>`
  - `googleGeocodeCandidates(name, key)`:以 Geocoder 回傳的多筆結果解析;失敗回傳 `[]`。
- `js/services/nav.js`
  - 門面 `geocodeCandidates(name)`:有金鑰先 Google、回退 OSM;回傳陣列。

候選項目形狀:`{ lat, lng, address }`,`address` 作為清單顯示標籤。

### 3. 選地點對話框 + 進入點

新增 UI 模組 `js/locate.js`(命令式、自建獨立容器,重用現有 `.tool-dialog` / `.tool-backdrop` 樣式與 Esc 關閉模式,如同 `js/tools.js`)。

匯出 `openLocatePicker(target)`:

- `target`:`{ kind: "spot", dayId, spotId }` 或 `{ kind: "hotel", dayId, field: "startHotelName" | "endHotelName" }`。
- **開啟即以目前名稱自動搜一次**,列出候選;若名稱為空則等待輸入。
- 搜尋輸入框預填目前名稱,可自由改字重搜(= 手動輸入地址),按鈕與 Enter 皆可觸發。
- 候選清單:每列顯示完整地址;點任一列 → `commit` 寫回座標 + `resolvedAddress` → 關閉。
- 狀態列:查詢中… / 找不到,請改關鍵字重試;標註目前服務(`navServiceName()`)。
- 底部:「關閉」、「清除定位」(座標歸零,供改回未定位)。

寫回(以 `state.js` 的 `commit`):
- spot:設 `sp.lat` / `sp.lng` / `sp.resolvedAddress`(既有欄位)。
- hotel:依 `field` 設對應的 `startHotel*` 或 `endHotel*` 座標與地址欄位。

進入點接線(`app.js` 事件委派):
- 景點:現有 `data-action="geocode-spot"` 由「一鍵取第一筆」改為 **開 `openLocatePicker({kind:"spot",…})`**。
- 飯店:`js/render/day.js` 的 `renderHotelItem` 於名稱輸入旁**新增定位按鈕** `data-action="geocode-hotel"`(有座標顯 📍、否則 🔍,`title` 顯示已解析地址),`app.js` 接到 `openLocatePicker({kind:"hotel",…})`。

### 4. 下游接線

- **通勤自動填**(`js/tools.js` `resolveNodeCoords`):飯店端點**優先用已存座標**(`day.startHotelLat/Lng` 等),沒有才以名稱 geocode;與景點的「優先既有座標」邏輯一致,減少查詢。
- **座標管理**(`js/tools.js` `openCoordManager`):
  - 清單除景點外**也列出飯店**端點(可勾選批次定位,寫回飯店座標)。
  - 每列新增「選」入口,開 `openLocatePicker` 供失敗項手動挑選。
- **KML 匯出**(`js/services/export.js` `toKml`):飯店有座標時,地標帶真實經緯度,並將飯店端點納入路徑 `LineString`(目前飯店為無座標地標)。

## 測試

- 純函式:`parseNominatimAll`、`parsePhotonAll`、`parseGeocoderResultsAll`(含空輸入、少於 limit、座標為函式/數值等情境)。
- `migrateState`:舊資料補齊飯店座標欄位預設值。
- 既有 `tests/*.test.js` 於 node 環境跑,新純函式比照現有風格。

## 文件同步(依專案規範)

1. `README.md` — 功能說明。
2. `js/render/index.js` `renderHelpOverlay()` — 功能介紹文字,並更新底部「最後更新」欄位(日期 2026-08-06 + 本次摘要)。
3. 對應 `tests/*.test.js`。

## 影響檔案一覽

- `js/state.js`(飯店座標欄位 + 遷移)
- `js/services/geocode.js`、`js/services/gmaps.js`、`js/services/nav.js`(候選查詢)
- `js/locate.js`(新增:選地點對話框)
- `js/render/day.js`(飯店定位按鈕)
- `js/app.js`(事件接線:geocode-spot 改開對話框、geocode-hotel)
- `js/tools.js`(通勤用飯店座標、座標管理納入飯店 + 選地點入口)
- `js/services/export.js`(KML 飯店座標 + 路徑)
- `README.md`、`js/render/index.js`、`tests/*.test.js`
