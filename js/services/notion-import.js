/* ============================================================
   services/notion-import.js — 純函式：Notion 匯出檔案集 → Trip
   取代式匯入的資料建構層（實際 importState 由 app.js 呼叫）。
   ============================================================ */
import {
  parseCsv, detectCsvType, parseDuration, parseNotionDate,
  notionCategoryToEnum, notionTransportToEnum,
} from "./notion-csv.js";
import { genId, routeKey, hotelStartId, hotelEndId } from "../utils.js";
import { defaultState, makeSpot, makeDay } from "../state.js";

const dec = new TextDecoder();
const text = (f) => dec.decode(f.bytes);

/**
 * Notion 會把同一個資料庫匯出成多份 CSV（主檢視 + `_all` 版 + 其他檢視），
 * 內容重複、僅欄位順序/齊全度不同。若全部合併會產生重複資料，故每個型別
 * 只取「最完整」的一份：欄位最多者優先，其次列數最多者。
 */
function pickBest(list) {
  if (!list.length) return [];
  const best = list.slice().sort((a, b) =>
    (b.header.length - a.header.length) || (b.rows.length - a.rows.length)
  )[0];
  return [best];
}

/** 把 {path,bytes}[] 依類型分類（取 header 判斷；每型別只留最完整一份） */
function classify(files) {
  const csvs = files.filter((f) => /\.csv$/i.test(f.path));
  const groups = { itinerary: [], accommodation: [], flight: [], guide: [] };
  for (const f of csvs) {
    const rows = parseCsv(text(f));
    if (!rows.length) continue;
    const type = detectCsvType(rows[0]);
    if (type) groups[type].push({ header: rows[0], rows: rows.slice(1) });
  }
  groups.itinerary = pickBest(groups.itinerary);
  groups.accommodation = pickBest(groups.accommodation);
  groups.flight = pickBest(groups.flight);
  groups.guide = pickBest(groups.guide);
  return groups;
}

/** header + row → 物件（以欄名取值） */
function rowObj(header, row) {
  const o = {};
  header.forEach((h, i) => { o[String(h).trim()] = (row[i] ?? "").trim(); });
  return o;
}

