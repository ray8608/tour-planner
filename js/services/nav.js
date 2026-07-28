/* ============================================================
   services/nav.js — 導航服務門面：座標查詢與路線耗時。
   ------------------------------------------------------------
   依 settings 決定服務來源：mapsMode="on" 且有 API Key 時優先用
   Google Maps（座標更準、大眾運輸有真實班次），Google 失敗則回退
   免費 OSM（Nominatim/OSRM）。無 key 時純用 OSM。
   由於需讀取 state，本檔置於服務層門面而非純服務；純查詢邏輯仍在
   services/geocode.js、services/route.js、services/gmaps.js。
   ============================================================ */

import { getState } from "../state.js";
import { getDayDateTime } from "../utils.js";
import { geocode as osmGeocode } from "./geocode.js";
import { osrmRoute, osrmProfileFor } from "./route.js";
import { googleGeocode, googleRouteSeconds, isGoogleAuthFailed } from "./gmaps.js";

export { isGoogleAuthFailed };

/** 目前啟用的 Google Maps API Key（mapsMode=on 且非空），否則回傳 "" */
export function activeGoogleKey() {
  const s = getState().settings || {};
  return s.mapsMode === "on" && s.mapsKey ? String(s.mapsKey).trim() : "";
}

/** 目前的導航服務顯示名稱（供 UI 文案）；Google 為主但失敗會回退 OSM，故如實標註 */
export function navServiceName() {
  return activeGoogleKey() ? "Google Maps（失敗時回退 OpenStreetMap）" : "免費 OpenStreetMap 服務";
}

/** 某天的實際出發時刻 Date（tripStartDate + 天索引 + startTime），無日期則 null */
export function departureForDay(dayId) {
  const st = getState();
  const idx = st.days.findIndex((d) => d.id === dayId);
  if (idx < 0) return null;
  return getDayDateTime(st.tripStartDate, idx, st.days[idx].startTime);
}

/**
 * 地名 → { lat, lng, address } | null。有 Google key 先試 Google，失敗回退 OSM。
 * @param {string} name
 */
export async function geocodePlace(name) {
  const key = activeGoogleKey();
  if (key) {
    const g = await googleGeocode(name, key);
    if (g) return g;
  }
  return osmGeocode(name);
}

/**
 * 兩點路線耗時（秒）| null。有 Google key 先試 Google，失敗回退 OSRM。
 * @param {{lat:number,lng:number}} from
 * @param {{lat:number,lng:number}} to
 * @param {string} transport - driving | walking | transit
 * @param {Date|null} [departureDate] - 大眾運輸實際出發時刻（供 Google 查真實班次）
 */
export async function routeSeconds(from, to, transport, departureDate = null) {
  const key = activeGoogleKey();
  if (key) {
    const secs = await googleRouteSeconds(from, to, transport, key, departureDate);
    if (secs != null) return secs;
  }
  return osrmRoute(from, to, osrmProfileFor(transport));
}
