# 重建計畫：多檔 ES Modules 旅遊行程規劃工具

依 `docs/functional-spec.md` 與 `docs/adr/` 重頭重建，沿用既有 repo `ray8608/tour-planner`。

## 決策摘要（見 docs/adr/）

| # | 決策 |
|---|------|
| 0001 | 多檔 ES Modules、零建置 |
| 0002 | innerHTML 全量重繪 + escapeHtml + CSS 切版面 |
| 0003 | structuredClone 快照式 undo/redo（50 步） |
| 0004 | 內建共用 Firebase + 盡力而為前端安全 + Firestore Rules |
| 0005 | 零建置只約束部署產物；純邏輯用 Vitest（dev-only） |
| 0006 | 公開 repo、Pages 由 main 根目錄服務、CI 只跑測試 |

## Git 策略

`main` 歷史完整保留。以新 commit 刪除舊 `tour-planner.html`、加入多檔結構（非破壞、無 force push）。

## P0 — 專案骨架（尚未執行）

- [ ] `.gitignore` 補上 `node_modules/`、Firebase 本機檔
- [ ] `.nojekyll`
- [ ] `package.json`（Vitest devDep）+ `vitest.config`
- [ ] `index.html` 入口 + `css/`（tokens/layout/components）+ `js/` 空模組骨架
- [ ] `firestore.rules`
- [ ] `.github/workflows`：只跑 Vitest

## P1 — 核心規劃（首個可上線版本）

- [ ] state.js：state 結構、setState、saveTrips/loadTrips、undo/redo
- [ ] 天／景點／路線的新增/刪除/編輯
- [ ] timeline.js：computeTimeline、computeDayStats（含跨午夜）
- [ ] render/：day、spot、route；事件委派（app.js）
- [ ] 一種版面（A）+ 主題（預設）
- [ ] localStorage 持久化 + migrateState
- [ ] 單測：timeline、stats、migrate、escapeHtml、routeKey

## P2 — 地理編碼 + 天氣

- [ ] geocoding.js（Nominatim + Photon fallback、限速）
- [ ] weather.js（Open-Meteo、模型自動選擇、快取）+ 天氣徽章

## P3 — 自動填入 + 三版面

- [ ] routing.js（OSRM；Google Directions 選填）+ 自動填入對話框
- [ ] 版面 B/C + RWD + 行動版底部快捷列
- [ ] 主題 4 種 + 字體大小

## P4 — 匯出

- [ ] export.js：JSON / ICS / KML / CSV + 座標管理對話框

## P5 — Firebase 共用 + 拖曳

- [x] firebase.js：上傳/匯入/私人/覆寫/刪除/URL 匯入 + superuser（UI）
      （services/firebase.js 傳輸層 + share.js UI 面板；firestore.rules 對齊 shared_trips）
- [x] drag.js：桌機 HTML5 DnD + 行動觸控拖曳（純變更在 spot-move.js，含單測）
- [x] 多行程管理（trips.js + state 容器 + 行程選單 UI 接線）

## 驗證原則

每階段結束：對應單測通過、由獨立 pass 做 code review、可在本機 HTTP server 手動驗證後才進下一階段。
