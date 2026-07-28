# 覆蓋共用行程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓使用者可以在共用清單中對任意行程點「↑ 覆蓋」，以目前編輯器的行程內容取代雲端行程，並在名稱不同時詢問是否一併更新名稱。

**Architecture:** 全部改動在 `tour-planner.html` 單一檔案。後端函式 `updateTripInCloud` 已存在，只需加 `tripName` 參數；`shareState` 加兩個新欄位；舊的 `open-update-dialog`/`confirm-update` 事件動作改名並加強為 `open-overwrite-dialog`/`confirm-overwrite`；`renderShareOverlay` 把「↑ 更新」（只對已匯入行程）改為「↑ 覆蓋」對所有行程。

**Tech Stack:** 純 HTML/CSS/JavaScript，Firebase Firestore。

---

### Task 1：`updateTripInCloud` 加 `tripName` 參數

**Files:**
- Modify: `tour-planner.html:561-573`

- [ ] **Step 1：確認目前函式**

讀取 `tour-planner.html` 第 561–573 行，確認現狀：

```javascript
async function updateTripInCloud(docId, password) {
  const db = getFirestore();
  if (!db) throw new Error('Firebase 未設定');
  const doc = await db.collection('shared_trips').doc(docId).get();
  if (!doc.exists) throw new Error('記錄不存在');
  const hash = await sha256(password);
  if (hash !== doc.data().deletePasswordHash) throw new Error('密碼錯誤');
  await db.collection('shared_trips').doc(docId).update({
    tripName: state.tripName,
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    data: state,
  });
}
```

- [ ] **Step 2：加入 `tripName` 可選參數**

將第 561 行的函式簽名和第 569 行的 `tripName` 欄位改為：

```javascript
async function updateTripInCloud(docId, password, tripName = state.tripName) {
  const db = getFirestore();
  if (!db) throw new Error('Firebase 未設定');
  const doc = await db.collection('shared_trips').doc(docId).get();
  if (!doc.exists) throw new Error('記錄不存在');
  const hash = await sha256(password);
  if (hash !== doc.data().deletePasswordHash) throw new Error('密碼錯誤');
  await db.collection('shared_trips').doc(docId).update({
    tripName: tripName,
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    data: state,
  });
}
```

只改兩處：函式簽名加 `, tripName = state.tripName`；`tripName: state.tripName` → `tripName: tripName`。

- [ ] **Step 3：Commit**

```bash
git add tour-planner.html
git commit -m "feat: add optional tripName param to updateTripInCloud"
```

---

### Task 2：`shareState` 加新欄位 + `close-share-dialog` 清除 updateError

**Files:**
- Modify: `tour-planner.html:830-835`（shareState）
- Modify: `tour-planner.html:1269-1272`（close-share-dialog handler）

- [ ] **Step 1：確認目前 shareState（第 830–835 行）**

```javascript
let shareState = {
  open: false, loading: false, list: [],
  error: null, dialog: null,
  deleteTargetId: null, deleteError: null, uploadError: null,
  importedDocId: loadImportedDocId(), updateError: null,
};
```

- [ ] **Step 2：加入兩個新欄位**

在 `updateError: null,` 之後加入 `overwriteTargetName` 和 `overwriteUpdateName`：

```javascript
let shareState = {
  open: false, loading: false, list: [],
  error: null, dialog: null,
  deleteTargetId: null, deleteError: null, uploadError: null,
  importedDocId: loadImportedDocId(), updateError: null,
  overwriteTargetName: null, overwriteUpdateName: true,
};
```

- [ ] **Step 3：確認目前 close-share-dialog handler（第 1269–1272 行）**

```javascript
if (action === 'close-share-dialog') {
  setShareState({ dialog: null, deleteError: null, uploadError: null });
  return;
}
```

- [ ] **Step 4：加入 updateError: null**

```javascript
if (action === 'close-share-dialog') {
  setShareState({ dialog: null, deleteError: null, uploadError: null, updateError: null });
  return;
}
```

- [ ] **Step 5：Commit**

```bash
git add tour-planner.html
git commit -m "feat: add overwriteTargetName/overwriteUpdateName to shareState, clear updateError on dialog close"
```

---

### Task 3：事件處理器 — `open-overwrite-dialog`、`toggle-overwrite-name`、`confirm-overwrite`

**Files:**
- Modify: `tour-planner.html:1311-1325`（替換 `open-update-dialog` / `confirm-update`）

- [ ] **Step 1：確認目前第 1311–1325 行**

