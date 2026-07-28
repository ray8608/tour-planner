<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-29 | Updated: 2026-05-29 -->

# docs/superpowers/plans

## Purpose
功能實作計畫文件（Implementation Plans）。每份文件對應一個功能，描述具體的程式碼修改步驟、受影響的函數/變數、驗收條件。由 Superpowers 工作流程根據 spec 文件產生，作為 AI Agent 執行實作的操作指引。

## Key Files

| File | Description |
|------|-------------|
| `2026-05-20-travel-planner.md` | 初版旅遊行程規劃工具整體實作計畫（37KB，完整功能） |
| `2026-05-22-cloud-sharing.md` | 雲端共用功能實作計畫 |
| `2026-05-27-overwrite-shared-trip.md` | 覆蓋已分享行程功能實作計畫 |
| `2026-05-27-private-trips.md` | 非公開行程（暗號分組）實作計畫 |
| `2026-05-27-share-modal-position-fix.md` | 分享 Modal 位置修正實作計畫 |

## For AI Agents

### Working In This Directory
- plan 文件是實作的主要參考依據，描述具體需修改哪些函數與程式碼片段
- 所有實際修改都在 `tour-planner.html`，plan 文件本身不含可執行程式碼
- 執行 plan 前先核對對應的 spec（`../specs/` 同名 `-design` 文件），確認設計意圖

### Common Patterns
- 每份 plan 通常包含：前置條件、實作步驟（含程式碼片段）、驗收測試方式
- 對應的 spec 文件在 `../specs/` 中，以相同日期前綴 + 功能名稱 + `-design` 命名

<!-- MANUAL: -->
