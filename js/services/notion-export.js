/* ============================================================
   services/notion-export.js — 純函式：Trip → Notion 可 import 的
   檔案集（Markdown 頁面 + CSV 資料庫），鏡像 Notion 匯出結構。
   ============================================================ */
import { serializeCsv, formatDuration, enumCategoryToNotion, enumTransportToNotion } from "./notion-csv.js";
import { safeFileStem } from "./export.js";
import { computeTimeline } from "../timeline.js";
import { getDayIsoDate, routeKey, hotelStartId } from "../utils.js";

const enc = new TextEncoder();
const file = (path, str) => ({ path, bytes: enc.encode(str) });

/** 32-bit 字串雜湊（FNV-1a 變體 + final mix），純同步 */
function h32(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193) >>> 0;
  }
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae3d) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** 確定性 32-hex ID（4 段 32-bit hash 串接），鏡像 Notion 的 32 碼 hex 檔名慣例 */
export function notionId(seed) {
  const s = String(seed);
  return [0x811c9dc5, 0x01000193, 0xdeadbeef, 0xcafebabe]
    .map((sd) => h32(s, sd).toString(16).padStart(8, "0"))
    .join("");
}

function itineraryRecords(state) {
  const out = [];
  (state.days || []).forEach((day, di) => {
    const iso = getDayIsoDate(state.tripStartDate, di);
    const slots = computeTimeline(day, state.routes);
    let prevId = hotelStartId(day.id);
    (day.spots || []).forEach((spot) => {
      const rk = routeKey(prevId, spot.id);
      const route = (state.routes || {})[rk] || {};
      const rt = route.recordedTime || 0;
      if (rt > 0) {
        const prevName = prevId === hotelStartId(day.id)
          ? (day.startHotelName || "出發")
          : ((day.spots.find((s) => s.id === prevId) || {}).name || "");
        const rslot = slots[rk] || {};
        out.push({ dayId: day.id, values: {
          Details: `${prevName} - ${spot.name}`, Day: day.label,
          "日期": dateCell(iso, rslot.start, rslot.end),
          "移動方式": enumTransportToNotion(route.transport),
          "時間": formatDuration(rt),
          "備註": route.note || "",
        } });
      }
      const slot = slots[spot.id] || {};
      out.push({ dayId: day.id, values: {
        Details: spot.name, Day: day.label,
        "日期": dateCell(iso, slot.start, slot.end),
        "時間": formatDuration(spot.stayDuration),
        "類別": enumCategoryToNotion(spot.category),
        "營業時間": spot.openingHours || "",
        "備註": spot.notes || "",
        "圖片": spot.imageUrl || "",
        "地址": spot.resolvedAddress || "",
      } });
      prevId = spot.id;
    });
  });
  return out;
}

function accRecord(a) {
  const range = a.checkIn
    ? `${isoToNotionDate(a.checkIn)}${a.checkOut ? " → " + isoToNotionDate(a.checkOut) : ""}`
    : "";
  return { values: {
    Name: a.name || "", image: a.imageUrl || "", "付款類型": a.paymentStatus || "",
    "位置": a.mapUrl || "", "地址": a.address || "", "城市": a.city || "",
    "日期": range, "網址": a.bookingUrl || "", "花費": a.cost || "", "類型": a.type || "",
  } };
}

function flightRecord(f) {
  return { values: {
    Transport: f.direction || "", "No.": f.flightNo || "",
    "出發時間": f.departTime || "", "出發機場": f.fromAirport || "",
    "抵達時間": f.arriveTime || "", "抵達機場": f.toAirport || "",
    "等級": f.cabin || "", "航空公司": f.airline || "",
    "類型": f.international ? "International" : "Domestic",
    "飛行時間": f.duration || "",
  } };
}

function guideRecord(g) {
  return { values: {
    Name: g.title || "", "圖片": g.imageUrl || "", "城市": g.city || "", "筆記": "",
  }, body: g.body || "" };
}

/** state → 各 DB 的正規化 records（僅 app 現有資料） */
export function buildRecords(state) {
  return {
    "行程": itineraryRecords(state),
    "住宿": (state.accommodations || []).map(accRecord),
    "交通": (state.flights || []).map(flightRecord),
    "旅遊攻略": (state.guides || []).map(guideRecord),
  };
}

