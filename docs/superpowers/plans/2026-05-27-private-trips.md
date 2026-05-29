# 共用區公開／非公開 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在共用區加入公開／非公開分頁，非公開行程以暗號分組，上傳時可選擇是否公開。

**Architecture:** 所有變更集中在 `tour-planner.html` 單一檔案。資料層新增 `fetchPublicTrips()`、`fetchPrivateTrips(code)`，修改 `uploadTripToCloud()` 加入 `visibility` 與 `secretCodeHash`。UI 層在共用面板加入分頁列，並修改上傳 dialog 加入可見性切換。舊資料透過 `migrateExistingTrips()` 一次性補上 `visibility: 'public'` 欄位。

**Tech Stack:** Firebase Firestore SDK (v8 compat), 原生 JS，Web Crypto API（sha256 已有）

---

## File Map

- Modify: `tour-planner.html`
  - ~line 531: `fetchSharedTrips()` — 拆成 `fetchPublicTrips()` / `fetchPrivateTrips()`
  - ~line 539: `uploadTripToCloud()` — 新增 visibility / secretCode 參數
  - ~line 830: `shareState` 物件 — 新增 5 個欄位
  - ~line 843: `loadSharedTrips()` — 拆成 `loadPublicTrips()` / `loadPrivateTrips()`
  - ~line 1064: `renderShareOverlay()` — 加分頁列，重構為公開／非公開兩個 body
  - ~line 1100: 上傳 dialog HTML — 加 visibility 切換與暗號欄位
  - ~line 1261: `init()` — 呼叫 `migrateExistingTrips()`
  - ~line 1270: `open-share` 事件 — 改呼叫 `loadPublicTrips()`
  - ~line 1279: `open-upload-dialog` 事件 — 傳入來源 tab 資訊
  - ~line 1298: `confirm-upload` 事件 — 傳入 visibility / secretCode

---

## Task 1：Data Layer — Migration + 新 Firebase 函數

**Files:**
- Modify: `tour-planner.html` (~line 531–548, ~line 1256)

- [ ] **Step 1：在 `fetchSharedTrips()` 下方（約 line 537 後）插入新函數**

將現有 `fetchSharedTrips()` 整段替換：

```js
async function fetchPublicTrips() {
  const db = getFirestore();
  if (!db) return [];
  const snap = await db.collection('shared_trips')
    .where('visibility', '==', 'public')
    .orderBy('uploadedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fetchPrivateTrips(code) {
  const db = getFirestore();
  if (!db) return [];
  const hash = await sha256(code);
  const snap = await db.collection('shared_trips')
    .where('secretCodeHash', '==', hash)
    .orderBy('uploadedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function migrateExistingTrips() {
  if (localStorage.getItem('trips_migrated_v1')) return;
  const db = getFirestore();
  if (!db) return;
  const snap = await db.collection('shared_trips').get();
  const batch = db.batch();
  snap.docs.forEach(doc => {
    if (doc.data().visibility === undefined) {
      batch.update(doc.ref, { visibility: 'public', secretCodeHash: null });
    }
  });
  await batch.commit();
  localStorage.setItem('trips_migrated_v1', '1');
}
```

- [ ] **Step 2：修改 `uploadTripToCloud()` 加入 visibility / secretCode 參數**

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

- [ ] **Step 3：在 `init()` 結尾加入 migration 呼叫**

找到 `function init() {` 裡的 `render(); attachEvents();`，在之後加一行：

```js
function init() {
  render();
  attachEvents();
  if (FIREBASE_CONFIG.projectId) migrateExistingTrips().catch(() => {});
}
```

- [ ] **Step 4：在瀏覽器開啟 `tour-planner.html`，打開 DevTools Console，確認沒有 JS 錯誤**

- [ ] **Step 5：Commit**

```bash
git add tour-planner.html
git commit -m "feat: add fetchPublicTrips, fetchPrivateTrips, migrateExistingTrips, update uploadTripToCloud"
```

---

## Task 2：shareState — 新增欄位 + loadPublicTrips / loadPrivateTrips

**Files:**
- Modify: `tour-planner.html` (~line 830–850)

