# ADR-0004：內建共用 Firebase + 盡力而為的前端安全模型

**日期**：2026-07-27
**狀態**：accepted

## 背景

公開 repo（見 ADR-0006）+ 公開 GitHub Pages 靜態站。應用內建雲端共用（Firestore），並整合 Google Maps（使用者自備 key）、OSRM/Nominatim/Open-Meteo（免費、免 key）。

**安全真相**：公開站 + 公開 config，任何人都能從瀏覽器 console 直接呼叫 Firestore。沒有 Firebase Auth，Security Rules **無法**在伺服器端驗證「此人知道刪除密碼」。

## 決策

### Firebase config

內建**一個共用 Firebase 專案**，真實 config 直接寫進程式碼並 commit（Firebase web config 依設計本非機密；不使用 `.gitignore`，否則 Pages 部署會缺檔）。`projectId` 為空時整個雲端功能停用。

### 安全模型

- **保留規格的前端密碼模型**（刪除密碼、私人分享碼皆前端 SHA-256 比對），因為它支援「跨裝置管理」這個產品需求。
- 明碼永不儲存，只存 hash。
- 搭配 **Firestore Security Rules**（`firestore.rules`）做濾用限制：文件大小上限、必要欄位驗證、擋明顯濫用。**防意外、不防駭客**。
- `superuser`（密碼 `6666`）**降為純 UI 便利**，不視為真正權限邊界。
- 文件與 README 必須明確標註：雲端共用是**盡力而為、非加密級安全**，勿存放敏感資料。

## 取捨

拒絕「Anonymous Auth + owner-based rules」（雖能真正伺服器端保護，但會破壞跨裝置密碼管理、需改共用流程）；拒絕「v1 只讀共用」（功能大幅縮水）。

[[0006-github-pages-deployment]]