/** 各 DB 的欄位規格（順序完全照 Notion template） */
export const DB_SPECS = {
  "行程": {
    titleProp: "Details",
    viewCols: ["Details", "日期", "時間", "類別", "移動方式", "營業時間", "備註"],
    allCols: ["Details", "Day", "備註", "圖片", "地址", "日期", "時間", "營業時間", "移動方式", "類別"],
    pageProps: ["日期", "類別", "時間", "備註", "圖片", "營業時間", "地址"],
  },
  "住宿": {
    titleProp: "Name",
    viewCols: ["Name", "類型", "地址", "image", "日期", "位置", "付款類型", "花費", "網址", "城市"],
    allCols: ["Name", "image", "付款類型", "位置", "地址", "城市", "日期", "網址", "花費", "類型"],
    pageProps: ["類型", "地址", "image", "日期", "位置", "付款類型", "花費", "網址", "城市"],
  },
  "交通": {
    titleProp: "Transport",
    viewCols: ["航空公司", "Transport", "No.", "等級", "出發機場", "出發時間", "抵達機場", "抵達時間", "飛行時間", "類型"],
    allCols: ["Transport", "No.", "出發時間", "出發機場", "抵達時間", "抵達機場", "等級", "航空公司", "類型", "飛行時間"],
    pageProps: ["航空公司", "類型", "No.", "等級", "出發時間", "出發機場", "飛行時間", "抵達時間", "抵達機場"],
  },
  "旅遊攻略": {
    titleProp: "Name",
    viewCols: ["Name"],
    allCols: ["Name", "圖片", "城市", "筆記"],
    pageProps: ["圖片", "城市"],
    hasBody: true,
  },
};

/** 依 DB 規格產出檢視 CSV + _all CSV + 每列 per-row 子頁 md */
export function emitDbFiles(stem, dbName, records, dbId) {
  const spec = DB_SPECS[dbName];
  const files = [];
  const toRows = (cols) => [cols, ...records.map((r) => cols.map((c) => r.values[c] ?? ""))];
  files.push(file(`${stem}/${dbName} ${dbId}.csv`, serializeCsv(toRows(spec.viewCols))));
  files.push(file(`${stem}/${dbName} ${dbId}_all.csv`, serializeCsv(toRows(spec.allCols))));
  records.forEach((r, i) => {
    const title = r.values[spec.titleProp] || "Untitled";
    const seed = dbName === "行程"
      ? `row:行程:${title}:${r.dayId}:${i}`
      : `row:${dbName}:${title}:${i}`;
    const id = notionId(seed);
    const lines = [`# ${title}`, ""];
    for (const p of spec.pageProps) {
      const v = r.values[p];
      if (v) lines.push(`${p}: ${v}`);
    }
    if (spec.hasBody && r.body) lines.push("", r.body);
    files.push(file(`${stem}/${dbName}/${safeFileStem(title)} ${id}.md`, lines.join("\n")));
  });
  return files;
}

/** "2026-07-15" → "July 15, 2026" */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function isoToNotionDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}
/** 組行程 日期欄："July 15, 2026 09:00 (GMT+8) → 10:30" */
function dateCell(iso, start, end) {
  if (!iso) return "";
  const base = isoToNotionDate(iso);
  if (!start) return base;
  return `${base} ${start} (GMT+8)` + (end ? ` → ${end}` : "");
}

/** 頂層導覽頁：快速導覽（URL-encoded 相對連結）+ 待辦 + 備註 */
export function buildTopMd(state, links) {
  const lines = [`# ${state.tripName}`, ""];
  if (links.length) {
    lines.push("## 快速導覽", "", "---", "");
    for (const l of links) lines.push(`[${l.name}](${encodeURI(l.csvPath)})`);
    lines.push("", "---", "");
  }
  const todos = state.todos || [];
  if (todos.length) {
    lines.push("## 待辦事項", "");
    for (const t of todos) lines.push(`- [${t.done ? "x" : " "}] ${t.text}`);
    lines.push("");
  }
  if (state.notes) lines.push("## 備註", "", state.notes, "");
  return lines.join("\n");
}

/** Trip → Notion 原生匯出檔案集（鏡像結構） */
export function tripToNotionFiles(state) {
  const stem = safeFileStem(state.tripName);
  const recs = buildRecords(state);
  const order = ["行程", "住宿", "交通", "旅遊攻略"];
  const dbMeta = order
    .filter((n) => recs[n] && recs[n].length)
    .map((n) => ({ name: n, id: notionId(`db:${n}`) }));
  const links = dbMeta.map((m) => ({ name: m.name, csvPath: `${stem}/${m.name} ${m.id}.csv` }));
  const files = [file(`${stem} ${notionId(state.tripName)}.md`, buildTopMd(state, links))];
  for (const m of dbMeta) files.push(...emitDbFiles(stem, m.name, recs[m.name], m.id));
  return files;
}
