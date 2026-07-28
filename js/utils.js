/* ============================================================
   utils.js — 純函式工具：ID、跳脫、時間運算、分類、日期
   全部無副作用，供 Vitest 單元測試。
   ============================================================ */

/** 產生短 ID（time36 + random36） */
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** HTML 跳脫，防止 XSS（innerHTML 全量渲染前必用） */
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 屬性值跳脫（用於 value="..."） */
export function escapeAttr(str) {
  return escapeHtml(str);
}

/** "HH:MM" + 分鐘 → "HH:MM"（24h wrap，跨午夜安全） */
export function addMinsToHHMM(hhmm, mins) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + (mins | 0);
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "HH:MM" → 當日分鐘數（null 安全） */
export function hhmmToMins(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 分鐘 → "2h 30m" / "45m"（空值回傳 null） */
export function fmtMins(m) {
  if (!m || m <= 0) return null;
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0 && min > 0) return `${h}h ${min}m`;
  if (h > 0) return `${h}h`;
  return `${min}m`;
}

/** 路線鍵：from→to */
export function routeKey(fromId, toId) {
  return `${fromId}→${toId}`;
}

export function hotelStartId(dayId) { return "hs_" + dayId; }
export function hotelEndId(dayId) { return "he_" + dayId; }

/** 依 tripStartDate + 天索引，回傳 "7/27(日)" 顯示字串 */
export function getDayDate(tripStartDate, dayIndex) {
  if (!tripStartDate) return "";
  const d = new Date(tripStartDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + dayIndex);
  const w = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}/${d.getDate()}(${w[d.getDay()]})`;
}

/** 依 tripStartDate + 天索引，回傳 ISO 日期 "YYYY-MM-DD"（本地時區安全） */
export function getDayIsoDate(tripStartDate, dayIndex) {
  if (!tripStartDate) return "";
  const d = new Date(tripStartDate + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + dayIndex);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 7 個景點分類 */
export const SPOT_CATEGORIES = [
  { id: "sightseeing", label: "景點", emoji: "🏛" },
  { id: "food", label: "餐廳", emoji: "🍽" },
  { id: "shopping", label: "購物", emoji: "🛍" },
  { id: "transit", label: "交通樞紐", emoji: "🚉" },
  { id: "hotel", label: "住宿", emoji: "🏨" },
  { id: "activity", label: "體驗活動", emoji: "🎯" },
  { id: "other", label: "其他", emoji: "📌" },
];

export function getCategory(id) {
  return SPOT_CATEGORIES.find((c) => c.id === id) || null;
}

/** 交通方式 */
export const TRANSPORT_MODES = [
  { id: "walking", emoji: "🚶", label: "步行" },
  { id: "transit", emoji: "🚆", label: "大眾運輸" },
  { id: "driving", emoji: "🚗", label: "開車" },
];

/** 4 個主題 */
export const THEMES = ["cream", "light", "dark", "cyberpunk"];
