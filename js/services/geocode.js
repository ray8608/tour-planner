/* ============================================================
   services/geocode.js — 地理編碼：Nominatim 主 + Photon 備援
   純解析（parseNominatim / parsePhoton）供測試；geocode() 為 fetch 薄層。
   ============================================================ */

/** 解析 Nominatim 回應 → { lat, lng, address } | null */
export function parseNominatim(data) {
  if (!Array.isArray(data) || !data.length) return null;
  const r = data[0];
  const lat = parseFloat(r.lat);
  const lng = parseFloat(r.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng, address: r.display_name || "" };
}

/** 解析 Photon(GeoJSON) 回應 → { lat, lng, address } | null */
export function parsePhoton(data) {
  const f = data?.features?.[0];
  if (!f || !Array.isArray(f.geometry?.coordinates)) return null;
  const [lng, lat] = f.geometry.coordinates;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const p = f.properties || {};
  const address = [p.name, p.street, p.city, p.country].filter(Boolean).join(", ");
  return { lat, lng, address };
}

/** 解析 Nominatim 回應 → 多筆 [{lat,lng,address}]（過濾無效座標，截到 limit） */
export function parseNominatimAll(data, limit = 5) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const r of data) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    out.push({ lat, lng, address: r.display_name || "" });
    if (out.length >= limit) break;
  }
  return out;
}

/** 解析 Photon(GeoJSON) 回應 → 多筆 [{lat,lng,address}] */
export function parsePhotonAll(data, limit = 5) {
  const feats = Array.isArray(data?.features) ? data.features : [];
  const out = [];
  for (const f of feats) {
    const c = f?.geometry?.coordinates;
    if (!Array.isArray(c)) continue;
    const [lng, lat] = c;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const p = f.properties || {};
    out.push({ lat, lng, address: [p.name, p.street, p.city, p.country].filter(Boolean).join(", ") });
    if (out.length >= limit) break;
  }
  return out;
}

// Nominatim 使用政策：最多 1 req/s，這裡用 2s 保守間隔
let lastNominatimReq = 0;

/**
 * 地理編碼地名 → { lat, lng, address } | null
 * @param {string} name
 * @param {typeof fetch} [fetchImpl] - 可注入以利測試
 */
export async function geocode(name, fetchImpl = fetch) {
  const encoded = encodeURIComponent(name);

  const now = Date.now();
  const wait = 2000 - (now - lastNominatimReq);
  if (wait > 0 && lastNominatimReq > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastNominatimReq = Date.now();

  try {
    const res = await fetchImpl(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
      { headers: { "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8" } }
    );
    if (res.ok) {
      const parsed = parseNominatim(await res.json());
      if (parsed) return parsed;
    }
  } catch (_) {
    /* 落到 Photon 備援 */
  }

  try {
    const res = await fetchImpl(`https://photon.komoot.io/api/?q=${encoded}&limit=1`);
    if (!res.ok) return null;
    return parsePhoton(await res.json());
  } catch (_) {
    return null;
  }
}

/**
 * 候選地理編碼 → 多筆 [{lat,lng,address}]（找不到回 []）。
 * Nominatim limit=5，空或失敗回退 Photon。
 * @param {string} name
 * @param {typeof fetch} [fetchImpl]
 */
export async function geocodeCandidates(name, fetchImpl = fetch) {
  const encoded = encodeURIComponent(name);

  const now = Date.now();
  const wait = 2000 - (now - lastNominatimReq);
  if (wait > 0 && lastNominatimReq > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastNominatimReq = Date.now();

  try {
    const res = await fetchImpl(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5`,
      { headers: { "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8" } }
    );
    if (res.ok) {
      const list = parseNominatimAll(await res.json());
      if (list.length) return list;
    }
  } catch (_) {
    /* 落到 Photon 備援 */
  }

  try {
    const res = await fetchImpl(`https://photon.komoot.io/api/?q=${encoded}&limit=5`);
    if (!res.ok) return [];
    return parsePhotonAll(await res.json());
  } catch (_) {
    return [];
  }
}
