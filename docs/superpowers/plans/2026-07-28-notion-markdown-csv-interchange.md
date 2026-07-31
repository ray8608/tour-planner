# 計畫：Notion／Markdown／CSV 交換功能

**日期**：2026-07-28
**依據**：[[../../adr/0007-notion-interchange-and-replace-import]]、[[../../adr/0008-notion-zip-packaging-and-data-model]]、CONTEXT.md「交換與同步」章節

## 目標

讓本工具與 Notion 互通：網頁規劃 → 匯出一份給 Notion；既有 Notion 匯出 → 匯入回網頁。web 為主檔、取代式匯入、雙軌（Markdown 給人＋web↔web 無損；CSV 對齊 Notion database），單一 ZIP 打包。

## 已定案決策（Q1–Q11）

1. web 為主檔，取代式匯入（不合併、不維護跨系統 ID）
2. 兩向獨立、不可逆：匯出產生 Notion 可讀的 MD（頁面）＋CSV（資料庫）；匯入吃 Notion export（見 2026-07-31 spec，取代原「MD web↔web 無損」）
3. 交通獨立成列，以「移動方式」欄非空判定
4. 全採用 Notion 專有欄位：`openingHours`＋`imageUrl`（spot）、`todos[]`、`accommodations[]`、`flights[]`、`guides[]`（trip）
5. 單一 ZIP，鏡像 Notion 資料夾，store-only 零依賴
6. 住宿／航班為獨立側記錄，不連結、不注入時間軸
7. 匯入取時長；當天第一列時刻 → `day.startTime`
8. 座標存 CSV `緯度`／`經度` 欄
9. 多值降單值，其餘塞 notes
10. CSV 身分靠欄位簽名判定（忽略檔名／語言）
11. 放不下的內容 → 行程級 `notes` ＋ 匯入報告

## 實作階段（TDD，Vitest）

### 階段 0：資料模型與遷移
- `js/state.js`：version bump；`makeSpot` 加 `openingHours`/`imageUrl`；`defaultState` 加 `trip.notes/todos/accommodations/flights/guides`；`migrateState` 補齊預設值。
- 測試：舊 state（無新欄位）遷移後欄位齊備且不破壞既有 days/spots/routes。

### 階段 1：純 JS ZIP（store-only）
- `js/services/zip.js`：`zipStore(files: {path, bytes}[]) → Uint8Array`（CRC32＋local header＋central directory）；`unzip(bytes) → {path, bytes}[]`。
- 測試：round-trip（zip→unzip 還原）；CRC32 對照已知向量；能解 Notion 巢狀路徑與 URL-encoded 檔名。

### 階段 2：Markdown 匯出／匯入（web↔web 無損）
- `js/services/markdown.js`：`tripToMarkdown(state)`、`markdownToTrip(md)`。含座標等 Notion 沒有的欄位；人類可讀。
- 測試：任意 state → md → state 深度相等（round-trip 無損）。

### 階段 3：CSV 對齊 Notion
- 擴充 `js/services/export.js`（或新 `notion-csv.js`）：輸出行程／住宿／交通／攻略 CSV，欄位對齊 Notion；時長輸出英文 `"N hrs M mins"`。
- 解析：欄位簽名辨識 CSV 類型；行程列拆 spot／leg；時長解析（含 Notion 雙空格 typo 容錯）；多值取首＋溢出入 notes。
- 測試：以 `notion/template_notion/` 真實檔為 fixture 解析成 Trip；斷言天數、景點數、交通段、住宿、航班、攻略正確；缺座標時 `緯度`/`經度` 空。

### 階段 4：ZIP 打包整合
- `exportNotionZip(state) → Uint8Array`：頂層 md＋各 CSV＋各列子頁 md，鏡像 Notion 結構。
- `importNotionZip(bytes) → {state, report}`：解 ZIP → 依簽名分派 → 組 Trip；產生匯入報告（未能完整匯入的項目）。
- 測試：匯出的 ZIP 能被自己 import 還原；能吃 Notion 原始匯出 ZIP。

### 階段 5：UI 接線
- 匯出／匯入選單加「Notion（ZIP）」與「Markdown」選項（事件委派 `data-action`）。
- 匯入後顯示報告 modal（放不下的內容清單）。取代式匯入走 `importState`（清 history）。
- 更新 `README.md` 與 `renderHelpOverlay()`（新功能說明），push 前更新「最後更新」欄位。

## 風險／注意
- Notion 時長字串格式雜（英文、偶有雙空格）→ 解析需寬鬆。
- Notion 地址是 maps 短連結、無座標 → 匯入後需使用者重新定位（既有 geocode 流程）。
- store-only ZIP 不壓縮，檔案較大但零依賴、可讀。
- 未採用的頂層外部 widget（分帳／匯率／天氣）連結 → 落 `trip.notes` ＋報告。

## 驗證
- `rtk proxy npx vitest run` 全綠（現有 95 ＋ 新增）。
- Playwright headless：匯出→下載→匯入 round-trip 手動流程檢查。
