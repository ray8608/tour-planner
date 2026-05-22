# Cloud Sharing Feature Design

**Date:** 2026-05-22
**Project:** tour-planner.html
**Feature:** 共用區 — 上傳、瀏覽、匯入行程紀錄

---

## Overview

在現有的匯出/匯入功能基礎上，新增一個「共用區」，讓使用者可以把行程上傳到 Firebase Firestore，供其他人瀏覽並匯入。列表完全開放，密碼只保護刪除操作。

---

## Architecture

純前端架構，不需要自架後端：

```
瀏覽器 (tour-planner.html)
  ├── 現有功能（不變）
  │     localStorage ↔ 本地行程資料
  │
  └── 新增：共用區
        Firebase JS SDK (CDN, modular v10+)
          └── Firestore
                └── Collection: shared_trips
                      每筆 document = 一個上傳的行程
```

Firebase SDK 透過 CDN `<script type="module">` 載入，不需要 npm 或 build 工具。

---

## Firestore Data Structure

**Collection:** `shared_trips`

| 欄位 | 型別 | 說明 |
|---|---|---|
| `tripName` | string | 行程名稱（from `state.tripName`） |
| `uploadedAt` | Timestamp | 上傳時間（server timestamp） |
| `data` | map | 完整的行程 state JSON |
| `deletePasswordHash` | string | SHA-256(刪除密碼)，hex 字串 |

**讀取方式：** `orderBy('uploadedAt', 'desc')` 取最新在前的列表。

---

## Firebase Security Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shared_trips/{tripId} {
      allow read, write: if true;
    }
  }
}
```

密碼驗證在 JavaScript 層完成（hash 比對）；Firestore 層不做密碼驗證。
開發者可透過 Firebase Console 直接刪除或修改任何記錄，擁有完整管理權限。

---

## Password Mechanism

使用瀏覽器內建的 **Web Crypto API**，不需要任何額外 library：

```js
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**上傳時：** 計算密碼 hash → 存入 Firestore document。
**刪除時：** 計算輸入密碼 hash → 與 document 的 `deletePasswordHash` 比對 → 相符才刪除。

密碼本身不離開使用者瀏覽器。

---

## UI Flow

### Header 變更
Header 右側新增「☁️ 共用」按鈕，位於現有「📥 匯入」按鈕旁邊。

### 共用區 Overlay

```
┌─────────────────────────────────────┐
│  ☁️ 共用區                      ✕  │
├─────────────────────────────────────┤
│  [↑ 上傳目前行程]                   │
├─────────────────────────────────────┤
│  📋 日本東京 5 天                   │
│     2025-05-20 上傳        [匯入] 🗑 │
│                                     │
│  📋 北海道自駕遊                    │
│     2025-05-18 上傳        [匯入] 🗑 │
└─────────────────────────────────────┘
```

- 開啟時立即從 Firestore 拉取列表，顯示 loading 狀態
- 列表依上傳時間倒序排列
- 每筆記錄顯示：行程名稱、上傳日期

### 上傳行程流程

1. 點「↑ 上傳目前行程」
2. 彈出 dialog：
   ```
   設定刪除密碼
   [____________] （必填）
   [取消] [上傳]
   ```
3. 確認後上傳 state 至 Firestore，顯示成功提示
4. 列表自動刷新

### 匯入行程流程

1. 點「匯入」
2. 彈出確認：「匯入將覆蓋目前行程，確定嗎？」
3. 確認後直接匯入（無需密碼）
4. Overlay 關閉，行程載入

### 刪除行程流程

1. 點「🗑」
2. 彈出 dialog：
   ```
   輸入刪除密碼
   [____________]
   [取消] [刪除]
   ```
3. 計算輸入密碼的 SHA-256 → 與 Firestore 中的 hash 比對
4. 比對成功 → 刪除 document，列表刷新
5. 比對失敗 → 顯示「密碼錯誤」

---

## Firebase Configuration

HTML 中需要一個 `FIREBASE_CONFIG` 區塊（由開發者填入）：

```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

這些值是 Firebase 的公開識別碼（非 secret），放在 GitHub 上安全無虞；實際存取控制由 Firestore Security Rules 管理。

---

## One-Time Firebase Setup

1. 前往 Firebase Console，建立新專案
2. 左側選 **Firestore Database** → 建立（production mode）
3. **Rules** 頁籤貼上上述 security rules
4. **專案設定** → **你的應用程式** → 新增 Web App → 複製 `firebaseConfig`
5. 將 config 填入 HTML 的 `FIREBASE_CONFIG` 區塊

---

## Error Handling

| 情境 | 處理方式 |
|---|---|
| FIREBASE_CONFIG 未填入 | 「☁️ 共用」按鈕仍顯示，點擊後顯示「共用功能尚未設定」提示 |
| 網路斷線 / Firestore 無法連線 | 顯示「無法連線，請檢查網路」，不影響本地功能 |
| 上傳失敗 | 顯示錯誤訊息，保持 dialog 開啟 |
| 刪除密碼錯誤 | 顯示「密碼錯誤」，不關閉 dialog |
| 列表載入中 | 顯示 loading 指示器 |
| 列表為空 | 顯示「目前沒有共用的行程」 |

---

## Implementation Notes

- Firebase SDK 以 `<script type="module">` 方式載入，無需 build 工具
- `shareOpen` 加入全域狀態，控制 overlay 顯示
- 共用區 overlay 不影響現有 `render()` 邏輯，獨立渲染
- 列表資料不存入 localStorage，每次開啟 overlay 都重新拉取
- 從 Firestore 匯入時需呼叫現有的 `migrateState()` 確保 schema 相容性，與本地 `importJSON()` 行為一致
