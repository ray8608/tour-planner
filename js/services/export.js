/* ============================================================
   services/export.js — 純函式匯出/匯入：JSON / ICS / KML / CSV
   全部無副作用（時間戳與檔名日期由呼叫端注入），供 Vitest 測試。
   實際下載（Blob + a.click）與檔案讀取留在 app.js（非純）。
   ============================================================ */

import { escapeHtml, getDayIsoDate } from "../utils.js";
import { computeTimeline } from "../timeline.js";

/** 安全檔名片段：移除路徑分隔與控制字元 */
export function safeFileStem(name) {
  return String(name || "行程")
    .replace(/[\\/:*?"<>|\n\r\t]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "行程";
}

// ---------------- JSON ----------------
/** 匯出 JSON：回傳 { filename, mime, content } */
export function exportJson(state, isoDate = "") {
  const stem = safeFileStem(state.tripName);
  const suffix = isoDate ? `-${isoDate}` : "";
  return {
    filename: `${stem}${suffix}.json`,
    mime: "application/json;charset=utf-8",
    content: JSON.stringify(state, null, 2),
  };
}

/** 驗證匯入的 JSON 文字。回傳 { ok:true, data } 或 { ok:false, error } */
export function validateImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return { ok: false, error: "檔案不是有效的 JSON" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "JSON 結構無法識別" };
  }
  if (!Array.isArray(parsed.days)) {
    return { ok: false, error: "缺少 days 陣列，不是行程備份檔" };
  }
  return { ok: true, data: parsed };
}

