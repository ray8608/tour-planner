# 設計：Notion Markdown ＋ CSV 橋接

**日期**：2026-07-31
**狀態**：approved（brainstorming 產出，待 writing-plans）
**依據**：[[../../adr/0007-notion-interchange-and-replace-import]]、[[../../adr/0008-notion-zip-packaging-and-data-model]]、CONTEXT.md「交換與同步」

## 1. 目標與範圍

兩個**互相獨立**的功能，各自對齊 Notion，**不要求可逆**（不考慮 web→Notion→web 來回）：

1. **匯出**：產生 Notion 可 import 的 Markdown ＋ CSV，打包成單一 ZIP。
2. **匯入**：解析 Notion export 的 Markdown ＋ CSV（`.zip`），取代式建成一趟 Trip。

**非目標**：雙向合併／增量同步／跨系統穩定 ID；MD 的 web↔web 無損來回（已判定 YAGNI——JSON 匯出已提供無損備份，且任何經過 Notion 的來回必然遺失座標）。

## 2. Notion Schema（對映依據，來自 `notion/template_notion/`）

Notion 匯出是**多檔資料夾**：頂層頁面 md（僅連結）＋ 每資料庫一份 CSV（另有 `_all` 富欄位版）＋ 每列一個子頁 md。行程資料在 CSV。

| Notion 資料庫 | 欄位（`_all`） | 備註 |
|---|---|---|
| 行程 / 行程表 | `日期, Day, Details, 類別, 移動方式, 時間, 備註, 營業時間, 圖片, 地址` | 兩份同 schema（視圖複本）；匯入去重 |
| 住宿 | `Name, image, 付款類型, 位置, 地址, 城市, 日期, 網址, 花費, 類型` | `地址`=全文地址、`位置`=maps 連結 |
| 交通 | `Transport, No., 出發時間, 出發機場, 抵達時間, 抵達機場, 等級, 航空公司, 類型, 飛行時間` | 航班；含整列空白列需略過 |
| 旅遊攻略 | `Name, 圖片, 城市, 筆記` ＋ 子頁 md 正文 | 正文在子頁 |

**欄位語義（關鍵）**：
- `日期`（行程）：絕對時刻範圍字串 `"July 15, 2026 9:05 (GMT+8) → 11:05"`（起含日期＋時刻，訖只有時刻）。
- `時間`（行程）：**時長**字串 `"2 hrs 45 mins"` / `"15 mins"` / `"1 hr"`（英文、單複數、偶有雙空格 typo）。
- `移動方式` 非空 ⇒ 交通段列（Leg Row）；可多值 `"JR, 步行"`。空 ⇒ 景點列（Spot Row）。
- `Details`（Leg）常為 `"A - B"`（備援判定）。
- `地址`（行程）＝ maps.app.goo.gl 短連結（無座標）。
- 住宿 `日期`＝ `"July 18, 2026 → July 20, 2026"`（入住→退房，只有日期）。
- 交通 `出發時間`＝ 12 小時制 `"July 15, 2026 11:05 AM (GMT+8)"`。

## 3. 資料模型變更（`js/state.js`）

`makeSpot()` 新增：
- `openingHours: ""`（對應 `營業時間`）
- `imageUrl: ""`（對應 `圖片`）

Trip 層（`defaultState()`）新增，皆為**獨立側記錄**、不注入時間軸：
- `notes: ""`——匯入放不下內容的落腳處。
- `todos: []`——`{ id, text, done }`（Notion 頂層待辦）。
- `accommodations: []`——`{ id, name, type, address, mapUrl, city, checkIn, checkOut, cost, paymentStatus, bookingUrl, imageUrl }`。
- `flights: []`——`{ id, direction, airline, flightNo, cabin, fromAirport, departTime, toAirport, arriveTime, duration, international }`。
- `guides: []`——`{ id, title, city, imageUrl, body }`（body 為 Markdown）。

`version` bump；`migrateState(raw)` 補齊上述預設（陣列預設 `[]`、字串預設 `""`），為附加欄位、不動既有 days/spots/routes，向後相容。