- [ ] **Step 1：擴充 `shareState` 物件，加入 5 個新欄位**

找到 `let shareState = {` 區塊，替換為：

```js
let shareState = {
  open: false, loading: false, list: [],
  error: null, dialog: null,
  deleteTargetId: null, deleteError: null, uploadError: null,
  importedDocId: loadImportedDocId(), updateError: null,
  overwriteTargetId: null, overwriteTargetName: null, overwriteUpdateName: true,
  // 新增欄位
  shareTab: 'public',
  privateCodeInput: '',
  privateCodeQueried: null,
  uploadVisibility: 'public',
  uploadSecretCode: '',
};
```

- [ ] **Step 2：將 `loadSharedTrips()` 替換為 `loadPublicTrips()` 和 `loadPrivateTrips()`**

找到 `async function loadSharedTrips() {` 整段，替換為：

```js
async function loadPublicTrips() {
  try {
    const list = await fetchPublicTrips();
    setShareState({ loading: false, list });
  } catch (err) {
    setShareState({ loading: false, error: err.message || '載入失敗' });
  }
}

async function loadPrivateTrips(code) {
  try {
    const list = await fetchPrivateTrips(code);
    setShareState({ loading: false, list, privateCodeQueried: code });
  } catch (err) {
    setShareState({ loading: false, error: err.message || '查詢失敗', privateCodeQueried: code });
  }
}
```

- [ ] **Step 3：確認 console 無錯誤，重新整理頁面後共用區仍可正常開啟（公開分頁行為不變）**

- [ ] **Step 4：Commit**

```bash
git add tour-planner.html
git commit -m "feat: extend shareState, add loadPublicTrips and loadPrivateTrips"
```

---

## Task 3：renderShareOverlay — 分頁列 + 重構 body 渲染

**Files:**
- Modify: `tour-planner.html` (~line 1064–1160)

- [ ] **Step 1：在 `renderShareOverlay()` 裡加入 `renderPublicTabBody()` 抽取函數**

在 `renderShareOverlay()` 前方插入：

```js
function renderPublicTabBody() {
  if (!FIREBASE_CONFIG.projectId) {
    return `<div class="share-status">共用功能尚未設定，請填入 FIREBASE_CONFIG。</div>`;
  }
  if (shareState.loading) return `<div class="share-status">載入中…</div>`;
  if (shareState.error) return `<div class="share-status">⚠️ ${escHtml(shareState.error)}</div>`;

  const items = shareState.list.length === 0
    ? `<div class="share-status">目前沒有共用的行程</div>`
    : shareState.list.map(trip => {
        const date = trip.uploadedAt?.toDate
          ? trip.uploadedAt.toDate().toLocaleDateString('zh-TW') : '未知日期';
        const isImported = shareState.importedDocId === trip.id;
        return `
          <div class="share-trip-item" ${isImported ? 'style="background:var(--accent-bg);border-radius:6px;padding:10px 8px;margin-bottom:2px"' : ''}>
            <div class="share-trip-info">
              <div class="share-trip-name">📋 ${escHtml(trip.tripName)}${isImported ? ' <span style="font-size:10px;color:var(--accent)">(目前匯入)</span>' : ''}</div>
              <div class="share-trip-date">${escHtml(date)} 上傳</div>
            </div>
            ${!isImported ? `<button class="btn-accent" data-action="import-shared-trip" data-trip-id="${escHtml(trip.id)}">匯入</button>` : ''}
            <button class="btn-ghost" data-action="open-overwrite-dialog"
              data-trip-id="${escHtml(trip.id)}" data-trip-name="${escHtml(trip.tripName)}" title="覆蓋此行程">覆蓋</button>
            <button class="btn-ghost" data-action="open-delete-dialog"
              data-trip-id="${escHtml(trip.id)}" title="刪除">🗑</button>
          </div>`;
      }).join('');

  return `
    <button class="share-upload-btn" data-action="open-upload-dialog">↑ 上傳目前行程</button>
    ${items}`;
}
```

- [ ] **Step 2：加入 `renderPrivateTabBody()` 函數**

