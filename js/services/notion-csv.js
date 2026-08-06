/* ============================================================
   services/notion-csv.js — 純函式：CSV parse/serialize、
   時長/日期解析、欄位簽名辨識、類別/交通對映。
   ============================================================ */

/** 解析 CSV 文字 → 二維陣列（RFC4180 子集：支援引號、逗號、換行、"" 跳脫） */
export function parseCsv(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [], cell = "", i = 0, inQ = false;
  while (i < s.length) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      cell += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(cell); cell = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; continue; }
    cell += c; i++;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 二維陣列 → CSV 文字（BOM + CRLF） */
export function serializeCsv(rows) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** "2 hrs 45 mins" → 165（分）；無法解析回 0 */
export function parseDuration(str) {
  const s = String(str || "");
  const h = /(\d+)\s*(?:hrs?|hours?|h)\b/i.exec(s);
  const m = /(\d+)\s*(?:mins?|minutes?|m)\b/i.exec(s);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

/** 165 → "2 hrs 45 mins"；<=0 回 "" */
export function formatDuration(mins) {
  const n = Math.max(0, Math.floor(mins || 0));
  if (n <= 0) return "";
  const h = Math.floor(n / 60), m = n % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? "hr" : "hrs"}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? "min" : "mins"}`);
  return parts.join(" ");
}

const MONTHS = { January:1, February:2, March:3, April:4, May:5, June:6, July:7, August:8, September:9, October:10, November:11, December:12 };

function toClock(hh, mm, ampm) {
  let h = Number(hh);
  if (ampm) {
    const up = ampm.toUpperCase();
    if (up === "PM" && h < 12) h += 12;
    if (up === "AM" && h === 12) h = 0;
  }
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** 解析 Notion 日期字串 → { isoDate, startClock, endClock } */
export function parseNotionDate(str) {
  const s = String(str || "");
  const out = { isoDate: "", startClock: "", endClock: "" };
  const dm = /([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (dm && MONTHS[dm[1]]) {
    out.isoDate = `${dm[3]}-${String(MONTHS[dm[1]]).padStart(2, "0")}-${String(dm[2]).padStart(2, "0")}`;
  }
  // 起始時刻：日期後第一個 H:MM（可含 AM/PM）
  const t1 = /\d{4}\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(s);
  if (t1) out.startClock = toClock(t1[1], t1[2], t1[3]);
  // 結束時刻：箭頭後的 H:MM（可含 AM/PM）
  const t2 = /→\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(s);
  if (t2) out.endClock = toClock(t2[1], t2[2], t2[3]);
  return out;
}

/** 欄位簽名辨識 CSV 類型（忽略檔名/語言） */
export function detectCsvType(header) {
  const h = new Set((header || []).map((x) => String(x).trim()));
  const has = (...ks) => ks.every((k) => h.has(k));
  if (has("Details") && (h.has("移動方式") || h.has("類別"))) return "itinerary";
  if (h.has("航空公司") && h.has("飛行時間")) return "flight";
  if (h.has("Name") && h.has("筆記") && h.has("城市")) return "guide";
  if (h.has("Name") && (h.has("付款類型") || h.has("花費")) && h.has("日期")) return "accommodation";
  return null;
}

// ---- 類別對映 ----
const CATEGORY_TO_ENUM = {
  "景點參觀": "sightseeing", "景點": "sightseeing", "參觀": "sightseeing",
  "早餐": "food", "午餐": "food", "晚餐": "food", "餐飲": "food", "美食": "food", "用餐": "food",
  "逛街": "shopping", "購物": "shopping",
  "自由活動": "activity", "體驗": "activity", "活動": "activity",
  "住宿": "hotel",
  "交通": "transit",
};
const ENUM_TO_CATEGORY = {
  sightseeing: "景點參觀", food: "餐飲", shopping: "購物",
  transit: "交通", hotel: "住宿", activity: "自由活動", other: "其他",
};
export function notionCategoryToEnum(zh) {
  const first = String(zh || "").split(",")[0].trim();
  return CATEGORY_TO_ENUM[first] || null;
}
export function enumCategoryToNotion(id) { return ENUM_TO_CATEGORY[id] || ""; }

// ---- 交通對映 ----
const TRANSPORT_TO_ENUM = {
  "步行": "walking", "走路": "walking",
  "JR": "transit", "地鐵": "transit", "電車": "transit", "新幹線": "transit",
  "公車": "transit", "巴士": "transit", "觀光船": "transit", "船": "transit", "大眾運輸": "transit",
  "包車接送": "driving", "包車": "driving", "計程車": "driving", "開車": "driving", "自駕": "driving", "租車": "driving",
  "飛機": "flight", "航班": "flight", "班機": "flight",
};
const ENUM_TO_TRANSPORT = { walking: "步行", transit: "大眾運輸", driving: "開車", flight: "飛機" };
export function notionTransportToEnum(zh) {
  const parts = String(zh || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return { id: null, overflow: "" };
  const first = parts[0];
  const id = TRANSPORT_TO_ENUM[first] || null;
  const overflowParts = parts.slice(1);
  return { id, overflow: overflowParts.filter((p) => p !== undefined).join(", ") };
}
export function enumTransportToNotion(id) { return ENUM_TO_TRANSPORT[id] || ""; }
