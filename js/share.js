/* ============================================================
   share.js — 雲端共用面板（UI 模組，自成一格）
   ------------------------------------------------------------
   與主渲染迴圈解耦：自管 shareState，渲染進 #overlay-root，並在該容器上
   自行做事件委派。密碼／暗號欄位為非受控輸入（於動作發生時才讀取 DOM），
   避免 re-render 清掉輸入游標。匯入行程時呼叫 state.js 的 importState()，
   由主迴圈負責重繪 #app。
   傳輸與雜湊皆在 services/firebase.js；本檔只處理 UI 與流程。
   ============================================================ */

import { escapeHtml, escapeAttr } from "./utils.js";
import { getState, importState } from "./state.js";
import {
  isCloudEnabled,
  isSuperUser,
  setSuperUser,
  fetchPublicTrips,
  fetchPrivateTrips,
  fetchAllPrivateTrips,
  uploadTripToCloud,
  updateTripInCloud,
  changeTripPassword,
  deleteSharedTrip,
  deleteSharedTripAsAdmin,
  getSharedTripData,
} from "./services/firebase.js";

const IMPORTED_DOC_KEY = "tour-planner-imported-doc-id";
const SUPERUSER_SENTINEL = "__SUPERUSER__";

let mount = null; // #overlay-root

// ---------------- 匯入來源 docId 持久化 ----------------
function loadImportedDocId() {
  try {
    return localStorage.getItem(IMPORTED_DOC_KEY) || null;
  } catch (_) {
    return null;
  }
}
function saveImportedDocId(docId) {
  try {
    if (docId) localStorage.setItem(IMPORTED_DOC_KEY, docId);
    else localStorage.removeItem(IMPORTED_DOC_KEY);
  } catch (_) {
    /* 隱私模式：忽略 */
  }
}

// ---------------- UI 狀態（不進 undo、不進 localStorage） ----------------
const shareState = {
  open: false,
  loading: false,
  list: [],
  error: null,
  dialog: null, // null | "upload" | "delete" | "manage" | "overwrite"
  importedDocId: loadImportedDocId(),
  // upload
  uploadVisibility: "public",
  uploadSecretCode: "",
  uploadError: null,
  shareUrl: null,
  // tabs / private
  shareTab: "public",
  privateCodeQueried: null,
  // delete
  deleteTargetId: null,
  deleteError: null,
  // overwrite
  overwriteTargetId: null,
  overwriteTargetName: null,
  overwriteUpdateName: true,
  updateError: null,
  // manage
  managingTrip: null, // { id, tripName }
  manageView: "main", // "main" | "changePassword"
  manageError: null,
  // superuser
  superuserPromptOpen: false,
};

function set(updates) {
  Object.assign(shareState, updates);
  renderShare();
}

// ---------------- 非同步載入 ----------------
function loadPublicTrips() {
  return fetchPublicTrips()
    .then((list) => set({ loading: false, list }))
    .catch((err) => set({ loading: false, error: err.message || "載入失敗" }));
}
function loadPrivateTrips(code) {
  return fetchPrivateTrips(code)
    .then((list) => set({ loading: false, list, privateCodeQueried: code }))
    .catch((err) => set({ loading: false, error: err.message || "查詢失敗", privateCodeQueried: code }));
}
function loadAllPrivateTrips() {
  return fetchAllPrivateTrips()
    .then((list) => set({ loading: false, list, privateCodeQueried: SUPERUSER_SENTINEL }))
    .catch((err) => set({ loading: false, error: err.message || "載入失敗", privateCodeQueried: SUPERUSER_SENTINEL }));
}

/** 目前分頁對應的重新載入（上傳／覆寫／刪除後刷新清單） */
function reloadCurrentTab() {
  if (shareState.shareTab === "public") return loadPublicTrips();
  if (shareState.privateCodeQueried === SUPERUSER_SENTINEL) return loadAllPrivateTrips();
  return loadPrivateTrips(shareState.privateCodeQueried);
}

// ---------------- 對外 ----------------
export function openShare() {
  if (!isCloudEnabled()) {
    alert("雲端共用功能未啟用（未設定 Firebase 專案）。");
    return;
  }
  set({
    open: true,
    loading: true,
    list: [],
    error: null,
    dialog: null,
    shareTab: "public",
    privateCodeQueried: null,
    shareUrl: null,
  });
  loadPublicTrips();
}

