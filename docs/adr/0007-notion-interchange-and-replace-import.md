# ADR-0007：Notion／Markdown／CSV 交換與取代式匯入

**日期**：2026-07-28
**狀態**：accepted

## 背景

需求：讓本工具與 Notion 互通——網頁規劃好同步一份給 Notion，或把既有 Notion 行程同步回網頁。參考的 Notion 匯出（`notion/template_notion/`）是一個**多檔資料夾**：頂層頁面 md（僅連結、無行程資料）＋ 每個資料庫一份 CSV ＋ 每列一個子頁面 md。**行程資料在 CSV，不在頁面 md**；且 Notion 無 lat/lng，只有 maps 短連結，時間為英文時長字串（`"2 hrs 45 mins"`）。

雙方資料模型不對齊：Notion 用資料庫（行程／住宿／交通／旅遊攻略），可多選類別／移動方式、有富住宿與航班欄位、附外部小工具連結與地圖圖片；本工具是單一 Trip 樹（days→spots＋routes）。

## 決策

### 方向與同步語義

- **web 為主檔（source of truth），取代式匯入**（Replace Import）。匯入時整趟 Trip 新建或整個取代，**不做逐列比對合併、不維護跨系統穩定 ID**。理由見 [[0003-state-undo-redo]]：狀態單向、匯入即 `importState`（清空 history）。
- 明確**不做**雙向合併／增量同步／衝突解。

### 雙軌格式分工（見 CONTEXT.md「交換格式」）

- **Markdown**：給人看，且供本工具 **web↔web 無損來回**（可完整解析回 Trip，含座標等 Notion 沒有的欄位）。
- **CSV**：對齊 Notion「行程」資料庫欄位，供與 Notion database 互通。**從 Notion 匯入行程列靠解析 CSV**。

### 對映規則

- **交通段獨立成列（Leg Row）**，鏡像 Notion：以「移動方式」欄非空判定為 route 列（備用：Details 為 `"A - B"`）；其餘為 spot 列。
- **時間取時長不取時刻**：匯入讀停留／交通時長；當天第一列的時刻只用來推算 `day.startTime`。（Notion 時間為英文時長字串，需解析 `hrs`/`mins`。）
- **座標存進 CSV 的 `緯度`／`經度` 欄**；Notion 沒有座標 → 匯入後這兩欄為空，位置只剩 maps 連結（落入 `resolvedAddress`／notes）。
- **多值降為單值**：Notion 類別／移動方式若多選，取第一個映射我們的 enum，其餘塞該列 notes。
- **CSV 身分靠欄位簽名判定**，忽略檔名與語言：行程認「Details＋移動方式/類別」、住宿認「Name＋入住→退房＋付款/花費」、航班認「航空公司＋機場＋飛行時間」。容忍改名／英文／多視圖。

### 類別／移動方式對映

- 類別：早餐/午餐/晚餐→`food`、景點參觀→`sightseeing`、逛街/購物→`shopping`、自由活動→`activity`、住宿→`hotel`、交通→`transit`，其餘→`other`／未分類。
- 移動方式：步行→`walking`；JR/地鐵/公車/新幹線/觀光船→`transit`；包車/計程車/自駕→`driving`；飛機→`transit`＋原文入 notes（航班另存 Flight 側記錄，見 [[0008-notion-zip-packaging-and-data-model]]）。

### 放不下的內容

匯入時模型放不下的內容（外部 widget 連結、地圖 PNG、溢出文字）→ **匯入行程級 `notes`，並顯示一份「哪些內容未能完整匯入」報告**。不靜默丟失。

## 取捨

拒絕「雙向合併／穩定 ID 同步」（複雜度高、與單向狀態模型衝突、非需求）；拒絕「只用 Markdown 單軌」（無法對齊 Notion database，也無法無損保存座標）；拒絕「靠檔名前綴辨識 CSV」（Notion 檔名帶 hash 且中文，改名或換語言即失效）。

[[0003-state-undo-redo]] [[0008-notion-zip-packaging-and-data-model]]
