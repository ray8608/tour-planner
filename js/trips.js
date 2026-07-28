/* ============================================================
   trips.js — 多行程容器的純函式層
   容器結構：{ trips: [tripData, ...], activeIdx }
   其中每個 tripData 即 state.js 的單行程狀態形狀（days/routes/settings…）。
   本檔不碰 localStorage / DOM，全部無副作用，供 Vitest 單元測試。
   ============================================================ */

export const TRIPS_KEY = "tour-planner-trips-v1";
export const LEGACY_KEY = "tour-planner-v3"; // 舊的單行程鍵，作為一次性遷移來源

/**
 * 從原始容器（可能損毀）與 legacy 單行程，正規化出 { trips, activeIdx }。
 * 找不到任何有效行程時回傳空陣列，由呼叫端補上 defaultState。
 * @param {unknown} rawContainer - 解析後的 TRIPS_KEY 內容
 * @param {unknown} legacyTrip - 解析後的 LEGACY_KEY 內容（舊單行程）
 * @returns {{ trips: object[], activeIdx: number }}
 */
export function normalizeTripsContainer(rawContainer, legacyTrip) {
  if (
    rawContainer &&
    typeof rawContainer === "object" &&
    Array.isArray(rawContainer.trips) &&
    rawContainer.trips.length
  ) {
    const trips = rawContainer.trips.filter((t) => t && typeof t === "object");
    if (trips.length) {
      let idx = Number.isInteger(rawContainer.activeIdx) ? rawContainer.activeIdx : 0;
      if (idx < 0 || idx >= trips.length) idx = 0;
      return { trips, activeIdx: idx };
    }
  }
  if (legacyTrip && typeof legacyTrip === "object") {
    return { trips: [legacyTrip], activeIdx: 0 };
  }
  return { trips: [], activeIdx: 0 };
}

/**
 * 產生行程清單摘要（供選單渲染）。
 * name 為使用者輸入的原始字串（可能為空，就地編輯 input 直接綁定它）；
 * placeholder 為名稱留空時顯示的灰字提示，不會被當成真正的名稱存回。
 * @param {object[]} trips
 * @param {number} activeIdx
 * @returns {{ index:number, name:string, placeholder:string, days:number, active:boolean }[]}
 */
export function tripSummaries(trips, activeIdx) {
  return trips.map((t, i) => {
    const rawName = t && typeof t.tripName === "string" ? t.tripName : "";
    return {
      index: i,
      name: rawName,
      placeholder: `未命名行程 ${i + 1}`,
      days: t && Array.isArray(t.days) ? t.days.length : 0,
      active: i === activeIdx,
    };
  });
}

/**
 * 刪除指定索引的行程並修正 activeIdx（不可變，回傳新物件）。
 * 呼叫端須自行保證至少保留一筆（length<=1 時不應呼叫）。
 * @param {object[]} trips
 * @param {number} activeIdx
 * @param {number} delIdx
 * @returns {{ trips: object[], activeIdx: number }}
 */
export function removeAt(trips, activeIdx, delIdx) {
  const next = trips.filter((_, i) => i !== delIdx);
  let idx = activeIdx;
  if (delIdx < activeIdx) idx = activeIdx - 1;
  else if (delIdx === activeIdx) idx = Math.min(activeIdx, next.length - 1);
  return { trips: next, activeIdx: Math.max(0, idx) };
}
