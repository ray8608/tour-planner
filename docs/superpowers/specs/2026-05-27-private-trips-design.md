# 共用區公開／非公開設計文件

**日期：** 2026-05-27
**狀態：** 已確認

---

## 概述

在現有共用區（Firebase Firestore `shared_trips`）加入公開／非公開分類。公開行程維持現有行為；非公開行程需輸入「暗號」才能查詢，同一暗號可對應多筆行程（群組概念）。

---

## 資料模型

在現有 `shared_trips` 文件新增兩個欄位：

| 欄位 | 型別 | 說明 |
|---|---|---|
| `visibility` | `'public' \| 'private'` | 公開設定；舊文件無此欄位視為 `'public'` |
| `secretCodeHash` | `string \| null` | 暗號的 SHA-256 hash；公開行程為 `null` |

現有欄位不變：`tripName`, `uploadedAt`, `data`, `deletePasswordHash`。

### Firestore Composite Index（需手動建立）

1. Collection: `shared_trips`，欄位：`visibility ASC, uploadedAt DESC`
2. Collection: `shared_trips`，欄位：`secretCodeHash ASC, uploadedAt DESC`

---

## Firebase 函數

### 一次性 Migration（首次執行）

Firestore 查詢無法匹配「欄位不存在」的文件，因此需要在首次執行時為舊資料補上欄位：

```js
async function migrateExistingTrips() {
  const db = getFirestore();
  if (!db) return;
  // 查出沒有 visibility 欄位的舊文件（以 secretCodeHash 不存在代替）
  const snap = await db.collection('shared_trips').get();
  const batch = db.batch();
  snap.docs.forEach(doc => {
    if (doc.data().visibility === undefined) {
      batch.update(doc.ref, { visibility: 'public', secretCodeHash: null });
    }
  });
  await batch.commit();
}
```

在 `init()` 啟動時呼叫一次（可加 localStorage flag 避免每次都跑）。

### 新增 `fetchPublicTrips()`

```js
async function fetchPublicTrips() {
  const db = getFirestore();
  if (!db) return [];
  const snap = await db.collection('shared_trips')
    .where('visibility', '==', 'public')
    .orderBy('uploadedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
```

### 新增 `fetchPrivateTrips(code)`

```js
async function fetchPrivateTrips(code) {
  const db = getFirestore();
  if (!db) return [];
  const hash = await sha256(code);
  const snap = await db.collection('shared_trips')
    .where('secretCodeHash', '==', hash)
    .orderBy('uploadedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // 回傳空陣列 → UI 顯示「暗號不存在」
}
```

### 修改 `uploadTripToCloud(password, visibility, secretCode)`

```js
async function uploadTripToCloud(password, visibility = 'public', secretCode = null) {
  const db = getFirestore();
  if (!db) throw new Error('Firebase 未設定');
  const hash = await sha256(password);
  const secretCodeHash = (visibility === 'private' && secretCode)
    ? await sha256(secretCode) : null;
  await db.collection('shared_trips').add({
    tripName: state.tripName,
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    data: state,
    deletePasswordHash: hash,
    visibility,
    secretCodeHash,
  });
}
```

`deleteSharedTrip()`、`updateTripInCloud()`、`getSharedTripData()` 不需修改。

---

## UI 變化

### 共用面板結構

```
┌─────────────────────────────┐
│  ☁️ 共用區              [✕] │  ← 現有 header（不變）
├─────────────────────────────┤
│   公開   │   非公開          │  ← 新增分頁列
├─────────────────────────────┤
│  [公開分頁內容]               │  ← 切換後顯示對應內容
└─────────────────────────────┘
```

**公開分頁**：與現有行為完全相同（上傳按鈕 + 行程列表）。

**非公開分頁**：

```
┌─────────────────────────────┐
│  [暗號輸入框]      [查詢]    │  ← 常駐搜尋列（B方案）
├─────────────────────────────┤
│  ↑ 上傳目前行程              │  ← 永遠顯示（點擊時預填暗號）
│                             │
│  [未查詢]  輸入暗號後按查詢   │  ← 首次進入分頁時的提示文字
│  [有結果]  行程列表          │  ← 查詢成功顯示列表
│  [空結果]  暗號不存在        │  ← 查詢成功但無匹配行程
└─────────────────────────────┘
```

- 首次進入非公開分頁（`privateCodeQueried === null`）：顯示「輸入暗號後按查詢」提示，不顯示列表。
- 上傳按鈕永遠顯示；點擊時上傳 dialog 預設選「非公開」，並將搜尋列的暗號預填至 dialog 暗號欄位（若搜尋列有值）。
- 查詢回傳空陣列顯示「暗號不存在」。

### 上傳對話框（修改）

```
┌─────────────────────────────┐
│  上傳行程                   │
│                             │
│  公開設定                   │
│  [ 公開 ]  [ 非公開 ]       │  ← 新增切換（預設公開）
│                             │
│  暗號（必填）               │  ← 僅選非公開時出現
│  [________________]         │
│                             │
│  刪除密碼（必填）            │  ← 原有欄位
│  [________________]         │
│                             │
│        [取消]  [上傳]       │
└─────────────────────────────┘
```

---

## State 管理

`shareState` 新增欄位：

```js
shareTab: 'public',            // 'public' | 'private'，預設公開
privateCodeInput: '',          // 非公開分頁暗號輸入框即時值
privateCodeQueried: null,      // 最後一次查詢的暗號，null 表示未查詢
uploadVisibility: 'public',    // 上傳 dialog 選擇的公開設定
uploadSecretCode: '',          // 上傳 dialog 的暗號輸入
```

---

## 錯誤處理與邊界情境

| 情境 | 處理方式 |
|---|---|
| 私有查詢回傳空陣列 | 顯示「暗號不存在」 |
| 暗號欄位空白就按查詢 | 顯示「請輸入暗號」，不發出查詢 |
| 上傳選「非公開」但暗號欄位空白 | 顯示「請輸入暗號」，阻止上傳 |
| 既有舊資料（無 `visibility` 欄位） | 啟動時執行 `migrateExistingTrips()` 補上 `visibility: 'public'` |
| Firebase 查詢失敗 | 沿用現有 `error` 狀態顯示 `⚠️ 錯誤訊息` |
| 切換公開／非公開分頁 | 清除對方分頁錯誤狀態，不自動重新載入 |
| 暗號為純空白字元 | trim 後判斷，視為空白 |

---

## 安全性說明

- 暗號以 SHA-256 hash 儲存於 Firestore，不儲存明文。
- 查詢時由前端計算 hash 後送出，Firestore 只存 hash。
- 非公開行程不出現在公開分頁的查詢結果中。
- 注意：這是 security-through-obscurity，知道暗號的任何人都能看到群組內所有行程。刪除／覆蓋仍需個別的刪除密碼保護。