```javascript
if (action === 'open-update-dialog') {
  setShareState({ dialog: 'update', deleteTargetId: el.dataset.tripId, updateError: null });
  return;
}
if (action === 'confirm-update') {
  const docId = el.dataset.tripId;
  const pw = document.getElementById('share-update-pw')?.value?.trim();
  if (!pw) { setShareState({ updateError: '請輸入密碼' }); return; }
  updateTripInCloud(docId, pw)
    .then(() => {
      setShareState({ dialog: null, updateError: null, loading: true, list: [] });
      return loadSharedTrips();
    })
    .catch(err => setShareState({ updateError: err.message || '更新失敗' }));
  return;
}
```

- [ ] **Step 2：將這兩個 if 區塊替換為三個新區塊**

```javascript
if (action === 'open-overwrite-dialog') {
  setShareState({
    dialog: 'overwrite',
    deleteTargetId: el.dataset.tripId,
    overwriteTargetName: el.dataset.tripName,
    overwriteUpdateName: true,
    updateError: null,
  });
  return;
}
if (action === 'toggle-overwrite-name') {
  setShareState({ overwriteUpdateName: !shareState.overwriteUpdateName });
  return;
}
if (action === 'confirm-overwrite') {
  const docId = el.dataset.tripId;
  const pw = document.getElementById('share-update-pw')?.value?.trim();
  if (!pw) { setShareState({ updateError: '請輸入密碼' }); return; }
  const nameToSave = shareState.overwriteUpdateName
    ? state.tripName
    : shareState.overwriteTargetName;
  updateTripInCloud(docId, pw, nameToSave)
    .then(() => {
      setShareState({ dialog: null, updateError: null, loading: true, list: [] });
      return loadSharedTrips();
    })
    .catch(err => setShareState({ updateError: err.message || '覆蓋失敗' }));
  return;
}
```

- [ ] **Step 3：手動確認**

開啟檔案，確認 `open-update-dialog` 和 `confirm-update` 字串已不存在於 event handler 區塊中（它們僅會殘存於 Task 4 尚未修改的 HTML 模板中，Task 4 會一併清除）。

- [ ] **Step 4：Commit**

```bash
git add tour-planner.html
git commit -m "feat: add open-overwrite-dialog, toggle-overwrite-name, confirm-overwrite handlers"
```

---

### Task 4：`renderShareOverlay` — 按鈕與 dialog HTML

**Files:**
- Modify: `tour-planner.html:1082-1090`（trip item 按鈕）
- Modify: `tour-planner.html:1121-1132`（update dialog → overwrite dialog）

- [ ] **Step 1：確認目前 trip item 按鈕（第 1082–1090 行）**

```javascript
return `
  <div class="share-trip-item" ${isImported ? 'style="background:var(--accent-bg);border-radius:6px;padding:10px 8px;margin-bottom:2px"' : ''}>
    <div class="share-trip-info">
      <div class="share-trip-name">📋 ${escHtml(trip.tripName)}${isImported ? ' <span style="font-size:10px;color:var(--accent)">(目前匯入)</span>' : ''}</div>
      <div class="share-trip-date">${escHtml(date)} 上傳</div>
    </div>
    ${isImported ? `<button class="btn-accent" data-action="open-update-dialog" data-trip-id="${escHtml(trip.id)}">↑ 更新</button>` : `<button class="btn-accent" data-action="import-shared-trip" data-trip-id="${escHtml(trip.id)}">匯入</button>`}
    <button class="btn-ghost" data-action="open-delete-dialog"
      data-trip-id="${escHtml(trip.id)}" title="刪除">🗑</button>
  </div>`;
```

- [ ] **Step 2：改為所有行程都顯示「↑ 覆蓋」，非匯入行程額外顯示「匯入」**

```javascript
return `
  <div class="share-trip-item" ${isImported ? 'style="background:var(--accent-bg);border-radius:6px;padding:10px 8px;margin-bottom:2px"' : ''}>
    <div class="share-trip-info">
      <div class="share-trip-name">📋 ${escHtml(trip.tripName)}${isImported ? ' <span style="font-size:10px;color:var(--accent)">(目前匯入)</span>' : ''}</div>
      <div class="share-trip-date">${escHtml(date)} 上傳</div>
    </div>
    ${!isImported ? `<button class="btn-accent" data-action="import-shared-trip" data-trip-id="${escHtml(trip.id)}">匯入</button>` : ''}
    <button class="btn-ghost" data-action="open-overwrite-dialog"
      data-trip-id="${escHtml(trip.id)}" data-trip-name="${escHtml(trip.tripName)}" title="覆蓋此行程">↑</button>
    <button class="btn-ghost" data-action="open-delete-dialog"
      data-trip-id="${escHtml(trip.id)}" title="刪除">🗑</button>
  </div>`;
```

