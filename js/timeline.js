/* ============================================================
   timeline.js — 純函式時間軸引擎（無副作用，供 Vitest）
   由 startTime 起算，依序累加「交通時間 → 停留時間」求出每個節點的時段。
   ============================================================ */

import {
  addMinsToHHMM,
  hhmmToMins,
  routeKey,
  hotelStartId,
  hotelEndId,
} from "./utils.js";

/**
 * 計算一天的時間軸。
 * @param {object} day - { id, startTime, spots:[{id, stayDuration}] }
 * @param {Record<string,{recordedTime?:number}>} routes
 * @returns {Record<string,{start:string|null,end:string|null}>} slots，鍵為節點/路線 id
 */
export function computeTimeline(day, routes = {}) {
  const slots = {};
  if (!day || !day.startTime) return slots;

  let cursor = day.startTime;
  slots[hotelStartId(day.id)] = { start: cursor, end: cursor };

  for (let i = 0; i < day.spots.length; i++) {
    const spot = day.spots[i];
    const prevId = i === 0 ? hotelStartId(day.id) : day.spots[i - 1].id;
    const rk = routeKey(prevId, spot.id);
    const routeMins = (routes[rk] || {}).recordedTime || 0;
    const routeEnd = cursor && routeMins > 0 ? addMinsToHHMM(cursor, routeMins) : null;
    slots[rk] = { start: cursor, end: routeEnd };
    cursor = routeEnd;

    const stayMins = spot.stayDuration || 0;
    const spotEnd = cursor && stayMins > 0 ? addMinsToHHMM(cursor, stayMins) : null;
    slots[spot.id] = { start: cursor, end: spotEnd };
    cursor = spotEnd;
  }

  if (day.spots.length > 0) {
    const lastId = day.spots[day.spots.length - 1].id;
    const rk = routeKey(lastId, hotelEndId(day.id));
    const returnMins = (routes[rk] || {}).recordedTime || 0;
    const returnBase = cursor ?? slots[lastId]?.start ?? null;
    const returnEnd = returnBase && returnMins > 0 ? addMinsToHHMM(returnBase, returnMins) : null;
    slots[rk] = { start: returnBase, end: returnEnd };
    slots[hotelEndId(day.id)] = { start: returnEnd ?? returnBase, end: null };
  }

  return slots;
}

/**
 * 統計一天：景點數、停留、交通、總時長、空閒（跨午夜安全）。
 * @returns {{spotCount:number, stayTotal:number, transitTotal:number, totalMins:number|null, freeMins:number|null}}
 */
export function computeDayStats(day, slots, routes = {}) {
  const spotCount = day.spots.length;
  const stayTotal = day.spots.reduce((s, sp) => s + (sp.stayDuration || 0), 0);

  let transitTotal = 0;
  if (day.spots.length > 0) {
    // 每一段路線都要計入：飯店→第1景點、各景點間、最後景點→飯店。
    // （舊版用 slice(0,-1) 會漏掉最後的返回段，這裡修正。）
    const fromIds = [hotelStartId(day.id), ...day.spots.map((s) => s.id)];
    const toIds = [...day.spots.map((s) => s.id), hotelEndId(day.id)];
    fromIds.forEach((fromId, i) => {
      const rk = routeKey(fromId, toIds[i]);
      transitTotal += (routes[rk] || {}).recordedTime || 0;
    });
  }

  let totalMins = null;
  const endSlot = slots[hotelEndId(day.id)];
  if (day.startTime && endSlot && endSlot.start) {
    let diff = hhmmToMins(endSlot.start) - hhmmToMins(day.startTime);
    if (diff < 0) diff += 1440; // 跨午夜
    totalMins = diff;
  }

  const freeMins = totalMins !== null ? totalMins - stayTotal - transitTotal : null;
  return { spotCount, stayTotal, transitTotal, totalMins, freeMins };
}

/** 節點時段 → 顯示字串（"08:00" 或 "08:00–09:30"） */
export function formatSlot(slot) {
  if (!slot || !slot.start) return "";
  if (!slot.end || slot.start === slot.end) return slot.start;
  return `${slot.start}–${slot.end}`;
}