/**
 * 雲端資料縱深防禦：任何 client 都能寫入任意 data map（規則僅檢查 is map），
 * 故匯入前以與 export.js/validateImport 相同的語意做健全性檢查
 * （必須是含 days 陣列的物件）。惡意/損壞 payload 直接擋下，不進 importState。
 */
function assertValidTripData(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.days)) {
    throw new Error("雲端行程資料格式無法識別");
  }
}

/** 頁面載入時處理 ?import=<docId> 分享連結 */
export async function handleImportParam() {
  if (!isCloudEnabled()) return;
  const docId = new URLSearchParams(location.search).get("import");
  if (!docId) return;
  history.replaceState({}, "", location.pathname);
  if (!confirm("偵測到分享連結，是否匯入該行程？（將覆蓋目前行程）")) return;
  try {
    const data = await getSharedTripData(docId);
    assertValidTripData(data);
    importState(data);
    saveImportedDocId(docId);
    shareState.importedDocId = docId;
  } catch (err) {
    alert("匯入失敗：" + (err.message || "未知錯誤"));
  }
}

export function initShare() {
  mount = document.getElementById("overlay-root");
  if (!mount) return;
  mount.addEventListener("click", onClick);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !shareState.open) return;
    // 有對話框時先關對話框，否則關整個面板
    if (shareState.dialog) {
      set({ dialog: null, deleteError: null, uploadError: null, updateError: null, manageError: null });
    } else {
      set({ open: false, shareUrl: null });
    }
  });
  renderShare();
}

// ---------------- 事件委派（僅作用於 #overlay-root） ----------------
function onClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el || !mount.contains(el)) return;
  const { action } = el.dataset;
  const tripId = el.dataset.tripId;

  switch (action) {
    case "close-share":
      set({ open: false, dialog: null, deleteError: null, uploadError: null, shareUrl: null, managingTrip: null, manageError: null });
      return;

    case "switch-share-tab": {
      const tab = el.dataset.tab;
      if (tab === shareState.shareTab) return;
      if (tab === "public") {
        set({ shareTab: "public", loading: true, list: [], error: null });
        loadPublicTrips();
      } else if (isSuperUser()) {
        set({ shareTab: "private", loading: true, list: [], error: null, privateCodeQueried: null });
        loadAllPrivateTrips();
      } else {
        set({ shareTab: "private", loading: false, list: [], error: null, privateCodeQueried: null });
      }
      return;
    }

    case "query-private-trips": {
      const code = mount.querySelector("#private-code-input")?.value?.trim();
      if (!code) { set({ error: "請輸入暗號" }); return; }
      set({ loading: true, list: [], error: null });
      loadPrivateTrips(code);
      return;
    }

    case "copy-trip-link": {
      const url = `${location.origin}${location.pathname}?import=${encodeURIComponent(tripId)}`;
      copyToClipboard(url, el, "✅");
      return;
    }

    case "copy-share-url":
      copyToClipboard(el.dataset.url, el, "✅ 已複製");
      return;

    // ---- 上傳 ----
    case "open-upload-dialog":
      set({ dialog: "upload", uploadVisibility: "public", uploadSecretCode: "", uploadError: null });
      return;

    case "open-upload-dialog-private": {
      const code = mount.querySelector("#private-code-input")?.value?.trim();
      set({ dialog: "upload", uploadVisibility: "private", uploadSecretCode: code ?? "", uploadError: null });
      return;
    }

    case "set-upload-visibility":
      if (!["public", "private"].includes(el.dataset.val)) return;
      set({ uploadVisibility: el.dataset.val, uploadError: null });
      return;

    case "confirm-upload":
      confirmUpload();
      return;

    // ---- 匯入 ----
    case "import-shared-trip":
      importSharedTrip(tripId);
      return;

    // ---- 覆寫 ----
    case "open-overwrite-dialog":
      set({ dialog: "overwrite", overwriteTargetId: tripId, overwriteTargetName: el.dataset.tripName, overwriteUpdateName: true, updateError: null });
      return;

    case "set-overwrite-update-name":
      set({ overwriteUpdateName: el.dataset.value === "true" });
      return;

    case "confirm-overwrite":
      confirmOverwrite(tripId);
      return;

    // ---- 管理 ----
    case "open-manage-dialog":
      set({ dialog: "manage", managingTrip: { id: tripId, tripName: el.dataset.tripName }, manageView: "main", manageError: null });
      return;

    case "manage-change-pw-view":
      set({ manageView: "changePassword", manageError: null });
      return;

    case "manage-back":
      set({ manageView: "main", manageError: null });
      return;

    case "manage-delete":
      set({ dialog: "delete", deleteTargetId: shareState.managingTrip.id, deleteError: null, managingTrip: null });
      return;

    case "manage-change-pw-submit":
      changePw(tripId);
      return;

    // ---- 刪除 ----
    case "confirm-delete":
      confirmDelete(tripId);
      return;

    case "close-share-dialog":
      set({
        dialog: null, deleteError: null, uploadError: null, updateError: null,
        overwriteTargetId: null, overwriteTargetName: null, overwriteUpdateName: true,
        uploadVisibility: "public", uploadSecretCode: "", managingTrip: null, manageError: null,
      });
      return;

    // ---- 超級模式（純 UI 便利；見 ADR-0004）----
    case "toggle-superuser-prompt":
      if (isSuperUser()) {
        setSuperUser(false);
        set({ superuserPromptOpen: false });
      } else {
        set({ superuserPromptOpen: !shareState.superuserPromptOpen });
        if (shareState.superuserPromptOpen) {
          setTimeout(() => mount.querySelector("#su-pw-input")?.focus(), 50);
        }
      }
      return;

    case "submit-superuser-pw": {
      const input = mount.querySelector("#su-pw-input");
      if (input && input.value === "6666") {
        setSuperUser(true);
        set({ superuserPromptOpen: false });
      } else if (input) {
        input.classList.add("is-invalid");
        input.value = "";
        setTimeout(() => input.classList.remove("is-invalid"), 800);
      }
      return;
    }

    default:
      return;
  }
}

