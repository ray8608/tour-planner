/* ============================================================
   services/gmaps.js — Google Maps JavaScript SDK 載入與查詢。
   ------------------------------------------------------------
   Google 的 Geocoding / Directions Web Service（REST）不回傳 CORS
   標頭，無法從瀏覽器直接 fetch；故改用官方 Maps JS SDK 的
   Geocoder / DirectionsService。
   純函式（googleTravelMode / parseGeocoderResults / parseDirectionsSeconds）
   供測試；loader 與查詢函式依賴瀏覽器全域 google。
   ============================================================ */

/** 交通方式 → Google TravelMode 鍵名 */
export function googleTravelMode(transport) {
  return { driving: "DRIVING", walking: "WALKING", transit: "TRANSIT" }[transport] || "DRIVING";
}

/** 解析 Geocoder 結果 → { lat, lng, address } | null（location 可能為函式或數值） */
export function parseGeocoderResults(results) {
  const r = Array.isArray(results) ? results[0] : null;
  const loc = r?.geometry?.location;
  if (!loc) return null;
  const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
  const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
  if (typeof lat !== "number" || typeof lng !== "number" || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }
  return { lat, lng, address: r.formatted_address || "" };
}

/** 解析 DirectionsService 結果 → 秒數 | null */
export function parseDirectionsSeconds(response) {
  const leg = response?.routes?.[0]?.legs?.[0];
  const dur = leg?.duration?.value;
  return typeof dur === "number" ? dur : null;
}

let loaderPromise = null;
let cbSeq = 0;
let authFailed = false;

/** SDK 已載入但 API Key 驗證失敗（無效／受限／超額）→ 查詢會靜默回退 OSM */
export function isGoogleAuthFailed() {
  return authFailed;
}

/**
 * 載入 Maps JS SDK（單例）。一經載入即沿用首個 key（Maps JS 無法二次換 key）。
 * @param {string} key - Google Maps API Key
 * @returns {Promise<any>} google.maps 命名空間
 */
export function loadGoogleMaps(key) {
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("Google Maps 僅能在瀏覽器載入"));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    // Google 於金鑰驗證失敗時呼叫此全域，SDK 本身仍載入成功
    if (typeof window.gm_authFailure !== "function") {
      window.gm_authFailure = () => {
        authFailed = true;
        console.warn(
          "[gmaps] Google Maps 驗證失敗：API Key 無效／受限／超額，已回退免費 OSM；修正金鑰後請重新整理頁面。"
        );
      };
    }
    const cbName = `__gmapsReady_${++cbSeq}`;
    window[cbName] = () => {
      resolve(window.google.maps);
      try { delete window[cbName]; } catch (_) { /* ignore */ }
    };
    const script = document.createElement("script");
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${cbName}`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null; // 允許重試（例如改用有效 key）
      try { delete window[cbName]; } catch (_) { /* ignore */ }
      reject(new Error("Google Maps SDK 載入失敗"));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

/**
 * 以 Google Geocoder 查地名 → { lat, lng, address } | null（失敗回傳 null 供上層回退）
 * @param {string} name
 * @param {string} key
 */
export async function googleGeocode(name, key) {
  try {
    const maps = await loadGoogleMaps(key);
    const geocoder = new maps.Geocoder();
    const resp = await geocoder.geocode({ address: name });
    return parseGeocoderResults(resp?.results);
  } catch (_) {
    return null;
  }
}

/**
 * 以 Google DirectionsService 查兩點路線耗時（秒）→ number | null
 * @param {{lat:number,lng:number}} from
 * @param {{lat:number,lng:number}} to
 * @param {string} transport - driving | walking | transit
 * @param {string} key
 * @param {Date|null} [departureDate] - 大眾運輸的實際出發時刻（供查真實班次）
 */
export async function googleRouteSeconds(from, to, transport, key, departureDate = null) {
  try {
    const maps = await loadGoogleMaps(key);
    const svc = new maps.DirectionsService();
    const mode = googleTravelMode(transport);
    const req = {
      origin: { lat: from.lat, lng: from.lng },
      destination: { lat: to.lat, lng: to.lng },
      travelMode: maps.TravelMode[mode],
    };
    // 大眾運輸需出發時間才會回傳班次；過去或未知時刻改用「現在」以確保有結果
    if (mode === "TRANSIT") {
      const dep = departureDate instanceof Date && departureDate.getTime() > Date.now() ? departureDate : new Date();
      req.transitOptions = { departureTime: dep };
    }
    const resp = await svc.route(req);
    return parseDirectionsSeconds(resp);
  } catch (_) {
    return null;
  }
}
