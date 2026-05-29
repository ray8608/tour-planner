# Cloud Sharing (Firebase Firestore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 tour-planner.html 新增「共用區」功能，讓使用者可透過 Firebase Firestore 上傳、瀏覽、匯入、刪除共用行程。

**Architecture:** Firebase Compat SDK 透過 CDN `<script>` 載入（不需 build 工具）。共用邏輯全部在 `tour-planner.html` 的既有 script block 內。Share UI 使用獨立的 `shareState` 物件（不存入 localStorage）。密碼以 SHA-256 hash 存入 Firestore，原始密碼不離開瀏覽器。

**Tech Stack:** Firebase JS SDK v10 (compat CDN), Web Crypto API (瀏覽器內建), vanilla JS, 單一 HTML 檔案

---

### Task 1: Firebase SDK 和 Config Stub

**Files:**
- Modify: `tour-planner.html`

- [ ] 在 `</body>` 之前（現有 `<script>` 之前）加入 Firebase CDN：

```html
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
```

- [ ] 在既有 `<script>` block 最頂端（`// ===== Utilities =====` 之前）加入：

```js
// ===== Firebase Config =====
// 填入 Firebase 專案設定。projectId 為空時停用雲端共用功能。
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

function getFirestore() {
  if (!FIREBASE_CONFIG.projectId) return null;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  return firebase.firestore();
}
```

- [ ] 開啟瀏覽器，確認 console 無錯誤。

- [ ] Commit:
```bash
git add tour-planner.html
git commit -m "feat: add Firebase SDK CDN and config stub"
```

---

### Task 2: SHA-256 工具函式和 Firestore CRUD

**Files:**
- Modify: `tour-planner.html`

- [ ] 在 `// ===== Utilities =====` section 的 `genId()` 之前加入：

