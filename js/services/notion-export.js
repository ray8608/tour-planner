/* ============================================================
   services/notion-export.js — 純函式：Trip → Notion 可 import 的
   檔案集（Markdown 頁面 + CSV 資料庫），鏡像 Notion 匯出結構。
   ============================================================ */
import { serializeCsv, formatDuration, enumCategoryToNotion, enumTransportToNotion } from "./notion-csv.js";
import { safeFileStem } from "./export.js";
import { computeTimeline } from "../timeline.js";
import { getDayIsoDate, routeKey, hotelStartId, hotelEndId } from "../utils.js";

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

function buildItineraryCsv(state) {
  const header = ["日期", "Day", "Details", "類別", "移動方式", "時間", "備註", "營業時間", "圖片", "地址", "緯度", "經度"];
  const rows = [header];
  state.days.forEach((day, di) => {
    const iso = getDayIsoDate(state.tripStartDate, di);
    const slots = computeTimeline(day, state.routes);
    let prevId = hotelStartId(day.id);
    day.spots.forEach((spot) => {
      // 先輸出前一段交通（若有 recordedTime）
      const rk = routeKey(prevId, spot.id);
      const rt = (state.routes[rk] || {}).recordedTime || 0;
      if (rt > 0) {
        const prevName = prevId === hotelStartId(day.id) ? (day.startHotelName || "出發") : (day.spots.find((s) => s.id === prevId)?.name || "");
        const rslot = slots[rk] || {};
        rows.push([
          dateCell(iso, rslot.start, rslot.end), day.label, `${prevName} - ${spot.name}`,
          "", enumTransportToNotion((state.routes[rk] || {}).transport), formatDuration(rt),
          "", "", "", "", "", "",
        ]);
      }
      const slot = slots[spot.id] || {};
      rows.push([
        dateCell(iso, slot.start, slot.end), day.label, spot.name,
        enumCategoryToNotion(spot.category), "", formatDuration(spot.stayDuration),
        spot.notes || "", spot.openingHours || "", spot.imageUrl || "", spot.resolvedAddress || "",
        spot.lat != null ? spot.lat : "", spot.lng != null ? spot.lng : "",
      ]);
      prevId = spot.id;
    });
  });
  return serializeCsv(rows);
}

function buildAccommodationCsv(list) {
  const header = ["Name", "image", "付款類型", "位置", "地址", "城市", "日期", "網址", "花費", "類型"];
  const rows = [header];
  for (const a of list) {
    const range = a.checkIn ? `${isoToNotionDate(a.checkIn)}${a.checkOut ? " → " + isoToNotionDate(a.checkOut) : ""}` : "";
    rows.push([a.name, a.imageUrl, a.paymentStatus, a.mapUrl, a.address, a.city, range, a.bookingUrl, a.cost, a.type]);
  }
  return serializeCsv(rows);
}

function buildFlightCsv(list) {
  const header = ["Transport", "No.", "出發時間", "出發機場", "抵達時間", "抵達機場", "等級", "航空公司", "類型", "飛行時間"];
  const rows = [header];
  for (const f of list) {
    rows.push([f.direction, f.flightNo, f.departTime, f.fromAirport, f.arriveTime, f.toAirport, f.cabin, f.airline, f.international ? "International" : "Domestic", f.duration]);
  }
  return serializeCsv(rows);
}

function buildGuideCsv(list) {
  const header = ["Name", "圖片", "城市", "筆記"];
  const rows = [header];
  for (const g of list) rows.push([g.title, g.imageUrl, g.city, ""]);
  return serializeCsv(rows);
}

function buildTopMd(state) {
  const lines = [`# ${state.tripName}`, ""];
  if (state.todos.length) {
    lines.push("## 待辦事項", "");
    for (const t of state.todos) lines.push(`- [${t.done ? "x" : " "}] ${t.text}`);
    lines.push("");
  }
  if (state.notes) { lines.push("## 備註", "", state.notes, ""); }
  return lines.join("\n");
}

/** Trip → Notion 檔案集 */
export function tripToNotionFiles(state) {
  const stem = safeFileStem(state.tripName);
  const files = [file(`${stem}.md`, buildTopMd(state))];
  files.push(file(`${stem}/行程.csv`, buildItineraryCsv(state)));
  if (state.accommodations?.length) files.push(file(`${stem}/住宿.csv`, buildAccommodationCsv(state.accommodations)));
  if (state.flights?.length) files.push(file(`${stem}/交通.csv`, buildFlightCsv(state.flights)));
  if (state.guides?.length) {
    files.push(file(`${stem}/旅遊攻略.csv`, buildGuideCsv(state.guides)));
    for (const g of state.guides) {
      files.push(file(`${stem}/旅遊攻略/${safeFileStem(g.title)}.md`, `# ${g.title}\n\n${g.body || ""}`));
    }
  }
  return files;
}
