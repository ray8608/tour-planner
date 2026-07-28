# ADR-0001：採用多檔 ES Modules 架構、零建置

**日期**：2026-07-27
**狀態**：accepted

## 背景

本專案是在既有 repo（`ray8608/tour-planner`）上，依 `docs/functional-spec.md` **重頭重建**。上一代實作是單一 `tour-planner.html`（約 4667 行）。規格原案主張「單一 HTML 檔、零建置、可 `file://` 雙擊開啟」。

## 決策

改採**多檔 ES Modules** 架構，透過 `<script type="module">` 原生載入，**維持零建置流程**（GitHub Pages 原生支援 ES modules）：

```
index.html              # 入口，僅載入模組
css/  tokens.css, layout.css, components.css
js/   app.js（初始化、事件委派）
      state.js（狀態、undo/redo）
      render/（index, day, spot, route）
      timeline.js, geocoding.js, weather.js, routing.js,
      export.js, firebase.js, drag.js, utils.js
```

## 理由

1. 可維護性：每檔 200–500 行，遠優於 4667 行單檔。
2. 關注點分離、測試友善（純邏輯模組可獨立單測，見 ADR-0005）。
3. 保留零建置：`git push` 即部署，不引入 bundler。

## 取捨

- 需 HTTP server / GitHub Pages 提供，**不支援 `file://` 雙擊直開**（可接受，見 ADR-0006）。
- 拒絕 Vite/Webpack 方案：會新增 build 步驟與 CI，違反「零建置」原則。

[[0002-rendering-strategy]] [[0006-github-pages-deployment]]