// ---------------- 動作實作 ----------------
function copyToClipboard(text, el, okLabel) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const orig = el.textContent;
      el.textContent = okLabel;
      setTimeout(() => { el.textContent = orig; }, 1500);
    })
    .catch(() => alert("複製失敗，請手動複製"));
}

function confirmUpload() {
  const pw = mount.querySelector("#share-upload-pw")?.value?.trim();
  if (!pw) { set({ uploadError: "請輸入刪除密碼" }); return; }
  const vis = shareState.uploadVisibility;
  const code = mount.querySelector("#share-upload-code")?.value?.trim() || shareState.uploadSecretCode.trim();
  if (vis === "private" && !code) { set({ uploadError: "請輸入暗號" }); return; }
  uploadTripToCloud(getState(), pw, vis, code)
    .then((docId) => {
      const shareUrl = `${location.origin}${location.pathname}?import=${encodeURIComponent(docId)}`;
      set({ dialog: null, uploadError: null, shareUrl, loading: true, list: [] });
      return reloadCurrentTab();
    })
    .catch((err) => set({ uploadError: err.message || "上傳失敗" }));
}

function importSharedTrip(docId) {
  if (!confirm("匯入將覆蓋目前行程，確定嗎？")) return;
  getSharedTripData(docId)
    .then((data) => {
      assertValidTripData(data);
      importState(data); // 交由 state.js 遷移 + 主迴圈重繪
      saveImportedDocId(docId);
      set({ open: false, dialog: null, importedDocId: docId });
    })
    .catch((err) => alert("匯入失敗：" + (err.message || "未知錯誤")));
}

function confirmOverwrite(docId) {
  const pw = mount.querySelector("#share-update-pw")?.value?.trim();
  if (!pw) { set({ updateError: "請輸入密碼" }); return; }
  const nameToSave = shareState.overwriteUpdateName ? getState().tripName : shareState.overwriteTargetName;
  updateTripInCloud(docId, pw, getState(), nameToSave)
    .then(() => {
      set({ dialog: null, updateError: null, loading: true, list: [] });
      return reloadCurrentTab();
    })
    .catch((err) => set({ updateError: err.message || "覆蓋失敗" }));
}

