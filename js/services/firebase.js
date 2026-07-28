/* ============================================================
   services/firebase.js — 雲端共用傳輸層（Firebase Firestore compat）
   ------------------------------------------------------------
   安全模型（見 docs/adr/0004）：
   - 內建共用的 web config 不是機密；projectId 為空時整個雲端功能停用。
   - 前端密碼／暗號只以 SHA-256 hash 落地，明文永不儲存。
   - 這層前端密碼為「盡力而為」，非加密級授權；真正邊界在 firestore.rules。
   - 文件形狀（見 docs/functional-spec.md §14.2）：
       { tripName, uploadedAt, data:<完整 state>, deletePasswordHash,
         visibility:"public"|"private", secretCodeHash:string|null }
   compat SDK 由 index.html 的 <script> 掛在 window.firebase；此模組延後於其後執行。
   ============================================================ */

const COLLECTION = "shared_trips";
const SUPERUSER_KEY = "tour-planner-superuser";

// 內建共用專案（web config 非機密，見 ADR-0004）
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBAr2CDUSzkLs5cUHX2ubGHiWmjeADVeb4",
  authDomain: "tour-planner-2ca53.firebaseapp.com",
  projectId: "tour-planner-2ca53",
  storageBucket: "tour-planner-2ca53.firebasestorage.app",
  messagingSenderId: "1077556372531",
  appId: "1:1077556372531:web:29aa2258c73107d42e2f46",
};

/** 雲端功能是否啟用（projectId 為空 或 SDK 未載入 → 停用） */
export function isCloudEnabled() {
  return Boolean(FIREBASE_CONFIG.projectId && typeof window !== "undefined" && window.firebase);
}

/** 取得 Firestore 實例（惰性初始化）；未啟用時回傳 null */
function getFirestore() {
  if (!isCloudEnabled()) return null;
  const fb = window.firebase;
  if (!fb.apps.length) fb.initializeApp(FIREBASE_CONFIG);
  return fb.firestore();
}

function serverTimestamp() {
  return window.firebase.firestore.FieldValue.serverTimestamp();
}

/** SHA-256（hex）；明文密碼／暗號絕不落地，只存此雜湊 */
export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------- 超級模式（純 UI 便利，非權限邊界；見 ADR-0004） ----------------
export function isSuperUser() {
  try {
    return localStorage.getItem(SUPERUSER_KEY) === "1";
  } catch (_) {
    return false;
  }
}
export function setSuperUser(on) {
  try {
    if (on) localStorage.setItem(SUPERUSER_KEY, "1");
    else localStorage.removeItem(SUPERUSER_KEY);
  } catch (_) {
    /* 隱私模式：忽略 */
  }
}

// ---------------- 查詢 ----------------
/** 讀取所有公開行程（依上傳時間新→舊） */
export async function fetchPublicTrips() {
  const db = getFirestore();
  if (!db) return [];
  const snap = await db
    .collection(COLLECTION)
    .where("visibility", "==", "public")
    .orderBy("uploadedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 依暗號查詢私人行程（暗號先 hash 再比對） */
export async function fetchPrivateTrips(code) {
  if (!code) return [];
  const db = getFirestore();
  if (!db) return [];
  const hash = await sha256(code);
  const snap = await db
    .collection(COLLECTION)
    .where("secretCodeHash", "==", hash)
    .orderBy("uploadedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 超級模式：讀取所有私人行程 */
export async function fetchAllPrivateTrips() {
  const db = getFirestore();
  if (!db) return [];
  const snap = await db
    .collection(COLLECTION)
    .where("visibility", "==", "private")
    .orderBy("uploadedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------- 寫入 ----------------
/**
 * 上傳目前行程；回傳新文件 docId。
 * @param {object} state 完整行程狀態（存入 data 信封）
 * @param {string} password 刪除密碼（明文，僅用來算 hash）
 * @param {"public"|"private"} visibility
 * @param {string|null} secretCode 私人暗號（private 時必填）
 */
export async function uploadTripToCloud(state, password, visibility = "public", secretCode = null) {
  const db = getFirestore();
  if (!db) throw new Error("雲端功能未啟用");
  const deletePasswordHash = await sha256(password);
  const secretCodeHash =
    visibility === "private" && secretCode ? await sha256(secretCode) : null;
  const ref = await db.collection(COLLECTION).add({
    tripName: state.tripName,
    uploadedAt: serverTimestamp(),
    data: state,
    deletePasswordHash,
    visibility,
    secretCodeHash,
  });
  return ref.id;
}

/** 覆寫雲端行程（需通過刪除密碼驗證）；同步更新 data / tripName / uploadedAt */
export async function updateTripInCloud(docId, password, state, tripName = state.tripName) {
  const db = getFirestore();
  if (!db) throw new Error("雲端功能未啟用");
  const doc = await db.collection(COLLECTION).doc(docId).get();
  if (!doc.exists) throw new Error("記錄不存在");
  const hash = await sha256(password);
  if (hash !== doc.data().deletePasswordHash) throw new Error("密碼錯誤");
  await db.collection(COLLECTION).doc(docId).update({
    tripName,
    uploadedAt: serverTimestamp(),
    data: state,
  });
}

/** 更換刪除密碼（需通過舊密碼驗證） */
export async function changeTripPassword(docId, oldPw, newPw) {
  const db = getFirestore();
  if (!db) throw new Error("雲端功能未啟用");
  const doc = await db.collection(COLLECTION).doc(docId).get();
  if (!doc.exists) throw new Error("記錄不存在");
  const oldHash = await sha256(oldPw);
  if (oldHash !== doc.data().deletePasswordHash) throw new Error("密碼錯誤");
  const newHash = await sha256(newPw);
  await db.collection(COLLECTION).doc(docId).update({ deletePasswordHash: newHash });
}

/** 刪除雲端行程（需通過刪除密碼驗證） */
export async function deleteSharedTrip(docId, password) {
  const db = getFirestore();
  if (!db) throw new Error("雲端功能未啟用");
  const doc = await db.collection(COLLECTION).doc(docId).get();
  if (!doc.exists) throw new Error("記錄不存在");
  const hash = await sha256(password);
  if (hash !== doc.data().deletePasswordHash) throw new Error("密碼錯誤");
  await db.collection(COLLECTION).doc(docId).delete();
}

/** 超級模式刪除（不驗密碼；純前端便利，非權限邊界） */
export async function deleteSharedTripAsAdmin(docId) {
  const db = getFirestore();
  if (!db) throw new Error("雲端功能未啟用");
  await db.collection(COLLECTION).doc(docId).delete();
}

/** 取回文件內的完整 state（data 信封） */
export async function getSharedTripData(docId) {
  const db = getFirestore();
  if (!db) throw new Error("雲端功能未啟用");
  const doc = await db.collection(COLLECTION).doc(docId).get();
  if (!doc.exists) throw new Error("記錄不存在");
  return doc.data().data;
}
