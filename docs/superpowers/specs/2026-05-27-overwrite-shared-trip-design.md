# 覆蓋共用行程 設計文件

**日期**: 2026-05-27
**相關檔案**: `tour-planner.html`

## 問題描述

目前若要更新雲端的某個共用行程，使用者必須先匯入該行程、修改、再重新上傳（產生新記錄）、再刪除舊記錄——步驟繁瑣。

使用者希望能直接在共用清單中選擇「覆蓋某個既有行程」，以目前編輯器的內容取代它。

## 使用情境

1. 匯入 A 行程後修改，想把修改結果覆蓋到 B 行程（不是 A）
2. 使用目前編輯器中的新行程，直接覆蓋 A 行程（清空/取代）

## 設計方案

### UI 變更：share-trip-item 加「↑ 覆蓋」按鈕

**修改前：** `[匯入] [🗑]`
**修改後：** `[匯入] [↑覆蓋] [🗑]`

每個共用行程項目在「匯入」和「🗑」之間加入一個「↑覆蓋」按鈕（`data-action="open-overwrite-dialog"`），樣式沿用 `btn-ghost`。

### Overwrite Dialog

點擊「↑覆蓋」後，彈出 `share-dialog`，`dialog` 狀態為 `'overwrite'`。

**名稱相同時**（`state.tripName === overwriteTargetName`）：

```
覆蓋行程

輸入刪除密碼：[___________]
[錯誤訊息區（紅字，可為空）]

[取消]  [覆蓋]
```

**名稱不同時**（`state.tripName !== overwriteTargetName`）：

```
覆蓋行程

目前行程：{state.tripName}
雲端行程：{overwriteTargetName}

☑ 一併將雲端名稱更新為「{state.tripName}」   ← 預設勾選

輸入刪除密碼：[___________]
[錯誤訊息區（紅字，可為空）]

[取消]  [覆蓋]
```

密碼錯誤時顯示紅字訊息，與現有刪除 dialog 行為一致。

### shareState 新增欄位

```javascript
overwriteTargetId: null,    // 被覆蓋的 Firestore docId
overwriteTargetName: null,  // 雲端行程的原始名稱（用於名稱比對與顯示）
overwriteUpdateName: true,  // 名稱不同時是否一併更新（checkbox 狀態，預設 true）
overwriteError: null,       // 覆蓋錯誤訊息
```

`setShareState` 初始化與重置時需清除以上欄位。

### 新增事件動作

| action | 觸發來源 | 行為 |
|--------|---------|------|
| `open-overwrite-dialog` | 點擊「↑覆蓋」按鈕（`data-trip-id`、`data-trip-name`） | 設定 `dialog: 'overwrite'`、`overwriteTargetId`、`overwriteTargetName`、`overwriteUpdateName: true`、`overwriteError: null` |
| `toggle-overwrite-name` | 點擊 checkbox | 切換 `overwriteUpdateName` 布林值並重新渲染 |
| `confirm-overwrite` | 點擊「覆蓋」按鈕（`data-trip-id`） | 驗證密碼後呼叫 `updateTripInCloud`，成功後關閉 dialog 並重新載入清單 |

`close-share-dialog` 已存在，但需更新：在現有的 `deleteError: null, uploadError: null` 基礎上，加入 `overwriteError: null` 一併清除。

### updateTripInCloud 函式調整

現有函式固定使用 `state.tripName`，需加一個可選參數：

```javascript
// 修改前
async function updateTripInCloud(docId, password) {
  ...
  await db.collection('shared_trips').doc(docId).update({
    tripName: state.tripName,
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    data: state,
  });
}

// 修改後（新增 tripName 參數，預設為 state.tripName）
async function updateTripInCloud(docId, password, tripName = state.tripName) {
  ...
  await db.collection('shared_trips').doc(docId).update({
    tripName: tripName,
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    data: state,
  });
}
```

### confirm-overwrite 邏輯

```javascript
if (action === 'confirm-overwrite') {
  const docId = el.dataset.tripId;
  const pw = document.getElementById('share-overwrite-pw')?.value?.trim();
  if (!pw) { setShareState({ overwriteError: '請輸入刪除密碼' }); return; }

  const nameToSave = shareState.overwriteUpdateName
    ? state.tripName                   // 更新為編輯器名稱
    : shareState.overwriteTargetName;  // 保留雲端原始名稱

  updateTripInCloud(docId, pw, nameToSave)
    .then(() => {
      setShareState({ dialog: null, overwriteError: null, loading: true, list: [] });
      return loadSharedTrips();
    })
    .catch(err => setShareState({ overwriteError: err.message || '覆蓋失敗' }));
  return;
}
```

### share-trip-item HTML 範本調整

```html
<!-- 加入 data-trip-name 屬性讓 open-overwrite-dialog 能取得原始名稱 -->
<button class="btn-ghost" data-action="open-overwrite-dialog"
  data-trip-id="${escHtml(trip.id)}"
  data-trip-name="${escHtml(trip.tripName)}" title="覆蓋">↑</button>
```

## 不在本次範圍內

- 覆蓋後不改變原有 docId（外部分享連結不受影響）
- 密碼修改功能
- 覆蓋後不通知其他可能持有相同連結的使用者