```js
function renderPrivateTabBody() {
  const searchBar = `
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <input id="private-code-input" class="share-dialog-input" style="flex:1"
        placeholder="輸入暗號…"
        value="${escHtml(shareState.privateCodeInput)}"
        data-action="private-code-input">
      <button class="btn-accent" data-action="query-private-trips">查詢</button>
    </div>`;

  const uploadBtn = `<button class="share-upload-btn" data-action="open-upload-dialog-private">↑ 上傳目前行程</button>`;

  let content;
  if (!FIREBASE_CONFIG.projectId) {
    content = `<div class="share-status">共用功能尚未設定，請填入 FIREBASE_CONFIG。</div>`;
  } else if (shareState.privateCodeQueried === null) {
    content = `<div class="share-status">輸入暗號後按查詢以顯示行程</div>`;
  } else if (shareState.loading) {
    content = `<div class="share-status">載入中…</div>`;
  } else if (shareState.error) {
    content = `<div class="share-status">⚠️ ${escHtml(shareState.error)}</div>`;
  } else if (shareState.list.length === 0) {
    content = `<div class="share-status">暗號不存在</div>`;
  } else {
    content = shareState.list.map(trip => {
      const date = trip.uploadedAt?.toDate
        ? trip.uploadedAt.toDate().toLocaleDateString('zh-TW') : '未知日期';
      const isImported = shareState.importedDocId === trip.id;
      return `
        <div class="share-trip-item" ${isImported ? 'style="background:var(--accent-bg);border-radius:6px;padding:10px 8px;margin-bottom:2px"' : ''}>
          <div class="share-trip-info">
            <div class="share-trip-name">📋 ${escHtml(trip.tripName)}${isImported ? ' <span style="font-size:10px;color:var(--accent)">(目前匯入)</span>' : ''}</div>
            <div class="share-trip-date">${escHtml(date)} 上傳</div>
          </div>
          ${!isImported ? `<button class="btn-accent" data-action="import-shared-trip" data-trip-id="${escHtml(trip.id)}">匯入</button>` : ''}
          <button class="btn-ghost" data-action="open-overwrite-dialog"
            data-trip-id="${escHtml(trip.id)}" data-trip-name="${escHtml(trip.tripName)}" title="覆蓋此行程">覆蓋</button>
          <button class="btn-ghost" data-action="open-delete-dialog"
            data-trip-id="${escHtml(trip.id)}" title="刪除">🗑</button>
        </div>`;
    }).join('');
  }

  return searchBar + uploadBtn + content;
}
```

- [ ] **Step 3：重構 `renderShareOverlay()` — 加入分頁列，將 bodyHtml 改為條件切換**

找到 `function renderShareOverlay() {` 整段（到最後的 `return` 為止），替換為：