// ---------------- ICS（行事曆） ----------------
function icsEscape(str) {
  return String(str ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "HH:MM" → "HHMMSS" */
function hhmmToIcsTime(hhmm) {
  return hhmm.replace(":", "") + "00";
}
/** "YYYY-MM-DD" → "YYYYMMDD" */
function isoToIcsDate(iso) {
  return iso.replace(/-/g, "");
}
/** 全天事件的隔日日期（DTEND 為非包含式） */
function nextIcsDate(iso) {
  return isoToIcsDate(getDayIsoDate(iso, 1));
}

/**
 * 匯出 ICS。每個景點一個 VEVENT。
 * 有 tripStartDate + slot 時間 → 定時事件（floating local）；否則全天事件。
 * 無 tripStartDate → 無法定位日期，回傳空日曆骨架。
 * @param {object} state
 * @param {string} dtstamp - UTC 時間戳 "YYYYMMDDTHHMMSSZ"（由呼叫端注入）
 */
export function buildIcs(state, dtstamp = "19700101T000000Z") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tour-planner//ZH-TW//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(state.tripName)}`,
  ];

  if (state.tripStartDate) {
    state.days.forEach((day, di) => {
      const dayIso = getDayIsoDate(state.tripStartDate, di);
      if (!dayIso) return;
      const slots = computeTimeline(day, state.routes);
      day.spots.forEach((spot) => {
        if (!spot.name || !spot.name.trim()) return;
        const slot = slots[spot.id];
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${spot.id}@tour-planner`);
        lines.push(`DTSTAMP:${dtstamp}`);
        if (slot && slot.start) {
          const dateStamp = isoToIcsDate(dayIso);
          const endStamp = slot.end || slot.start;
          lines.push(`DTSTART:${dateStamp}T${hhmmToIcsTime(slot.start)}`);
          lines.push(`DTEND:${dateStamp}T${hhmmToIcsTime(endStamp)}`);
        } else {
          lines.push(`DTSTART;VALUE=DATE:${isoToIcsDate(dayIso)}`);
          lines.push(`DTEND;VALUE=DATE:${nextIcsDate(dayIso)}`);
        }
        lines.push(`SUMMARY:${icsEscape(spot.name)}`);
        if (spot.notes && spot.notes.trim()) {
          lines.push(`DESCRIPTION:${icsEscape(spot.notes)}`);
        }
        if (spot.lat != null && spot.lng != null) {
          lines.push(`GEO:${spot.lat};${spot.lng}`);
          if (spot.resolvedAddress) lines.push(`LOCATION:${icsEscape(spot.resolvedAddress)}`);
        }
        lines.push("END:VEVENT");
      });
    });
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ---------------- KML（Google My Maps） ----------------
/** 8 色調色盤（rrggbb），每天循環一色 */
export const KML_PALETTE = [
  "e6194b", "3cb44b", "4363d8", "f58231",
  "911eb4", "42d4f4", "f032e6", "9a6324",
];

/** rrggbb → KML aabbggrr（不透明） */
function kmlColor(rrggbb) {
  const r = rrggbb.slice(0, 2);
  const g = rrggbb.slice(2, 4);
  const b = rrggbb.slice(4, 6);
  return `ff${b}${g}${r}`;
}

/** 匯出 KML 2.2。無座標景點輸出 Placemark（僅名稱、無 Point）。 */
export function buildKml(state) {
  const x = escapeHtml; // XML text 逃脫（& < > " ' 皆合法實體）
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "<Document>",
    `<name>${x(state.tripName)}</name>`,
  ];

  state.days.forEach((day, di) => {
    const color = KML_PALETTE[di % KML_PALETTE.length];
    const styleId = `day${di + 1}-style`;
    parts.push(`<Style id="${styleId}">`);
    parts.push(`<IconStyle><color>${kmlColor(color)}</color></IconStyle>`);
    parts.push(`<LineStyle><color>${kmlColor(color)}</color><width>3</width></LineStyle>`);
    parts.push("</Style>");
  });

  state.days.forEach((day, di) => {
    const styleUrl = `#day${di + 1}-style`;
    parts.push("<Folder>");
    parts.push(`<name>${x(day.label || `第 ${di + 1} 天`)}</name>`);

    const line = []; // 依序收集有座標節點供 LineString

    // 出發飯店
    if (day.startHotelName && day.startHotelName.trim()) {
      parts.push(placemark(x(day.startHotelName), styleUrl, null, null, x));
    }
    day.spots.forEach((spot) => {
      if (!spot.name || !spot.name.trim()) return;
      const hasCoord = spot.lat != null && spot.lng != null;
      parts.push(placemark(x(spot.name), styleUrl, hasCoord ? spot.lng : null, hasCoord ? spot.lat : null, x, spot.resolvedAddress));
      if (hasCoord) line.push(`${spot.lng},${spot.lat}`);
    });
    // 返回飯店
    if (day.endHotelName && day.endHotelName.trim()) {
      parts.push(placemark(x(day.endHotelName), styleUrl, null, null, x));
    }

    if (line.length >= 2) {
      parts.push("<Placemark>");
      parts.push(`<name>${x(day.label || `第 ${di + 1} 天`)} 路線</name>`);
      parts.push(`<styleUrl>${styleUrl}</styleUrl>`);
      parts.push(`<LineString><tessellate>1</tessellate><coordinates>${line.join(" ")}</coordinates></LineString>`);
      parts.push("</Placemark>");
    }

    parts.push("</Folder>");
  });

  parts.push("</Document>", "</kml>");
  return parts.join("\n");
}

function placemark(name, styleUrl, lng, lat, x, address) {
  const bits = ["<Placemark>", `<name>${name}</name>`, `<styleUrl>${styleUrl}</styleUrl>`];
  if (address) bits.push(`<description>${x(address)}</description>`);
  if (lng != null && lat != null) {
    bits.push(`<Point><coordinates>${lng},${lat}</coordinates></Point>`);
  }
  bits.push("</Placemark>");
  return bits.join("");
}

// ---------------- CSV（試算表） ----------------
function csvCell(v) {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 匯出 CSV（UTF-8 BOM + 標題列 + 每景點一行） */
export function buildCsv(state) {
  const header = ["名稱", "天", "抵達時間", "離開時間", "停留時間(分)", "備註", "緯度", "經度"];
  const rows = [header.map(csvCell).join(",")];

  state.days.forEach((day, di) => {
    const slots = computeTimeline(day, state.routes);
    const dayLabel = day.label || `第 ${di + 1} 天`;
    day.spots.forEach((spot) => {
      if (!spot.name || !spot.name.trim()) return;
      const slot = slots[spot.id] || {};
      rows.push(
        [
          spot.name,
          dayLabel,
          slot.start || "",
          slot.end || "",
          spot.stayDuration || 0,
          spot.notes || "",
          spot.lat != null ? spot.lat : "",
          spot.lng != null ? spot.lng : "",
        ]
          .map(csvCell)
          .join(",")
      );
    });
  });

  return "﻿" + rows.join("\r\n");
}