function changePw(docId) {
  const oldPw = mount.querySelector("#manage-old-pw")?.value?.trim();
  const newPw = mount.querySelector("#manage-new-pw")?.value?.trim();
  if (!oldPw || !newPw) { set({ manageError: "請輸入舊密碼與新密碼" }); return; }
  changeTripPassword(docId, oldPw, newPw)
    .then(() => set({ dialog: null, managingTrip: null, manageError: null }))
    .catch((err) => set({ manageError: err.message || "更換失敗" }));
}

function confirmDelete(docId) {
  const pw = mount.querySelector("#share-delete-pw")?.value?.trim();
  const superUser = isSuperUser();
  if (!pw && !superUser) { set({ deleteError: "請輸入密碼" }); return; }
  const promise = !pw && superUser ? deleteSharedTripAsAdmin(docId) : deleteSharedTrip(docId, pw);
  promise
    .then(() => {
      if (shareState.importedDocId === docId) {
        saveImportedDocId(null);
        shareState.importedDocId = null;
      }
      set({ dialog: null, deleteError: null, loading: true, list: [] });
      return reloadCurrentTab();
    })
    .catch((err) => set({ deleteError: err.message || "刪除失敗" }));
}

// ---------------- 渲染 ----------------
function renderShare() {
  if (!mount) return;
  mount.innerHTML = shareState.open ? panelHtml() : "";
}

function formatDate(uploadedAt) {
  return uploadedAt?.toDate ? uploadedAt.toDate().toLocaleDateString("zh-TW") : "未知日期";
}

function tripItemHtml(trip) {
  const isImported = shareState.importedDocId === trip.id;
  const name = escapeHtml(trip.tripName || "（未命名）");
  return `
    <div class="share-trip-item ${isImported ? "is-imported" : ""}">
      <div class="share-trip-info">
        <div class="share-trip-name">📋 ${name}${isImported ? ' <span class="share-trip-badge">目前匯入</span>' : ""}</div>
        <div class="share-trip-date">${escapeHtml(formatDate(trip.uploadedAt))} 上傳</div>
      </div>
      <button class="btn btn--primary btn--sm" data-action="import-shared-trip" data-trip-id="${escapeAttr(trip.id)}">匯入</button>
      <button class="btn btn--ghost btn--sm" data-action="open-overwrite-dialog" data-trip-id="${escapeAttr(trip.id)}" data-trip-name="${escapeAttr(trip.tripName || "")}" title="覆蓋此行程">覆蓋</button>
      <button class="btn btn--ghost btn--sm" data-action="copy-trip-link" data-trip-id="${escapeAttr(trip.id)}">分享</button>
      <button class="btn btn--ghost btn--sm" data-action="open-manage-dialog" data-trip-id="${escapeAttr(trip.id)}" data-trip-name="${escapeAttr(trip.tripName || "")}">管理</button>
    </div>`;
}

function listHtml(emptyText) {
  if (shareState.loading) return `<div class="share-status">載入中…</div>`;
  if (shareState.error) return `<div class="share-status">⚠️ ${escapeHtml(shareState.error)}</div>`;
  if (!shareState.list.length) return `<div class="share-status">${escapeHtml(emptyText)}</div>`;
  return shareState.list.map(tripItemHtml).join("");
}

function publicTabHtml() {
  return `
    <button class="share-upload-btn" data-action="open-upload-dialog">↑ 上傳目前行程</button>
    ${listHtml("目前沒有共用的行程")}`;
}

function privateTabHtml() {
  const superUser = isSuperUser();
  const headerBar = superUser
    ? `<div class="share-su-banner">★ 超級模式全覽</div>`
    : `<div class="share-code-bar">
        <input id="private-code-input" class="share-input" placeholder="輸入暗號…" aria-label="私人暗號" />
        <button class="btn btn--primary btn--sm" data-action="query-private-trips">查詢</button>
      </div>`;
  const uploadBtn = `<button class="share-upload-btn" data-action="open-upload-dialog-private">↑ 上傳目前行程</button>`;

  let content;
  if (shareState.loading) {
    content = `<div class="share-status">載入中…</div>`;
  } else if (shareState.error) {
    content = `<div class="share-status">⚠️ ${escapeHtml(shareState.error)}</div>`;
  } else if (shareState.privateCodeQueried === null) {
    content = superUser
      ? `<div class="share-status">載入中…</div>`
      : `<div class="share-status">輸入暗號後按查詢以顯示行程</div>`;
  } else {
    content = listHtml(superUser ? "沒有非公開行程" : "暗號不存在");
  }
  return headerBar + uploadBtn + content;
}