## 4. 模組架構（純函式，延續 `js/services/export.js` 風格）

| 檔案 | 職責 | 純度 |
|---|---|---|
| `js/services/zip.js` | `zipStore(files)→Uint8Array`（store-only 手寫 CRC32＋local＋central dir）；`unzip(bytes)→Promise<{path,bytes}[]>`（原生 `DecompressionStream('deflate-raw')` inflate，容忍 store 與 deflate 條目） | 純（unzip 為 async 純函式） |
| `js/services/notion-csv.js` | CSV parse/serialize；欄位簽名辨識；`parseDuration`/`formatDuration`；`parseNotionDate` | 純 |
| `js/services/notion-export.js` | `tripToNotionFiles(state)→{path,bytes}[]`（鏡像資料夾） | 純 |
| `js/services/notion-import.js` | `notionFilesToTrip(files)→{state, report}` | 純 |
| `js/app.js`（既有） | 下載 Blob／讀檔（非純）；匯入報告 modal 接線 | 非純 |

`DecompressionStream`／`CompressionStream` 為現代瀏覽器原生 API，與本專案既有 Web Crypto／ES Modules 基線一致，零 runtime 依賴（見 [[../../adr/0008-notion-zip-packaging-and-data-model]]）。

## 5. 匯出設計（Trip → Notion ZIP）

鏡像 Notion 匯出結構，使 Notion 能 re-import。僅在有資料時產生對應檔：

```
<行程名>.md                    頂層：標題 + 待辦清單（- [ ] / - [x]）
<行程名>/行程.csv              行程資料庫（見下）
<行程名>/住宿.csv              有 accommodations 才產生
<行程名>/交通.csv              有 flights 才產生
<行程名>/旅遊攻略.csv           有 guides 才產生
<行程名>/旅遊攻略/<標題>.md     每則 guide 正文
```

全部以 `zipStore` 打包（store-only；Notion import 接受未壓縮 zip）。

**行程.csv 欄位**（對齊參考模板順序）：`日期, Day, Details, 類別, 移動方式, 時間, 備註, 營業時間, 圖片, 地址, 緯度, 經度`
- 景點列：`Details`=name；`日期`=由 `computeTimeline` + `tripStartDate`+`day.startTime` 算出 `"<Mon D, YYYY> HH:MM (GMT+8) → HH:MM"`（缺日期基準則留空）；`類別`=enum→中文；`時間`=`stayDuration`→`formatDuration`；`營業時間`=openingHours；`圖片`=imageUrl；`地址`=resolvedAddress；`備註`=notes；`緯度/經度`=lat/lng（Notion 容忍多欄，順手保座標）。
- 交通列（由 `routes` 展開）：`Details`=`"<from> - <to>"`；`移動方式`=transport enum→中文；`時間`=`recordedTime`→`formatDuration`。

`緯度/經度` 為額外尾欄；因不考慮 web→Notion→web，其作用僅為順手保存，Notion 匯入時視為多餘文字欄，無害。

## 6. 匯入設計（Notion export → Trip，取代式）

1. **輸入**：接受 `.zip`（Notion 匯出）。`unzip` 用原生 `DecompressionStream` inflate 成 `{path,bytes}[]`。（importer 核心吃 `{path,bytes}[]`，未來可加散檔適配層。）
2. **辨識（欄位簽名，忽略檔名／語言）**：
   - 行程：表頭含 `Details` ＋（`移動方式` 或 `類別`）。
   - 住宿：表頭含 `Name` ＋ `付款類型`／`花費` ＋ `日期`（值含 `→` 之日期範圍）。
   - 交通：表頭含 `航空公司` ＋ 機場欄 ＋ `飛行時間`。
   - 攻略：表頭含 `Name` ＋ `城市` ＋ `筆記`。
   - 多份行程 CSV（行程／行程表）→ 以 `(Day, Details, 日期)` 去重後合併。
