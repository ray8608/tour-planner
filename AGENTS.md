<!-- Generated: 2026-05-29 | Updated: 2026-05-29 -->

# tour-planner

## Purpose
純瀏覽器旅遊行程規劃工具。無框架、無建置流程，直接用瀏覽器開啟 `tour-planner.html` 即可使用。支援多天行程管理、景點時間軸計算、拖曳排序，以及 Firebase Firestore 雲端共用功能。所有程式碼集中於單一 HTML 檔案。

## Key Files

| File | Description |
|------|-------------|
| `tour-planner.html` | 應用程式本體（2500+ 行），包含全部 CSS、Firebase SDK 引用、及 JavaScript 邏輯 |
| `CLAUDE.md` | 專案架構說明與 AI 開發指引 |
| `README.md` | 使用者功能說明與開發指引 |
| `Image.jpeg` | 專案截圖或示意圖 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `docs/` | 功能規格與實作計畫文件（見 `docs/AGENTS.md`） |

## For AI Agents

### Working In This Directory
- **所有程式碼都在 `tour-planner.html`**，不需要也不應建立其他 `.js`、`.css` 檔案
- 修改後直接用瀏覽器開啟 `tour-planner.html` 驗證，或透過 `python3 -m http.server 8080` 啟動靜態伺服器
- 新增功能時須同步更新：`README.md` 功能說明、`renderHelpOverlay()` 函數內的說明文字

### Architecture Overview
`tour-planner.html` 內部結構（由上至下）：
1. `<style>` — CSS 變數（dark/light 主題）、RWD breakpoints（600px / 480px）
2. Firebase SDK script tags（CDN，compat 版本）
3. `<script>` — 全部業務邏輯，單向資料流：`setState() → save(localStorage) → render()`

### State Management
- `state`：主要應用狀態（tripName、days、routes、settings、activeDayId）
- `shareState`：共用面板 UI 狀態（Firebase 互動相關）
- `setState(fn)`：唯一修改入口，呼叫後自動存檔並重繪
- `setShareState(obj)`：直接 Object.assign 後重繪

### Rendering Pattern
- `render()` 每次重新生成整個 `#app` innerHTML（字串拼接，非 Virtual DOM）
- 事件透過事件委派在 `#app` 層統一處理，`data-action` 識別動作，`data-*` 傳遞參數
- 三種版面：`renderLayoutA()`（頁籤式）、`renderLayoutB()`（側邊欄）、`renderLayoutC()`（垂直捲動）

### Testing Requirements
- 無自動化測試框架；手動在瀏覽器中驗證功能
- 重點測試：時間軸計算、拖曳排序、Firebase 雲端上傳/下載、三種版面切換、RWD 響應式

### Common Patterns
- 路線 key：`routeKey(fromId, toId)` 生成 `"spotId→spotId"`
- 飯店 pseudo-id：出發 `hs_{dayId}`、返回 `he_{dayId}`
- 時間軸：`computeTimeline(day)` 累加計算，結果存入 `slots` object
- 密碼安全：Web Crypto API SHA-256 hash，明文不落地

## Dependencies

### Internal
- `localStorage` key：`travel-planner-v1`（行程資料）、`travel-planner-imported-doc-id`（最後匯入的雲端 docId）

### External
- Firebase App Compat SDK（CDN）
- Firebase Firestore Compat SDK（CDN）
- collection：`shared_trips`

<!-- MANUAL: -->
