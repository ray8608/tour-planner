<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-29 | Updated: 2026-05-29 -->

# docs/superpowers/specs

## Purpose
功能設計規格文件（Design Specs）。每份文件描述一個功能的 UI/UX 設計決策、資料結構定義、元件行為規範，是實作前的藍圖。由 Superpowers brainstorming 工作流程產生。

## Key Files

| File | Description |
|------|-------------|
| `2026-05-20-travel-planner-design.md` | 初版旅遊行程規劃工具整體設計 |
| `2026-05-22-cloud-sharing-design.md` | 雲端共用功能（Firebase Firestore）設計規格 |
| `2026-05-27-overwrite-shared-trip-design.md` | 覆蓋已分享行程功能的設計規格 |
| `2026-05-27-private-trips-design.md` | 非公開行程（暗號分組）功能設計規格 |
| `2026-05-27-share-modal-position-fix-design.md` | 分享 Modal 位置修正設計規格 |
| `2026-05-28-manage-button-design.md` | 行程管理按鈕（更換密碼/刪除）設計規格 |
| `2026-05-28-share-link-button-design.md` | 分享連結按鈕設計規格 |
| `2026-05-29-layout-b-mobile-day-picker-design.md` | Layout B 手機版日期選擇器設計規格 |
| `2026-05-29-superuser-admin-trips-design.md` | 超級使用者管理所有行程功能設計規格 |

## For AI Agents

### Working In This Directory
- 實作新功能前先閱讀對應的 design 文件，了解預期行為與邊界條件
- spec 文件為不可執行的純文件，不要在此目錄加入程式碼
- 若實作結果與 spec 有所偏差，以實際程式碼為準（spec 可能因實作中調整而略有差異）

### Common Patterns
- 每份 spec 通常包含：功能概述、UI 設計、資料結構、互動流程、邊界條件
- 對應的 plan 文件在 `../plans/` 中，以相同日期前綴 + 功能名稱（不含 `-design`）命名

<!-- MANUAL: -->
