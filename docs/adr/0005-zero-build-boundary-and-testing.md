# ADR-0005：零建置邊界 + 純邏輯以 Vitest 單測

**日期**：2026-07-27
**狀態**：accepted

## 背景

全域規範要求 80% 測試覆蓋 + TDD，但「零建置 vanilla JS」本身沒有測試框架。兩者需調和。

## 決策

**「零建置」只約束「部署產物」，不約束開發端。** 開發端可有 `package.json`、`node_modules`、測試工具；部署到 Pages 的檔案（`index.html`、`css/`、`js/`）維持原生 ES modules、無打包。

以 **Vitest（dev 依賴，僅本機/CI 執行）** 對純函式模組寫單元測試，優先覆蓋高風險數學/轉換邏輯：

- `computeTimeline` / `computeDayStats`（含跨午夜）
- `migrateState`（舊版資料遷移）
- `escapeHtml`
- route key 組合（`fromId→toId`，Unicode U+2192）
- 天氣模型自動選擇（依 countryCode）

## 理由

純邏輯模組是最可測、最高價值的部分；DOM/render 為 `innerHTML` 字串、單測脆弱且成本高，暫不納入自動化覆蓋。部署產物零改變，邏輯有回歸保護。

[[0001-multi-file-es-modules]]
