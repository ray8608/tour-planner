# Superuser Admin: 全覽非公開行程 & 無密碼刪除

**Date:** 2026-05-29  
**Branch:** private-trips-feature

## 背景

應用程式已有超級模式機制（密碼 `6666`，以 `localStorage` 標記），但超級模式目前僅在說明頁顯示「★ 超級模式」標籤，未賦予任何額外操作權限。

本次新增兩項超級模式專屬能力：
1. 在共用面板的「非公開」分頁，不需輸入暗號即可瀏覽所有非公開行程
2. 在管理對話框刪除任何行程時，可留空密碼直接刪除

## 功能規格

### 1. 非公開分頁全覽

**觸發條件：** `isSuperUser() === true` 且切換至「非公開」分頁

**行為變更：**
- 隱藏暗號輸入欄與查詢按鈕
- 改顯示「★ 超級模式全覽」文字標籤
- 自動呼叫 `fetchAllPrivateTrips()`，載入 Firestore 中所有 `visibility === 'private'` 的文件
- 以 `shareState.privateCodeQueried === '__SUPERUSER__'` 作為已載入狀態的識別標記

**新增 Firebase 函式：**
```js
async function fetchAllPrivateTrips() {
  const db = getFirestore();
  if (!db) return [];
  const snap = await db.collection('shared_trips')
    .where('visibility', '==', 'private')
    .orderBy('uploadedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
```

### 2. 刪除對話框無密碼模式

**觸發條件：** `isSuperUser() === true` 且 `shareState.dialog === 'delete'`

**行為變更：**
- 密碼欄保留（讓使用者仍可輸入密碼走正常流程）
- 欄位下方新增提示文字：`★ 超級模式：可留空直接刪除`
- 確認刪除邏輯：
  - 有輸入密碼 → 原有 SHA-256 hash 驗證
  - 密碼留空且 `isSuperUser()` → 呼叫 `deleteSharedTripAsAdmin(docId)`

**新增 Firebase 函式：**
```js
async function deleteSharedTripAsAdmin(docId) {
  const db = getFirestore();
  if (!db) throw new Error('Firebase 未設定');
  await db.collection('shared_trips').doc(docId).delete();
}
```

## 變更範圍

| 位置 | 變更類型 |
|------|---------|
| `fetchAllPrivateTrips()` | 新增 Firebase 函式 |
| `deleteSharedTripAsAdmin(docId)` | 新增 Firebase 函式 |
| `renderPrivateTabBody()` | 條件渲染：超級模式時隱藏搜尋欄、顯示全覽標籤 |
| 刪除對話框 HTML（`renderShareOverlay` 內） | 超級模式時加提示文字 |
| `confirm-delete` 事件處理 | 留空密碼 + 超級模式 → bypass |
| `switch-share-tab` / `open-share-panel` | 切到非公開分頁且超級模式時自動載入 |

## 不在範圍內

- 公開行程不受影響（仍需密碼刪除，除非超級模式留空）
- 覆蓋（overwrite）流程不變，仍需密碼
- 超級模式的啟用/停用機制不變
