/* ============================================================
   services/weather.js — Open-Meteo 天氣（geocode 城市 + 每日預報 + 快取）
   純函式（wmoToEmoji / getModelForCountry / parseDailyForecast /
   weatherBadgeParts / getCachedForecast）供 Vitest；fetch 包裝為薄層。
   ============================================================ */

const WEATHER_CACHE_KEY = "tour-weather-cache-v1";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 小時
const MAX_CITIES = 10;

/** WMO 天氣代碼 → emoji */
export function wmoToEmoji(code) {
  if (code === null || code === undefined) return "";
  if (code === 0) return "☀️";
  if (code === 1) return "🌤️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 80, 81, 82].includes(code)) return "🌦️";
  if ([56, 57, 61, 63, 65, 66, 67].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "";
}

/** 依國碼挑選較準的區域模型 */
export function getModelForCountry(countryCode) {
  if (!countryCode) return "best_match";
  const code = countryCode.toUpperCase();
  if (code === "JP" || code === "TW") return "jma_seamless";
  if (code === "CN") return "cma_grapes_global";
  const iconEU = ["KR","DE","FR","IT","ES","GB","AT","CH","NL","BE","PL","CZ",
    "SE","NO","DK","FI","PT","GR","HU","RO","SK","SI","HR","BG","RS","BA","ME","MK","AL"];
  if (iconEU.includes(code)) return "icon_seamless";
  return "best_match";
}

/** 解析 Open-Meteo daily 區塊 → { "YYYY-MM-DD": {...} | null } */
export function parseDailyForecast(daily) {
  const result = {};
  if (!daily || !Array.isArray(daily.time)) return result;
  daily.time.forEach((date, i) => {
    const tempMax = daily.temperature_2m_max?.[i];
    const tempMin = daily.temperature_2m_min?.[i];
    const weatherCode = daily.weather_code?.[i];
    // 任一核心欄位缺值即視為當日無資料，避免 Math.round(null|undefined) → 0/NaN
    const missing = tempMax == null || tempMin == null || weatherCode == null;
    result[date] = missing
      ? null
      : {
          tempMax: Math.round(tempMax),
          tempMin: Math.round(tempMin),
          precipProb: daily.precipitation_probability_max?.[i] ?? null,
          precipSum: daily.precipitation_sum?.[i] ?? null,
          weatherCode,
        };
  });
  return result;
}

/** 從天氣資料算出 badge 顯示元件（純）：{ emoji, temp, rain } */
export function weatherBadgeParts(cached) {
  if (!cached) return null;
  const emoji = wmoToEmoji(cached.weatherCode);
  const temp = `${cached.tempMax}°/${cached.tempMin}°`;
  let rain = "";
  const prob = cached.precipProb;
  if (prob >= 50) {
    const sum = cached.precipSum;
    rain =
      sum != null && sum >= 1
        ? `💧${Number.isInteger(sum) ? sum : sum.toFixed(1)}mm`
        : `💧${prob}%`;
  } else if (prob >= 20) {
    rain = `💧${prob}%`;
  }
  return { emoji, temp, rain };
}

/** 純：從快取取某城某日預報（考慮 TTL）。回傳 entry / null(該日無天氣) / undefined(未快取) */
export function getCachedForecast(cache, city, date, now) {
  const key = String(city || "").trim().toLowerCase();
  const entry = cache[key];
  if (!entry) return undefined;
  if (now - entry.forecastFetchedAt > CACHE_TTL_MS) return undefined;
  return date in entry.forecast ? entry.forecast[date] : undefined;
}

// ---------------- localStorage 快取 ----------------
export function loadWeatherCache() {
  try {
    return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

export function saveWeatherCache(cache) {
  const keys = Object.keys(cache);
  if (keys.length > MAX_CITIES) {
    keys.sort((a, b) => (cache[a].forecastFetchedAt || 0) - (cache[b].forecastFetchedAt || 0));
    delete cache[keys[0]];
  }
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch (_) {
    /* 配額：忽略 */
  }
}

// ---------------- fetch 薄層 ----------------
/** geocode 城市名 → { lat, lng, timezone, countryCode, resolvedName } | null */
export async function geocodeCity(cityName, lang = "zh") {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    cityName
  )}&count=1&language=${lang}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("geocode network error");
  const data = await res.json();
  if (!data.results || !data.results.length) return null;
  const r = data.results[0];
  return {
    lat: r.latitude,
    lng: r.longitude,
    timezone: r.timezone,
    countryCode: r.country_code,
    resolvedName: `${r.name}, ${r.country}`,
  };
}

/** 取回每日預報 → parseDailyForecast 結果 */
export async function fetchForecast(lat, lng, timezone, startDate, endDate, model) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code",
    timezone,
    start_date: startDate,
    end_date: endDate,
    models: model || "best_match",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error("forecast network error");
  const data = await res.json();
  return parseDailyForecast(data.daily);
}