function buildDays(itinGroups, report) {
  // 收集所有行程列，去重（Details+日期；Notion 多檢視可能缺 Day 欄故不納入 key）
  const seen = new Set();
  const recs = [];
  for (const g of itinGroups) {
    for (const row of g.rows) {
      const o = rowObj(g.header, row);
      if (!o.Details && !o["日期"]) continue;
      const key = `${o.Details}|${o["日期"]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      recs.push(o);
    }
  }
  // Notion 檢視匯出的列序不保證按時間排序，先依日期+起始時刻排序，
  // 確保天別分組、天內順序與交通段綁定皆正確。
  recs.forEach((o) => { o.__d = parseNotionDate(o["日期"] || ""); });
  recs.sort((a, b) => {
    const ka = `${a.__d.isoDate} ${a.__d.startClock}`;
    const kb = `${b.__d.isoDate} ${b.__d.startClock}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  // 依 Day 分組（保序）
  const dayOrder = [];
  const byDay = new Map();
  for (const o of recs) {
    const dk = o.Day || "Day 1";
    if (!byDay.has(dk)) { byDay.set(dk, []); dayOrder.push(dk); }
    byDay.get(dk).push(o);
  }

  const days = [];
  const routes = {};
  let tripStart = "";
  let spotCount = 0, legCount = 0;

  dayOrder.forEach((dk, di) => {
    const day = makeDay(di + 1);
    day.label = dk;
    const list = byDay.get(dk);
    let firstClock = "";
    let prevSpotId = hotelStartId(day.id);
    let pendingLeg = null; // 前一列若為交通段，暫存到下個景點

    for (const o of list) {
      const date = o.__d || parseNotionDate(o["日期"] || "");
      if (date.isoDate && (!tripStart || date.isoDate < tripStart)) tripStart = date.isoDate;
      if (!firstClock && date.startClock) firstClock = date.startClock;

      const mins = parseDuration(o["時間"] || "");
      const isLeg = !!(o["移動方式"] && o["移動方式"].trim());

      if (isLeg) {
        const t = notionTransportToEnum(o["移動方式"]);
        pendingLeg = { transport: t.id || "transit", recordedTime: mins, overflow: t.overflow, details: o.Details, note: o["備註"] || "" };
        legCount++;
      } else {
        const sp = makeSpot(o.Details || "");
        sp.stayDuration = mins;
        sp.notes = o["備註"] || "";
        sp.category = notionCategoryToEnum(o["類別"] || "");
        sp.openingHours = o["營業時間"] || "";
        sp.imageUrl = o["圖片"] || "";
        sp.resolvedAddress = o["地址"] || "";
        // lat/lng：Notion 無座標 → 留 null
        day.spots.push(sp);
        spotCount++;
        // 綁定前一段交通到 prevSpot→此景點
        if (pendingLeg) {
          const rk = routeKey(prevSpotId, sp.id);
          routes[rk] = { transport: pendingLeg.transport, recordedTime: pendingLeg.recordedTime, ...(pendingLeg.note ? { note: pendingLeg.note } : {}) };
          if (pendingLeg.overflow) sp.notes = [sp.notes, `交通：${pendingLeg.overflow}`].filter(Boolean).join(" / ");
          pendingLeg = null;
        }
        prevSpotId = sp.id;
      }
    }
    // 收尾未綁定的交通段 → prevSpot→返回飯店
    if (pendingLeg) {
      const rk = routeKey(prevSpotId, hotelEndId(day.id));
      routes[rk] = { transport: pendingLeg.transport, recordedTime: pendingLeg.recordedTime, ...(pendingLeg.note ? { note: pendingLeg.note } : {}) };
    }
    day.startTime = firstClock || "";
    days.push(day);
  });

  report.counts.days = days.length;
  report.counts.spots = spotCount;
  report.counts.legs = legCount;
  return { days, routes, tripStart };
}

function buildAccommodations(groups) {
  const out = [];
  for (const g of groups) for (const row of g.rows) {
    const o = rowObj(g.header, row);
    if (!o.Name) continue;
    const d = parseNotionDate(o["日期"] || "");
    // 退房日：箭頭後第二個日期
    const parts = String(o["日期"] || "").split("→");
    const co = parts[1] ? parseNotionDate(parts[1]) : { isoDate: "" };
    out.push({
      id: genId(), name: o.Name, type: o["類型"] || "", address: o["地址"] || "",
      mapUrl: o["位置"] || "", city: o["城市"] || "", checkIn: d.isoDate,
      checkOut: co.isoDate, cost: o["花費"] || "", paymentStatus: o["付款類型"] || "",
      bookingUrl: o["網址"] || "", imageUrl: o["image"] || o["圖片"] || "",
    });
  }
  return out;
}

function buildFlights(groups) {
  const out = [];
  for (const g of groups) for (const row of g.rows) {
    const o = rowObj(g.header, row);
    if (!o["航空公司"] && !o["No."]) continue; // 略過空白列
    out.push({
      id: genId(), direction: o.Transport || "", airline: o["航空公司"] || "",
      flightNo: o["No."] || "", cabin: o["等級"] || "",
      fromAirport: o["出發機場"] || "", departTime: o["出發時間"] || "",
      toAirport: o["抵達機場"] || "", arriveTime: o["抵達時間"] || "",
      duration: o["飛行時間"] || "", international: /International|國際/i.test(o["類型"] || ""),
    });
  }
  return out;
}

function buildGuides(groups, files) {
  const out = [];
  const mdFiles = files.filter((f) => /\.md$/i.test(f.path));
  for (const g of groups) for (const row of g.rows) {
    const o = rowObj(g.header, row);
    if (!o.Name) continue;
    // 子頁 md：檔名（去 hash 前）以 guide 名稱開頭
    const md = mdFiles.find((f) => {
      const base = f.path.split("/").pop().replace(/\s+[0-9a-f]{32}\.md$/i, "").replace(/\.md$/i, "");
      return base === o.Name;
    });
    out.push({
      id: genId(), title: o.Name, city: o["城市"] || "",
      imageUrl: o["圖片"] || o["image"] || "", body: md ? stripFrontMatter(text(md)) : "",
    });
  }
  return out;
}

/** 去掉 Notion md 頂部的標題與 metadata，保留正文（best-effort） */
function stripFrontMatter(md) {
  const lines = String(md).split(/\r?\n/);
  // 移除第一個 # 標題行（Notion 子頁首行為頁名）
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (lines[i] && lines[i].startsWith("# ")) i++;
  return lines.slice(i).join("\n").trim();
}

/** 頂層頁 md 的待辦清單 → todos */
function buildTodos(files) {
  const top = files
    .filter((f) => /\.md$/i.test(f.path) && !f.path.includes("/"))
    .sort((a, b) => a.path.length - b.path.length)[0];
  if (!top) return [];
  const todos = [];
  for (const line of text(top).split(/\r?\n/)) {
    const m = /^\s*[-*]\s*\[([ xX])\]\s+(.*\S)/.exec(line);
    if (m) todos.push({ id: genId(), text: m[2].trim(), done: m[1].toLowerCase() === "x" });
  }
  return todos;
}

/** 收集未能建模的檔案（地圖圖片、外部連結）→ 供報告與 notes */
function collectDropped(files, report, state) {
  const notes = [];
  for (const f of files) {
    if (/\.(png|jpe?g|webp|gif)$/i.test(f.path)) report.dropped.push(`圖片未匯入：${f.path}`);
  }
  // 頂層 md 內的外部連結（分帳/匯率/天氣等）併入 trip.notes
  const top = files.filter((f) => /\.md$/i.test(f.path) && !f.path.includes("/"))
    .sort((a, b) => a.path.length - b.path.length)[0];
  if (top) {
    for (const m of text(top).matchAll(/\((https?:\/\/[^)]+)\)/g)) notes.push(m[1]);
  }
  if (notes.length) {
    state.notes = `外部連結（自 Notion 頂層頁）：\n` + notes.join("\n");
    report.dropped.push(`外部連結 ${notes.length} 筆已存入行程備註`);
  }
}

/**
 * Notion 匯出檔案集 → { state, report }
 * @param {{path:string, bytes:Uint8Array}[]} files
 */
export function notionFilesToTrip(files) {
  const report = { dropped: [], warnings: [], counts: { days: 0, spots: 0, legs: 0, accommodations: 0, flights: 0, guides: 0, todos: 0 } };
  const state = defaultState();
  const groups = classify(files);

  const { days, routes, tripStart } = buildDays(groups.itinerary, report);
  if (days.length) {
    state.days = days;
    state.routes = routes;
    state.activeDayId = days[0].id;
    state.tripStartDate = tripStart;
  }
  state.accommodations = buildAccommodations(groups.accommodation);
  state.flights = buildFlights(groups.flight);
  state.guides = buildGuides(groups.guide, files);
  state.todos = buildTodos(files);
  collectDropped(files, report, state);

  // 行程名：取頂層 md 檔名
  const topMd = files.filter((f) => /\.md$/i.test(f.path) && !f.path.includes("/"))
    .sort((a, b) => a.path.length - b.path.length)[0];
  if (topMd) state.tripName = topMd.path.replace(/\s+[0-9a-f]{32}\.md$/i, "").replace(/\.md$/i, "");

  report.counts.accommodations = state.accommodations.length;
  report.counts.flights = state.flights.length;
  report.counts.guides = state.guides.length;
  report.counts.todos = state.todos.length;
  return { state, report };
}