function dialogHtml() {
  switch (shareState.dialog) {
    case "upload":
      return uploadDialogHtml();
    case "delete":
      return deleteDialogHtml();
    case "manage":
      return manageDialogHtml();
    case "overwrite":
      return overwriteDialogHtml();
    default:
      return "";
  }
}

function uploadDialogHtml() {
  const isPrivate = shareState.uploadVisibility === "private";
  return `
    <div class="share-dialog">
      <div class="share-dialog-title">上傳行程</div>
      <div class="share-dialog-label">公開設定</div>
      <div class="share-seg">
        <button class="btn btn--sm ${!isPrivate ? "btn--primary" : ""}" data-action="set-upload-visibility" data-val="public">公開</button>
        <button class="btn btn--sm ${isPrivate ? "btn--primary" : ""}" data-action="set-upload-visibility" data-val="private">非公開</button>
      </div>
      ${isPrivate ? `
        <div class="share-dialog-label">暗號（必填）</div>
        <input id="share-upload-code" class="share-input" placeholder="輸入暗號" value="${escapeAttr(shareState.uploadSecretCode)}" />
      ` : ""}
      <div class="share-dialog-label">刪除密碼（必填）</div>
      <input type="text" class="share-input pw-mask" id="share-upload-pw" placeholder="輸入刪除密碼" autocomplete="off" />
      <div class="share-error">${shareState.uploadError ? escapeHtml(shareState.uploadError) : ""}</div>
      <div class="share-dialog-actions">
        <button class="btn btn--sm" data-action="close-share-dialog">取消</button>
        <button class="btn btn--primary btn--sm" data-action="confirm-upload">上傳</button>
      </div>
    </div>`;
}

function deleteDialogHtml() {
  return `
    <div class="share-dialog">
      <div class="share-dialog-title">輸入刪除密碼</div>
      <input type="text" class="share-input pw-mask" id="share-delete-pw" placeholder="刪除密碼" autocomplete="off" />
      ${isSuperUser() ? '<div class="share-hint share-hint--success">★ 超級模式：可留空直接刪除</div>' : ""}
      <div class="share-error">${shareState.deleteError ? escapeHtml(shareState.deleteError) : ""}</div>
      <div class="share-dialog-actions">
        <button class="btn btn--sm" data-action="close-share-dialog">取消</button>
        <button class="btn btn--primary btn--sm" data-action="confirm-delete" data-trip-id="${escapeAttr(shareState.deleteTargetId)}">刪除</button>
      </div>
    </div>`;
}

function manageDialogHtml() {
  const mt = shareState.managingTrip;
  if (!mt) return "";
  if (shareState.manageView === "main") {
    return `
      <div class="share-dialog">
        <div class="share-dialog-title">管理：${escapeHtml(mt.tripName)}</div>
        <div class="share-seg">
          <button class="btn btn--sm" data-action="manage-change-pw-view">🔑 更換密碼</button>
          <button class="btn btn--sm btn--danger" data-action="manage-delete">🗑 刪除行程</button>
        </div>
        <div class="share-dialog-actions">
          <button class="btn btn--sm" data-action="close-share-dialog">取消</button>
        </div>
      </div>`;
  }
  return `
    <div class="share-dialog">
      <div class="share-dialog-title">
        <button class="btn btn--ghost btn--sm" data-action="manage-back">←</button>
        更換密碼：${escapeHtml(mt.tripName)}
      </div>
      <input type="text" class="share-input pw-mask" id="manage-old-pw" placeholder="舊密碼" autocomplete="off" />
      <input type="text" class="share-input pw-mask" id="manage-new-pw" placeholder="新密碼" autocomplete="off" />
      <div class="share-error">${shareState.manageError ? escapeHtml(shareState.manageError) : ""}</div>
      <div class="share-dialog-actions">
        <button class="btn btn--sm" data-action="close-share-dialog">取消</button>
        <button class="btn btn--primary btn--sm" data-action="manage-change-pw-submit" data-trip-id="${escapeAttr(mt.id)}">確認更換</button>
      </div>
    </div>`;
}

