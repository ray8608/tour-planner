<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-29 | Updated: 2026-05-29 -->

# docs/superpowers

## Purpose
透過 Superpowers 工作流程（brainstorming → spec → plan）產生的文件集合。每個功能對應一份設計規格（`specs/`）與一份實作計畫（`plans/`），兩者以相同日期前綴和功能名稱對應。

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `specs/` | 功能設計規格文件，描述 UI/UX 決策、資料結構與行為定義（見 `specs/AGENTS.md`） |
| `plans/` | 功能實作計畫文件，描述具體開發步驟與驗收條件（見 `plans/AGENTS.md`） |

## For AI Agents

### Working In This Directory
- spec 文件先行：實作前先確認 `specs/` 是否有對應的設計文件
- plan 文件可直接作為實作指引，描述具體的程式碼修改步驟
- 同一功能的 spec 與 plan 以相同的日期前綴 + 功能名稱對應（design 後綴區分）

### Common Patterns
- spec 命名：`YYYY-MM-DD-feature-name-design.md`
- plan 命名：`YYYY-MM-DD-feature-name.md`

<!-- MANUAL: -->