```js
async function sha256(text) {
  const buf = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(text)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] 在 `getFirestore()` 之後加入 Firestore CRUD 函式：

```js
async function fetchSharedTrips() {
  const db = getFirestore();
  if (!db) return [];
  const snap = await db.collection('shared_trips')
    .orderBy('uploadedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function uploadTripToCloud(password) {
  const db = getFirestore();
  if (!db) throw new Error('Firebase 未設定');
  const hash = await sha256(password);
  await db.collection('shared_trips').add({
    tripName: state.tripName,
    uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
    data: state,
    deletePasswordHash: hash
  });
}

async function deleteSharedTrip(docId, password) {
  const db = getFirestore();
  if (!db) throw new Error('Firebase 未設定');
  const doc = await db.collection('shared_trips').doc(docId).get();
  if (!doc.exists) throw new Error('記錄不存在');
  const hash = await sha256(password);
  if (hash !== doc.data().deletePasswordHash) throw new Error('密碼錯誤');
  await db.collection('shared_trips').doc(docId).delete();
}

async function getSharedTripData(docId) {
  const db = getFirestore();
  if (!db) throw new Error('Firebase 未設定');
  const doc = await db.collection('shared_trips').doc(docId).get();
  if (!doc.exists) throw new Error('記錄不存在');
  return doc.data().data;
}
```

- [ ] 開啟瀏覽器，確認 console 無語法錯誤。

- [ ] Commit:
```bash
git add tour-planner.html
git commit -m "feat: add sha256 utility and Firestore CRUD functions"
```

---

### Task 3: Share State、CSS 和 Overlay 骨架

**Files:**
- Modify: `tour-planner.html`

- [ ] 在 `let settingsOpen = false;` 之後加入：

```js
let shareState = {
  open: false,
  loading: false,
  list: [],
  error: null,
  dialog: null,          // 'upload' | 'delete' | null
  deleteTargetId: null,
  deleteError: null,
  uploadError: null,
};

function setShareState(updates) {
  Object.assign(shareState, updates);
  render();
}

async function loadSharedTrips() {
  try {
    const list = await fetchSharedTrips();
    setShareState({ loading: false, list });
  } catch (err) {
    setShareState({ loading: false, error: err.message || '載入失敗' });
  }
}
```

- [ ] 在 `<style>` block 結尾（`</style>` 之前）加入：

```css
/* ===== Share Overlay ===== */
.share-overlay { position: fixed; inset: 0; z-index: 300; }
.share-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
.share-panel {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; width: min(480px, calc(100vw - 32px));
  max-height: 80vh; display: flex; flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.share-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid var(--border);
  font-size: 14px; font-weight: 600; flex-shrink: 0;
}
.share-body { flex: 1; overflow-y: auto; padding: 12px 16px; }
.share-upload-btn {
  width: 100%; background: var(--accent-bg); color: var(--accent);
  border: 1px solid var(--accent-bd); border-radius: 6px;
  padding: 8px; font-size: 13px; margin-bottom: 12px; cursor: pointer;
}
.share-upload-btn:hover { opacity: 0.85; }
.share-trip-item {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 13px;
}
.share-trip-item:last-child { border-bottom: none; }
.share-trip-info { flex: 1; min-width: 0; }
.share-trip-name {
  font-weight: 500; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.share-trip-date { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.share-status { padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px; }
/* ===== Share Dialog ===== */
.share-dialog {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 8px; padding: 20px;
  width: min(320px, calc(100vw - 48px));
  z-index: 1; box-shadow: 0 4px 24px rgba(0,0,0,0.4);
}
.share-dialog-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.share-dialog input {
  width: 100%; background: var(--input-bg); border: 1px solid var(--border);
  color: var(--text); border-radius: 5px; padding: 7px 10px;
  font-size: 13px; margin-bottom: 4px;
}
.share-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.share-error { font-size: 12px; color: #f87171; margin-top: 4px; min-height: 18px; }
```

- [ ] 在 `renderHeader()` 之前加入 `renderShareOverlay()`：

```js
function renderShareOverlay() {
  if (!shareState.open) return '';

  let bodyHtml;
  if (!FIREBASE_CONFIG.projectId) {
    bodyHtml = `<div class="share-status">共用功能尚未設定，請填入 FIREBASE_CONFIG。</div>`;
  } else if (shareState.loading) {
    bodyHtml = `<div class="share-status">載入中…</div>`;
  } else if (shareState.error) {
    bodyHtml = `<div class="share-status">⚠️ ${escHtml(shareState.error)}</div>`;
  } else {
    const items = shareState.list.length === 0
      ? `<div class="share-status">目前沒有共用的行程</div>`
      : shareState.list.map(trip => {
          const date = trip.uploadedAt?.toDate
            ? trip.uploadedAt.toDate().toLocaleDateString('zh-TW')
            : '未知日期';
          return `
            <div class="share-trip-item">
              <div class="share-trip-info">
                <div class="share-trip-name">📋 ${escHtml(trip.tripName)}</div>
                <div class="share-trip-date">${escHtml(date)} 上傳</div>
              </div>
              <button class="btn-accent" data-action="import-shared-trip"
                data-trip-id="${escHtml(trip.id)}">匯入</button>
              <button class="btn-ghost" data-action="open-delete-dialog"
                data-trip-id="${escHtml(trip.id)}" title="刪除">🗑</button>
            </div>`;
        }).join('');
    bodyHtml = `
      <button class="share-upload-btn" data-action="open-upload-dialog">↑ 上傳目前行程</button>
      ${items}`;
  }

  let dialogHtml = '';
  if (shareState.dialog === 'upload') {
    dialogHtml = `
      <div class="share-dialog">
        <div class="share-dialog-title">設定刪除密碼</div>
        <input type="password" id="share-upload-pw" placeholder="輸入刪除密碼（必填）" autocomplete="new-password">
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
  }

  return `
    <div class="share-overlay" id="share-overlay">
      <div class="share-backdrop" data-action="close-share"></div>
      <div class="share-panel">
        <div class="share-header">
          <span>☁️ 共用區</span>
          <button class="btn-ghost" data-action="close-share" style="opacity:1;font-size:16px">✕</button>
        </div>
        <div class="share-body">${bodyHtml}</div>
      </div>
      ${dialogHtml}
    </div>`;
}
```

- [ ] 在 `render()` 的 `innerHTML` template 中，在 `${renderSettingsPanel()}` 之後加入 `${renderShareOverlay()}`：

找到：
```js
      document.getElementById('app').innerHTML = `
        ${renderHeader()}
        ${renderSettingsPanel()}
```
改為：
```js
      document.getElementById('app').innerHTML = `
        ${renderHeader()}
        ${renderSettingsPanel()}
        ${renderShareOverlay()}
```

- [ ] 在 `renderHeader()` 的 `header-right` div 中，在匯入 `<label>` 之後加入共用按鈕：

找到：
```js
            <button class="btn-icon" data-action="toggle-settings" title="設定">⚙️</button>
```
改為：
```js
            <button class="btn" data-action="open-share">☁️ 共用</button>
            <button class="btn-icon" data-action="toggle-settings" title="設定">⚙️</button>
```

- [ ] Commit:
```bash
git add tour-planner.html
git commit -m "feat: add share state, CSS, overlay skeleton and header button"
```

---

### Task 4: 事件處理（全部 share actions）

**Files:**
- Modify: `tour-planner.html`

- [ ] 在 `attachEvents()` 的 click listener 內，`if (action === 'toggle-settings')` **之前**加入所有 share 相關的 action handlers：

```js
        if (action === 'open-share') {
          setShareState({ open: true, loading: true, list: [], error: null, dialog: null });
          loadSharedTrips();
          return;
        }

        if (action === 'close-share') {
          setShareState({ open: false, dialog: null, deleteError: null, uploadError: null });
          return;
        }

        if (action === 'open-upload-dialog') {
          setShareState({ dialog: 'upload', uploadError: null });
          return;
        }

        if (action === 'close-share-dialog') {
          setShareState({ dialog: null, deleteError: null, uploadError: null });
          return;
        }

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

        if (action === 'import-shared-trip') {
          const docId = el.dataset.tripId;
          if (!confirm('匯入將覆蓋目前行程，確定嗎？')) return;
          getSharedTripData(docId)
            .then(data => {
              state = migrateState(data);
              if (!state.days?.find(d => d.id === state.activeDayId)) {
                state.activeDayId = state.days?.[0]?.id ?? null;
              }
              save(state);
              setShareState({ open: false, dialog: null });
            })
            .catch(err => alert('匯入失敗：' + (err.message || '未知錯誤')));
          return;
        }

        if (action === 'open-delete-dialog') {
          setShareState({ dialog: 'delete', deleteTargetId: el.dataset.tripId, deleteError: null });
          return;
        }

        if (action === 'confirm-delete') {
          const docId = el.dataset.tripId;
          const pw = document.getElementById('share-delete-pw')?.value?.trim();
          if (!pw) { setShareState({ deleteError: '請輸入密碼' }); return; }
          deleteSharedTrip(docId, pw)
            .then(() => {
              setShareState({ dialog: null, deleteError: null, loading: true, list: [] });
              return loadSharedTrips();
            })
            .catch(err => setShareState({ deleteError: err.message || '刪除失敗' }));
          return;
        }
```

- [ ] 開啟瀏覽器（FIREBASE_CONFIG.projectId 為空），點「☁️ 共用」→ 確認 overlay 出現並顯示「共用功能尚未設定」。點 ✕ 或背景 → 確認 overlay 關閉。

- [ ] Commit:
```bash
git add tour-planner.html
git commit -m "feat: wire up all share event handlers (open, upload, import, delete)"
```

---

### Task 5: 驗證完整流程並推上 GitHub

**Files:**
- Modify: `tour-planner.html`（如有 polish 修正）

- [ ] 填入真實的 `FIREBASE_CONFIG`，重新開啟瀏覽器。

- [ ] 測試上傳：點「☁️ 共用」→「↑ 上傳目前行程」→ 輸入密碼 → 上傳 → 確認行程出現在列表。

- [ ] 測試匯入：點列表中的「匯入」→ 確認提示對話框 → 確認後行程載入，overlay 關閉。

- [ ] 測試刪除（錯誤密碼）：點 🗑 → 輸入錯誤密碼 → 確認顯示「密碼錯誤」。

- [ ] 測試刪除（正確密碼）：輸入正確密碼 → 確認行程從列表消失。

- [ ] 測試手機版面（Chrome DevTools 裝置模擬）：overlay 和 dialog 都能正常顯示與操作。

- [ ] 確認 FIREBASE_CONFIG 為空時，現有功能（新增景點、匯出、匯入 JSON 等）完全不受影響。

- [ ] 若有任何問題修正後 commit，然後：
```bash
git push origin main
```