```js
function renderShareOverlay() {
  if (!shareState.open) return '';

  const tabBar = `
    <div style="display:flex;border-bottom:1px solid var(--border)">
      <button style="flex:1;padding:8px 0;background:none;border:none;border-bottom:${shareState.shareTab === 'public' ? '2px solid var(--accent)' : '2px solid transparent'};color:${shareState.shareTab === 'public' ? 'var(--accent)' : 'var(--text-muted)'};font-weight:${shareState.shareTab === 'public' ? '600' : 'normal'};cursor:pointer;font-size:13px"
        data-action="switch-share-tab" data-tab="public">公開</button>
      <button style="flex:1;padding:8px 0;background:none;border:none;border-bottom:${shareState.shareTab === 'private' ? '2px solid var(--accent)' : '2px solid transparent'};color:${shareState.shareTab === 'private' ? 'var(--accent)' : 'var(--text-muted)'};font-weight:${shareState.shareTab === 'private' ? '600' : 'normal'};cursor:pointer;font-size:13px"
        data-action="switch-share-tab" data-tab="private">非公開</button>
    </div>`;

  const bodyHtml = shareState.shareTab === 'public'
    ? renderPublicTabBody()
    : renderPrivateTabBody();

  let dialogHtml = '';
  if (shareState.dialog === 'upload') {
    const isPrivate = shareState.uploadVisibility === 'private';
    dialogHtml = `
      <div class="share-dialog">
        <div class="share-dialog-title">上傳行程</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">公開設定</div>
        <div style="display:flex;gap:6px;margin-bottom:10px">
          <button class="${!isPrivate ? 'btn-accent' : 'btn'}" style="flex:1"
            data-action="set-upload-visibility" data-val="public">公開</button>
          <button class="${isPrivate ? 'btn-accent' : 'btn'}" style="flex:1"
            data-action="set-upload-visibility" data-val="private">非公開</button>
        </div>
        ${isPrivate ? `
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">暗號（必填）</div>
          <input id="share-upload-code" placeholder="輸入暗號"
            value="${escHtml(shareState.uploadSecretCode)}"
            data-action="upload-secret-code-input"
            style="width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:4px;padding:6px 8px;font-size:13px;background:var(--input-bg);color:var(--text);margin-bottom:8px">
        ` : ''}
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">刪除密碼（必填）</div>
        <input type="password" id="share-upload-pw" placeholder="輸入刪除密碼" autocomplete="new-password">
        <div class="share-error">${shareState.uploadError ? escHtml(shareState.uploadError) : ''}</div>
        <div class="share-dialog-actions">
          <button class="btn" data-action="close-share-dialog">取消</button>
          <button class="btn-accent" data-action="confirm-upload">上傳</button>
        </div>
      </div>`;
  } else if (shareState.dialog === 'delete') {
    dialogHtml = `
      <div class="share-dialog">
        <div class="share-dialog-title">輸入刪除密碼</div>
        <input type="password" id="share-delete-pw" placeholder="刪除密碼" autocomplete="current-password">
        <div class="share-error">${shareState.deleteError ? escHtml(shareState.deleteError) : ''}</div>
        <div class="share-dialog-actions">
          <button class="btn" data-action="close-share-dialog">取消</button>
          <button class="btn-accent" data-action="confirm-delete"
            data-trip-id="${escHtml(shareState.deleteTargetId)}">刪除</button>
        </div>
      </div>`;
  } else if (shareState.dialog === 'overwrite') {
    const namesDiffer = state.tripName !== shareState.overwriteTargetName;
    dialogHtml = `
      <div class="share-dialog">
        <div class="share-dialog-title">覆蓋行程</div>
        ${namesDiffer ? `
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">
            目前行程：<strong>${escHtml(state.tripName)}</strong><br>
            雲端行程：<strong>${escHtml(shareState.overwriteTargetName)}</strong>
          </div>
          <div style="font-size:12px;margin-bottom:4px">是否一併將雲端名稱更新為「${escHtml(state.tripName)}」?</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button class="${shareState.overwriteUpdateName ? 'btn-accent' : 'btn'}" data-action="set-overwrite-update-name" data-value="true" style="flex:1">是</button>
            <button class="${!shareState.overwriteUpdateName ? 'btn-accent' : 'btn'}" data-action="set-overwrite-update-name" data-value="false" style="flex:1">否</button>
          </div>` : ''}
        <input type="password" id="share-update-pw" placeholder="輸入當初設定的密碼" autocomplete="current-password">
        <div class="share-error">${shareState.updateError ? escHtml(shareState.updateError) : ''}</div>
        <div class="share-dialog-actions">
          <button class="btn" data-action="close-share-dialog">取消</button>
          <button class="btn-accent" data-action="confirm-overwrite"
            data-trip-id="${escHtml(shareState.overwriteTargetId)}">覆蓋</button>
        </div>
      </div>`;
  }

  return `
      <div class="share-backdrop" data-action="close-share"></div>
      <div class="share-panel">
        <div class="share-header">
          <span>☁️ 共用區</span>
          <button class="btn-ghost" data-action="close-share" style="opacity:1;font-size:16px">✕</button>
        </div>
        ${tabBar}
        <div class="share-body">${bodyHtml}</div>
      </div>
      ${dialogHtml}
    </div>`;
}
```

- [ ] **Step 4：開啟 `tour-planner.html`，點「☁️ 共用」確認：**
  - 出現「公開」「非公開」兩個分頁
  - 公開分頁：行為與原本相同
  - 非公開分頁：顯示搜尋列 + 「輸入暗號後按查詢以顯示行程」