3. **建 days／spots／routes**：
   - 依 `Day` 分組排序成 `days[]`。
   - `移動方式` 非空 ⇒ 交通段；否則景點。
   - `時間`→`parseDuration`：景點→`stayDuration`、交通→`recordedTime`。
   - `日期`→`parseNotionDate`：當天首列起始時刻→`day.startTime`；最早日期→`tripStartDate`。
   - `類別`／`移動方式` 中文→enum（多值取首、其餘併入該列 notes）。
   - `地址`→`resolvedAddress`（maps 連結原樣保留）；`緯度/經度` 空（Notion 無座標）。
   - `圖片`→`imageUrl`；`營業時間`→`openingHours`；`備註`→`notes`。
   - **交通段↔routes**：按當天列序，交通段對應「前一景點→後一景點」的 `routes[from→to]`；`Details` `"A - B"` 為備援校驗；觸及住宿名（比對 `startHotelName`/`endHotelName`）者接 `hs_/he_` pseudo-id；無法安置者寫入 report（best-effort）。
4. **側記錄**：住宿→`accommodations`（`日期` 拆 `checkIn`/`checkOut`）；交通→`flights`（12h 時刻解析、略過空白列、`類型`→`international`）；攻略→`guides`（正文取自子頁 md）。
5. **頂層**：頂層頁 md 的待辦清單→`todos`。
6. **放不下的內容**：外部 widget 連結（分帳／匯率／天氣）、地圖 PNG、溢出文字→`trip.notes`，並在 **report** 列出「哪些內容未能完整匯入」。
7. **落地**：`importState(trip)`（migrateState 容錯、清空 history、存檔、重繪）。

`report` 形狀：`{ dropped: string[], warnings: string[], counts: { days, spots, legs, accommodations, flights, guides, todos } }`。

## 7. 錯誤處理

- ZIP 損毀／非 zip／無可辨識 CSV → 回傳明確錯誤，不動既有狀態。
- `parseDuration`／`parseNotionDate` 對未知格式回傳 null 並記入 `warnings`，不中斷整體匯入。
- 匯入是取代式：僅在成功建出 Trip 後才 `importState`；解析中途失敗不留半套狀態。

## 8. 測試（Vitest；`notion/template_notion/` 真實檔為 fixture）

- `zip.js`：store round-trip；CRC32 對照已知向量；能 inflate 參考 Notion zip 條目。
- `notion-csv.js`：`parseDuration`（`"1 hr"`/`"2 hrs 45 mins"`/雙空格）；`parseNotionDate`（24h、12h AM/PM、GMT 後綴、範圍）；簽名辨識四類；CSV 引號／逗號／換行跳脫。
- `notion-import.js`：以真實 fixture 斷言 days／spots／legs／accommodations／flights／guides／todos 數量與關鍵值正確；缺座標時 lat/lng 為 null；空白列略過；多值 `"JR, 步行"` 取首＋溢出入 notes。
- `notion-export.js`：產出檔名與 CSV 表頭符合規格；`formatDuration` 反向；有／無側記錄的檔案集差異。
- 迴歸：既有 95 測試全綠。

## 9. UI 接線與收尾

- 匯出／匯入選單新增「Notion (ZIP)」（事件委派 `data-action`）；匯出走既有 Blob 下載、匯入走檔案讀取。
- 匯入完成彈出 report modal（未能完整匯入清單）。
- 更新 `README.md` 與 `renderHelpOverlay()`；push 前更新說明頁「最後更新」欄位。

## 10. 對 ADR 的修正（隨此 spec 一併更新）

- **ADR-0007**：刪除「MD 供 web↔web 無損來回」與「雙軌：MD 給人＋無損」措辭；改為「匯出對齊 Notion import、匯入吃 Notion export，兩向獨立、不可逆」。其餘（取代式、Leg Row、時長、座標欄、簽名辨識、溢出＋報告）不變。
- **ADR-0008**：`flights[]`/`guides[]` 欄位對齊本 spec §3；打包新增「匯入用原生 DecompressionStream inflate」一句。
