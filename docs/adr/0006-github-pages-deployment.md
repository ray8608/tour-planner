# ADR-0006：公開 repo，GitHub Pages 由 main 根目錄服務

**日期**：2026-07-27
**狀態**：accepted

## 背景

沿用既有遠端 `ray8608/tour-planner` 重建。目標是「透過 GitHub 架設網站」。

## 決策

- **公開 repo**：GitHub Pages 免費；Firebase web config 公開可見（可接受，見 ADR-0004）；任何人可 fork 自行部署。
- **Pages 來源**：`main` 分支**根目錄**直接服務，加入 `.nojekyll`（避免 Jekyll 處理 `_` 開頭資源）。
- `node_modules/` 列入 `.gitignore`，不會被部署；`package.json` 與 `tests/` 留在 repo 根，雖可被抓取但無害（見 ADR-0005）。
- **CI**：GitHub Actions 只跑 Vitest，**不做 build**（`git push` 即部署）。

## 取捨

拒絕「app 放 /docs 子目錄」與「gh-pages 分支 + Action 部署」：前者讓 app 住在 docs/ 稍不直覺，後者多一道 Action、不再是單純 push 即部署。既有 `main` 歷史完整保留，以新 commit 刪除舊 `tour-planner.html`、加入多檔結構（非破壞、無 force push）。

[[0001-multi-file-es-modules]] [[0004-firebase-and-security]]
