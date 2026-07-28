/* ============================================================
   spot-move.js — 景點移動的純變更層（供 drag.js 與 Vitest 共用）
   函式就地改動傳入的 draft（契約同 state.commit 的 mutator），
   本檔不碰 localStorage / DOM，無副作用，可獨立單元測試。
   ============================================================ */

/** 清除引用某景點的所有 routes（移動後鄰接關係改變，舊路線鍵失效） */
export function clearRoutesForSpot(draft, spotId) {
  Object.keys(draft.routes).forEach((rk) => {
    const [f, t] = rk.split("→");
    if (f === spotId || t === spotId) delete draft.routes[rk];
  });
}

/**
 * 將景點移動到 beforeSpotId 之前（可跨天）。就地改動 draft。
 * beforeSpotId 不存在於目標天時，附加到該天末端。
 */
export function moveSpotBefore(draft, spotId, fromDayId, beforeSpotId, toDayId) {
  if (spotId === beforeSpotId) return;
  const fromDay = draft.days.find((d) => d.id === fromDayId);
  const toDay = draft.days.find((d) => d.id === toDayId);
  if (!fromDay || !toDay) return;
  const idx = fromDay.spots.findIndex((sp) => sp.id === spotId);
  if (idx === -1) return;
  const [spot] = fromDay.spots.splice(idx, 1);
  clearRoutesForSpot(draft, spotId);
  const targetIdx = toDay.spots.findIndex((sp) => sp.id === beforeSpotId);
  toDay.spots.splice(targetIdx === -1 ? toDay.spots.length : targetIdx, 0, spot);
}

/** 將景點附加到另一天末端。就地改動 draft。 */
export function moveSpotToDay(draft, spotId, fromDayId, toDayId) {
  if (fromDayId === toDayId) return;
  const fromDay = draft.days.find((d) => d.id === fromDayId);
  const toDay = draft.days.find((d) => d.id === toDayId);
  if (!fromDay || !toDay) return;
  const idx = fromDay.spots.findIndex((sp) => sp.id === spotId);
  if (idx === -1) return;
  const [spot] = fromDay.spots.splice(idx, 1);
  clearRoutesForSpot(draft, spotId);
  toDay.spots.push(spot);
}