- [ ] **Step 5：Commit**

```bash
git add tour-planner.html
git commit -m "feat: add tab bar and private tab rendering to share overlay"
```

---

## Task 4：Event Handlers — 分頁切換 + 暗號查詢 + 上傳 dialog 新欄位

**Files:**
- Modify: `tour-planner.html` (~line 1261–1380)

- [ ] **Step 1：修改 `open-share` 事件，改呼叫 `loadPublicTrips()`**

找到：
```js
if (action === 'open-share') {
  setShareState({ open: true, loading: true, list: [], error: null, dialog: null });
  loadSharedTrips();
  return;
}
```
替換為：
```js
if (action === 'open-share') {
  setShareState({
    open: true, loading: true, list: [], error: null, dialog: null,
    shareTab: 'public', privateCodeQueried: null,
  });
  loadPublicTrips();
  return;
}
```

- [ ] **Step 2：加入 `switch-share-tab` 事件**

在 `close-share` handler 後方加入：

```js
if (action === 'switch-share-tab') {
  const tab = el.dataset.tab;
  if (tab === shareState.shareTab) return;
  if (tab === 'public') {
    setShareState({ shareTab: 'public', loading: true, list: [], error: null });
    loadPublicTrips();
  } else {
    // 重置 privateCodeQueried 讓分頁顯示「輸入暗號後按查詢」提示而非「暗號不存在」
    setShareState({ shareTab: 'private', loading: false, list: [], error: null, privateCodeQueried: null });
  }
  return;
}
```

- [ ] **Step 3：加入 `private-code-input` 事件（監聽 input 即時值）**

在事件監聽器的 `input` 區段（找 `app.addEventListener('input', e => {`），加入：

```js
if (action === 'private-code-input') {
  setShareState({ privateCodeInput: el.value });
  return;
}
if (action === 'upload-secret-code-input') {
  setShareState({ uploadSecretCode: el.value });
  return;
}
```

- [ ] **Step 4：加入 `query-private-trips` 事件**

在 click handler 裡，`switch-share-tab` 後方加入：

```js
if (action === 'query-private-trips') {
  const code = shareState.privateCodeInput.trim();
  if (!code) { setShareState({ error: '請輸入暗號' }); return; }
  setShareState({ loading: true, list: [], error: null });
  loadPrivateTrips(code);
  return;
}
```

- [ ] **Step 5：加入 `open-upload-dialog-private` 事件（從非公開分頁上傳，預填暗號）**

```js
if (action === 'open-upload-dialog-private') {
  setShareState({
    dialog: 'upload',
    uploadVisibility: 'private',
    uploadSecretCode: shareState.privateCodeInput.trim(),
    uploadError: null,
  });
  return;
}
```

- [ ] **Step 6：加入 `set-upload-visibility` 事件**

```js
if (action === 'set-upload-visibility') {
  setShareState({ uploadVisibility: el.dataset.val, uploadError: null });
  return;
}
```

- [ ] **Step 7：修改 `open-upload-dialog` 事件（從公開分頁開啟，預設 public）**

找到：
```js
if (action === 'open-upload-dialog') {
  setShareState({ dialog: 'upload', uploadError: null });
  return;
}
```
替換為：
```js
if (action === 'open-upload-dialog') {
  setShareState({
    dialog: 'upload',
    uploadVisibility: 'public',
    uploadSecretCode: '',
    uploadError: null,
  });
  return;
}
```

- [ ] **Step 8：修改 `confirm-upload` 事件，加入 visibility / secretCode 參數**

