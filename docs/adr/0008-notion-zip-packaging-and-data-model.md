# ADR-0008：多檔 ZIP 打包與資料模型擴充

**日期**：2026-07-28
**狀態**：accepted

## 背景

延續 [[0007-notion-interchange-and-replace-import]]。Notion 匯出是多檔資料夾，且含本工具目前沒有的欄位／資料庫：營業時間、圖片 URL、待辦清單、富住宿資料、航班、旅遊攻略頁。使用者決定**全部採用**，以達成 web↔Notion 雙向對齊。這牽動打包格式與 Trip 資料模型。

本專案的硬約束：零建置、無 npm runtime 依賴、直接瀏覽器開啟（見 [[0005-zero-build-boundary-and-testing]]）。

## 決策

### 打包：單一 ZIP，鏡像 Notion 資料夾結構

- 匯出／匯入以**單個 ZIP** 為載體，內部鏡像 Notion 的多檔資料夾（頂層 md ＋ 每庫一份 CSV ＋ 每列子頁 md）。
- **Store-only（不壓縮）、零依賴**：自行以純 JS 組 ZIP（store 模式僅需 CRC32＋local header＋central directory），不引入 JSZip 等 runtime 依賴，維持零建置邊界。
- 匯入接受該 ZIP；容忍 Notion 原始匯出 ZIP（檔名帶 hash、資料夾巢狀、URL-encoded 連結）。

### 資料模型擴充（新增 Trip 層級欄位）

新增為**獨立側記錄**，不自動注入時間軸、彼此不連結（見 CONTEXT.md）：

- `spot.openingHours`（string）、`spot.imageUrl`（string）——擴充現有 spot。
- `trip.todos[]`：`{ id, text, done }` —— 對應 Notion 頂層「待辦事項」。
- `trip.accommodations[]`：`{ id, name, type, address, checkIn, checkOut, city, cost, paymentStatus, bookingUrl, imageUrl }`。
- `trip.flights[]`：`{ id, airline, flightNo, cabin, fromAirport, departTime, toAirport, arriveTime, duration, domestic }`。
- `trip.guides[]`：`{ id, title, body }`（body 為 Markdown）——對應 Notion「旅遊攻略」子頁。
- `trip.notes`（string）：匯入時放不下內容的落腳處（見 ADR-0007）。

### 遷移

- `defaultState()` version bump；`migrateState(raw)` 為舊資料補齊上述欄位（`todos`/`accommodations`/`flights`/`guides` 預設 `[]`，`notes`/`openingHours`/`imageUrl` 預設 `""`）。
- 這些為附加欄位，不改動既有 days/spots/routes 結構，向後相容。

## 取捨

拒絕「引入 JSZip」（違反零依賴邊界；store-only 手寫足夠）；拒絕「多檔分開下載」（與 Notion 資料夾不對齊、匯入體驗差）；拒絕「把住宿／航班注入時間軸」（使用者選獨立側記錄，避免與每天 `startHotelName`/`endHotelName` 及 route 計算糾纏）。

[[0007-notion-interchange-and-replace-import]] [[0005-zero-build-boundary-and-testing]]