重點改動：
1. `${isImported ? '...' : '匯入按鈕'}` → `${!isImported ? '匯入按鈕' : ''}` + 單獨一行「↑ 覆蓋」按鈕
2. 覆蓋按鈕加 `data-trip-name="${escHtml(trip.tripName)}"` 供 `open-overwrite-dialog` 讀取名稱

- [ ] **Step 3：確認目前 update dialog（第 1121–1132 行）**

```javascript
} else if (shareState.dialog === 'update') {
  dialogHtml = `
    <div class="share-dialog">
      <div class="share-dialog-title">覆蓋更新行程</div>
      <input type="password" id="share-update-pw" placeholder="輸入當初設定的密碼" autocomplete="current-password">
      <div class="share-error">${shareState.updateError ? escHtml(shareState.updateError) : ''}</div>
      <div class="share-dialog-actions">
        <button class="btn" data-action="close-share-dialog">取消</button>
        <button class="btn-accent" data-action="confirm-update"
          data-trip-id="${escHtml(shareState.deleteTargetId)}">確認覆蓋</button>
      </div>
    </div>`;
}
```

- [ ] **Step 4：改為 `dialog === 'overwrite'`，加入名稱衝突 UI**

```javascript
} else if (shareState.dialog === 'overwrite') {
  const namesDiffer = state.tripName !== shareState.overwriteTargetName;
  dialogHtml = `
    <div class="share-dialog">
      <div class="share-dialog-title">覆蓋行程</div>
      ${namesDiffer ? `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
          目前行程：<strong>${escHtml(state.tripName)}</strong><br>
          雲端行程：<strong>${escHtml(shareState.overwriteTargetName)}</strong>
        </div>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:8px;cursor:pointer">
          <input type="checkbox" data-action="toggle-overwrite-name" ${shareState.overwriteUpdateName ? 'checked' : ''}>
          一併將雲端名稱更新為「${escHtml(state.tripName)}」
        </label>` : ''}
      <input type="password" id="share-update-pw" placeholder="輸入當初設定的密碼" autocomplete="current-password">
      <div class="share-error">${shareState.updateError ? escHtml(shareState.updateError) : ''}</div>
      <div class="share-dialog-actions">
        <button class="btn" data-action="close-share-dialog">取消</button>
        <button class="btn-accent" data-action="confirm-overwrite"
          data-trip-id="${escHtml(shareState.deleteTargetId)}">覆蓋</button>
      </div>
    </div>`;
}
```

- [ ] **Step 5：手動驗證**

在瀏覽器開啟 `tour-planner.html`，開啟共用面板（需設定 FIREBASE_CONFIG，或直接檢查 HTML 渲染），確認：

| 情境 | 預期 |
|------|------|
| 未匯入的行程 | 顯示「匯入」＋「↑」＋「🗑」三個按鈕 |
| 已匯入的行程 | 顯示「↑」＋「🗑」兩個按鈕，無「匯入」 |
| 點擊「↑」（名稱相同） | 彈出 dialog，只有密碼輸入框，無 checkbox |
| 點擊「↑」（名稱不同） | 彈出 dialog，顯示名稱比較 + checkbox（預設勾選） |
| 勾選/取消 checkbox | 狀態正確切換 |
| 輸入錯誤密碼並覆蓋 | 顯示「密碼錯誤」紅字 |
| 輸入正確密碼並覆蓋 | 關閉 dialog，重新載入清單 |

- [ ] **Step 6：Commit**

```bash
git add tour-planner.html
git commit -m "feat: show overwrite button for all shared trips with name conflict detection"
```

---

## 完成標準

全部 4 個 task 完成後，確認以下行為：

| 情境 | 預期 |
|------|------|
| 任意行程（非匯入）點「↑」覆蓋 | 成功以目前行程內容取代雲端 |
| 已匯入行程點「↑」覆蓋（名稱同） | 靜默覆蓋，不出現 checkbox |
| 名稱不同，勾選名稱更新 | 雲端名稱改為編輯器名稱 |
| 名稱不同，不勾選名稱更新 | 雲端名稱保持原樣，只更新內容 |
| 密碼錯誤 | 紅字顯示「密碼錯誤」，dialog 不關閉 |
| 取消覆蓋 | dialog 關閉，updateError 清除 |