找到：
```js
if (action === 'confirm-upload') {
  const pw = document.getElementById('share-upload-pw')?.value?.trim();
  if (!pw) { setShareState({ uploadError: '請輸入刪除密碼' }); return; }
  uploadTripToCloud(pw)
    .then(() => {
      setShareState({ dialog: null, uploadError: null, loading: true, list: [] });
      return loadSharedTrips();
    })
    .catch(err => setShareState({ uploadError: err.message || '上傳失敗' }));
  return;
}
```
替換為：
```js
if (action === 'confirm-upload') {
  const pw = document.getElementById('share-upload-pw')?.value?.trim();
  if (!pw) { setShareState({ uploadError: '請輸入刪除密碼' }); return; }
  const vis = shareState.uploadVisibility;
  const code = shareState.uploadSecretCode.trim();
  if (vis === 'private' && !code) { setShareState({ uploadError: '請輸入暗號' }); return; }
  uploadTripToCloud(pw, vis, code)
    .then(() => {
      setShareState({ dialog: null, uploadError: null, loading: true, list: [] });
      return shareState.shareTab === 'public' ? loadPublicTrips() : loadPrivateTrips(code);
    })
    .catch(err => setShareState({ uploadError: err.message || '上傳失敗' }));
  return;
}
```

- [ ] **Step 9：修改 `close-share-dialog` 事件，清除新欄位**

找到：
```js
if (action === 'close-share-dialog') {
  setShareState({ dialog: null, deleteError: null, uploadError: null, updateError: null, overwriteTargetId: null, overwriteTargetName: null, overwriteUpdateName: true });
  return;
}
```
替換為：
```js
if (action === 'close-share-dialog') {
  setShareState({
    dialog: null, deleteError: null, uploadError: null,
    updateError: null, overwriteTargetId: null, overwriteTargetName: null,
    overwriteUpdateName: true, uploadVisibility: 'public', uploadSecretCode: '',
  });
  return;
}
```

- [ ] **Step 10：手動測試全流程**

  1. 打開共用區 → 公開分頁正常顯示
  2. 切換非公開 → 顯示搜尋列與提示文字
  3. 輸入不存在的暗號查詢 → 顯示「暗號不存在」
  4. 點非公開分頁的「↑ 上傳目前行程」→ dialog 預設為「非公開」且暗號欄位預填
  5. 公開分頁「↑ 上傳目前行程」→ dialog 預設為「公開」，不顯示暗號欄
  6. 切換公開設定為「非公開」→ 暗號欄出現
  7. 空白暗號按上傳 → 顯示「請輸入暗號」
  8. 填入暗號 + 刪除密碼後上傳 → 上傳成功，非公開分頁自動重新查詢並顯示剛上傳的行程

- [ ] **Step 11：Commit**

```bash
git add tour-planner.html
git commit -m "feat: wire up tab switching, private query, and updated upload dialog handlers"
```

---

## Task 5：Firestore Composite Index 設定（手動步驟）

**Files:** Firebase Console（非程式碼）

- [ ] **Step 1：開啟 [Firebase Console](https://console.firebase.google.com/) → 選 `tour-planner-2ca53` 專案 → Firestore Database → Indexes → Composite**

- [ ] **Step 2：建立 Index 1**
  - Collection ID: `shared_trips`
  - Fields: `visibility Ascending`, `uploadedAt Descending`
  - Query scope: Collection

- [ ] **Step 3：建立 Index 2**
  - Collection ID: `shared_trips`
  - Fields: `secretCodeHash Ascending`, `uploadedAt Descending`
  - Query scope: Collection

- [ ] **Step 4：等待兩個 index 狀態變為 Enabled（約 1–2 分鐘）**

- [ ] **Step 5：重新測試公開分頁載入與非公開分頁查詢，確認不再出現 index 相關錯誤**

---

## Task 6：CSS — share-dialog input 樣式補齊

**Files:**
- Modify: `tour-planner.html` (~line 490 CSS section)

- [ ] **Step 1：找到 `.share-dialog input {` 樣式**

確認現有 CSS 中已有：
```css
.share-dialog input {
  width: 100%; box-sizing: border-box;
  border: 1px solid var(--border); border-radius: 4px;
  padding: 6px 8px; font-size: 13px;
  background: var(--input-bg); color: var(--text);
  margin-bottom: 8px;
}
```

若不存在或樣式不完整，在 `.share-dialog input` 補上上述樣式，確保暗號欄位與密碼欄位視覺一致。

- [ ] **Step 2：目視確認 upload dialog 中的暗號輸入框與刪除密碼輸入框外觀一致**

- [ ] **Step 3：Commit（若有修改）**

```bash
git add tour-planner.html
git commit -m "fix: ensure upload dialog secret code input matches password input style"
```
