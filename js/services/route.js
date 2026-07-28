/* ============================================================
   services/route.js — OSRM 路線耗時 + Google Maps 導航 URL
   純函式（osrmProfileFor / parseOsrmDuration / secondsToMinutes /
   mapsNavUrl / mapsDirectionsUrl）供測試；osrmRoute() 為 fetch 薄層。
   ============================================================ */

/** 交通方式 → OSRM profile（大眾運輸以開車近似） */
export function osrmProfileFor(transport) {
  return { driving: "driving", walking: "foot", transit: "driving" }[transport] || "driving";
}

/** 解析 OSRM 回應 → 秒數 | null */
export function parseOsrmDuration(data) {
  if (!data || data.code !== "Ok" || !Array.isArray(data.routes) || !data.routes.length) {
    return null;
  }
  const dur = data.routes[0].duration;
  return typeof dur === "number" ? dur : null;
}

/** 秒 → 分鐘（無條件進位，至少 1 分） */
export function secondsToMinutes(seconds) {
  if (seconds == null || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

/** Google Maps 地點搜尋 URL */
export function mapsNavUrl(name) {
  const q = String(name || "").trim() || "景點";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Google Maps 路線導航 URL */
export function mapsDirectionsUrl(from, to, mode = "driving") {
  const o = String(from || "").trim() || "出發地";
  const d = String(to || "").trim() || "目的地";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    o
  )}&destination=${encodeURIComponent(d)}&travelmode=${mode}`;
}

/**
 * 以座標查詢 OSRM 行車/步行耗時（秒）。
 * @param {{lat:number,lng:number}} from
 * @param {{lat:number,lng:number}} to
 * @param {string} profile - 'driving' | 'foot'
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<number|null>} 秒數
 */
export async function osrmRoute(from, to, profile, fetchImpl = fetch) {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const base =
    profile === "foot"
      ? "https://routing.openstreetmap.de/routed-foot"
      : "https://router.project-osrm.org";
  const url = `${base}/route/v1/${profile}/${coords}?overview=false`;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    return parseOsrmDuration(await res.json());
  } catch (_) {
    return null;
  }
}