function overwriteDialogHtml() {
  const cur = getState().tripName;
  const namesDiffer = cur !== shareState.overwriteTargetName;
  return `
    <div class="share-dialog">
      <div class="share-dialog-title">覆蓋行程</div>
      ${namesDiffer ? `
        <div class="share-hint">目前行程：<strong>${escapeHtml(cur)}</strong><br>雲端行程：<strong>${escapeHtml(shareState.overwriteTargetName || "")}</strong></div>
        <div class="share-dialog-label">是否一併將雲端名稱更新為「${escapeHtml(cur)}」？</div>
        <div class="share-seg">
          <button class="btn btn--sm ${shareState.overwriteUpdateName ? "btn--primary" : ""}" data-action="set-overwrite-update-name" data-value="true">是</button>
          <button class="btn btn--sm ${!shareState.overwriteUpdateName ? "btn--primary" : ""}" data-action="set-overwrite-update-name" data-value="false">否</button>
        </div>` : ""}
      <input type="text" class="share-input pw-mask" id="share-update-pw" placeholder="輸入當初設定的密碼" autocomplete="off" />
      <div class="share-error">${shareState.updateError ? escapeHtml(shareState.updateError) : ""}</div>
      <div class="share-dialog-actions">
        <button class="btn btn--sm" data-action="close-share-dialog">取消</button>
        <button class="btn btn--primary btn--sm" data-action="confirm-overwrite" data-trip-id="${escapeAttr(shareState.overwriteTargetId)}">覆蓋</button>
      </div>
    </div>`;
}

function shareUrlBarHtml() {
  if (!shareState.shareUrl) return "";
  return `
    <div class="share-url-bar">
      <div class="share-url-bar__label">✅ 上傳成功！分享連結：</div>
      <div class="share-url-bar__row">
        <input class="share-input" readonly value="${escapeAttr(shareState.shareUrl)}" onclick="this.select()" />
        <button class="btn btn--primary btn--sm" data-action="copy-share-url" data-url="${escapeAttr(shareState.shareUrl)}">複製</button>
      </div>
    </div>`;
}

function superUserTriggerHtml() {
  const on = isSuperUser();
  return `
    <div class="share-su">
      <span class="share-su-trigger ${on ? "is-on" : ""}" data-action="toggle-superuser-prompt"
            title="${on ? "點擊取消超級模式" : ""}">${on ? "★ 超級模式" : "$"}</span>
      ${shareState.superuserPromptOpen ? `
        <div class="share-su-form">
          <input id="su-pw-input" class="share-input" type="password" maxlength="20" placeholder="密碼" autocomplete="off" />
          <button class="btn btn--primary btn--sm" data-action="submit-superuser-pw">確認</button>
        </div>` : ""}
    </div>`;
}

function tab(id, label) {
  const active = shareState.shareTab === id;
  return `<button class="share-tab ${active ? "is-active" : ""}" data-action="switch-share-tab" data-tab="${id}" aria-pressed="${active}">${label}</button>`;
}

function panelHtml() {
  const body = shareState.shareTab === "public" ? publicTabHtml() : privateTabHtml();
  return `
    <div class="share-backdrop" data-action="close-share" aria-hidden="true"></div>
    <div class="share-panel" role="dialog" aria-modal="true" aria-label="雲端共用區">
      <div class="share-header">
        <span>☁️ 共用區</span>
        <button class="btn btn--icon btn--ghost" data-action="close-share" aria-label="關閉共用區">✕</button>
      </div>
      <div class="share-tabs" role="tablist">
        ${tab("public", "公開")}
        ${tab("private", "非公開")}
      </div>
      ${shareUrlBarHtml()}
      <div class="share-body">${body}</div>
      ${superUserTriggerHtml()}
    </div>
    ${dialogHtml()}`;
}
