import { describe, it, expect } from "vitest";
import {
  wmoToEmoji,
  getModelForCountry,
  parseDailyForecast,
  weatherBadgeParts,
  getCachedForecast,
} from "../js/services/weather.js";
import { parseNominatim, parsePhoton, parseNominatimAll, parsePhotonAll } from "../js/services/geocode.js";
import {
  osrmProfileFor,
  parseOsrmDuration,
  secondsToMinutes,
  mapsNavUrl,
  mapsDirectionsUrl,
} from "../js/services/route.js";
import {
  googleTravelMode,
  parseGeocoderResults,
  parseDirectionsSeconds,
} from "../js/services/gmaps.js";

describe("weather.wmoToEmoji", () => {
  it("晴天 / 雷雨 / 未知", () => {
    expect(wmoToEmoji(0)).toBe("☀️");
    expect(wmoToEmoji(95)).toBe("⛈️");
    expect(wmoToEmoji(null)).toBe("");
    expect(wmoToEmoji(999)).toBe("");
  });
});

describe("weather.getModelForCountry", () => {
  it("依國別選模型", () => {
    expect(getModelForCountry("JP")).toBe("jma_seamless");
    expect(getModelForCountry("cn")).toBe("cma_grapes_global");
    expect(getModelForCountry("DE")).toBe("icon_seamless");
    expect(getModelForCountry("US")).toBe("best_match");
    expect(getModelForCountry("")).toBe("best_match");
  });
});

describe("weather.parseDailyForecast", () => {
  it("四捨五入溫度並保留降雨欄位", () => {
    const daily = {
      time: ["2026-07-27"],
      temperature_2m_max: [30.6],
      temperature_2m_min: [24.2],
      precipitation_probability_max: [60],
      precipitation_sum: [3.5],
      weather_code: [61],
    };
    expect(parseDailyForecast(daily)["2026-07-27"]).toEqual({
      tempMax: 31,
      tempMin: 24,
      precipProb: 60,
      precipSum: 3.5,
      weatherCode: 61,
    });
  });
  it("溫度與代碼皆 null → 該日為 null", () => {
    const daily = { time: ["2026-07-27"], temperature_2m_max: [null], temperature_2m_min: [null], weather_code: [null] };
    expect(parseDailyForecast(daily)["2026-07-27"]).toBeNull();
  });
  it("部分欄位缺值（僅 tempMax null）→ 該日為 null，不產生 0°/NaN°", () => {
    const daily = { time: ["2026-07-27"], temperature_2m_max: [null], temperature_2m_min: [24], weather_code: [61] };
    expect(parseDailyForecast(daily)["2026-07-27"]).toBeNull();
  });
  it("陣列過短導致 undefined → 該日為 null", () => {
    const daily = { time: ["2026-07-27", "2026-07-28"], temperature_2m_max: [30], temperature_2m_min: [24], weather_code: [61] };
    expect(parseDailyForecast(daily)["2026-07-28"]).toBeNull();
  });
  it("無 daily 回傳空物件", () => {
    expect(parseDailyForecast(null)).toEqual({});
  });
});

describe("weather.weatherBadgeParts", () => {
  it("高降雨機率且雨量>=1 顯示 mm", () => {
    expect(weatherBadgeParts({ tempMax: 20, tempMin: 15, precipProb: 70, precipSum: 5, weatherCode: 61 })).toEqual({
      emoji: "🌧️",
      temp: "20°/15°",
      rain: "💧5mm",
    });
  });
  it("中等機率顯示百分比；低機率不顯示", () => {
    expect(weatherBadgeParts({ tempMax: 20, tempMin: 15, precipProb: 30, precipSum: 0, weatherCode: 2 }).rain).toBe("💧30%");
    expect(weatherBadgeParts({ tempMax: 20, tempMin: 15, precipProb: 5, precipSum: 0, weatherCode: 0 }).rain).toBe("");
  });
});

describe("weather.getCachedForecast", () => {
  const now = 1_000_000_000_000;
  const cache = {
    tokyo: { forecastFetchedAt: now - 1000, forecast: { "2026-07-27": { tempMax: 30 } } },
    osaka: { forecastFetchedAt: now - 4 * 60 * 60 * 1000, forecast: { "2026-07-27": { tempMax: 28 } } },
  };
  it("命中回傳資料", () => {
    expect(getCachedForecast(cache, "Tokyo", "2026-07-27", now)).toEqual({ tempMax: 30 });
  });
  it("未快取該日回傳 undefined", () => {
    expect(getCachedForecast(cache, "tokyo", "2026-07-28", now)).toBeUndefined();
  });
  it("逾 TTL 回傳 undefined", () => {
    expect(getCachedForecast(cache, "osaka", "2026-07-27", now)).toBeUndefined();
  });
});

describe("geocode 解析", () => {
  it("parseNominatim", () => {
    expect(parseNominatim([{ lat: "35.68", lon: "139.76", display_name: "Tokyo" }])).toEqual({
      lat: 35.68,
      lng: 139.76,
      address: "Tokyo",
    });
    expect(parseNominatim([])).toBeNull();
  });
  it("parsePhoton", () => {
    const data = {
      features: [{ geometry: { coordinates: [139.76, 35.68] }, properties: { name: "Tokyo Tower", city: "Tokyo", country: "Japan" } }],
    };
    expect(parsePhoton(data)).toEqual({ lat: 35.68, lng: 139.76, address: "Tokyo Tower, Tokyo, Japan" });
    expect(parsePhoton({ features: [] })).toBeNull();
  });

  it("parseNominatimAll 回多筆並截到 limit、過濾 NaN", () => {
    const data = [
      { lat: "35.68", lon: "139.76", display_name: "A" },
      { lat: "34.69", lon: "135.50", display_name: "B" },
      { lat: "x", lon: "y", display_name: "壞資料" },
    ];
    expect(parseNominatimAll(data)).toEqual([
      { lat: 35.68, lng: 139.76, address: "A" },
      { lat: 34.69, lng: 135.5, address: "B" },
    ]);
    expect(parseNominatimAll(data, 1)).toHaveLength(1);
    expect(parseNominatimAll([])).toEqual([]);
    expect(parseNominatimAll(null)).toEqual([]);
  });

  it("parsePhotonAll 逐 feature 解析", () => {
    const data = { features: [
      { geometry: { coordinates: [139.76, 35.68] }, properties: { name: "Tokyo Tower", city: "Tokyo", country: "Japan" } },
      { geometry: { coordinates: [135.5, 34.69] }, properties: { name: "Osaka" } },
    ] };
    expect(parsePhotonAll(data)).toEqual([
      { lat: 35.68, lng: 139.76, address: "Tokyo Tower, Tokyo, Japan" },
      { lat: 34.69, lng: 135.5, address: "Osaka" },
    ]);
    expect(parsePhotonAll({ features: [] })).toEqual([]);
  });
});

describe("route 工具", () => {
  it("osrmProfileFor", () => {
    expect(osrmProfileFor("walking")).toBe("foot");
    expect(osrmProfileFor("transit")).toBe("driving");
    expect(osrmProfileFor("driving")).toBe("driving");
  });
  it("parseOsrmDuration", () => {
    expect(parseOsrmDuration({ code: "Ok", routes: [{ duration: 930 }] })).toBe(930);
    expect(parseOsrmDuration({ code: "NoRoute", routes: [] })).toBeNull();
  });
  it("secondsToMinutes 進位且至少 1 分", () => {
    expect(secondsToMinutes(930)).toBe(16);
    expect(secondsToMinutes(20)).toBe(1);
    expect(secondsToMinutes(0)).toBe(0);
  });
  it("Google Maps URL", () => {
    expect(mapsNavUrl("東京鐵塔")).toContain("query=%E6%9D%B1%E4%BA%AC%E9%90%B5%E5%A1%94");
    expect(mapsDirectionsUrl("A", "B", "walking")).toContain("travelmode=walking");
  });
});

describe("gmaps 解析", () => {
  it("googleTravelMode 對應交通方式，未知回退 DRIVING", () => {
    expect(googleTravelMode("driving")).toBe("DRIVING");
    expect(googleTravelMode("walking")).toBe("WALKING");
    expect(googleTravelMode("transit")).toBe("TRANSIT");
    expect(googleTravelMode("boat")).toBe("DRIVING");
  });

  it("parseGeocoderResults 支援函式式 location（google.maps.LatLng）", () => {
    const results = [{ geometry: { location: { lat: () => 35.68, lng: () => 139.76 } }, formatted_address: "Tokyo" }];
    expect(parseGeocoderResults(results)).toEqual({ lat: 35.68, lng: 139.76, address: "Tokyo" });
  });

  it("parseGeocoderResults 支援數值式 location 並在缺值時回傳 null", () => {
    expect(parseGeocoderResults([{ geometry: { location: { lat: 1, lng: 2 } } }])).toEqual({ lat: 1, lng: 2, address: "" });
    expect(parseGeocoderResults([])).toBeNull();
    expect(parseGeocoderResults(null)).toBeNull();
    expect(parseGeocoderResults([{ geometry: {} }])).toBeNull();
  });

  it("parseDirectionsSeconds 取第一段 legs.duration.value", () => {
    expect(parseDirectionsSeconds({ routes: [{ legs: [{ duration: { value: 930 } }] }] })).toBe(930);
    expect(parseDirectionsSeconds({ routes: [] })).toBeNull();
    expect(parseDirectionsSeconds(null)).toBeNull();
  });
  it("parseDirectionsSeconds 保留合法的 0（不誤判為失敗）", () => {
    expect(parseDirectionsSeconds({ routes: [{ legs: [{ duration: { value: 0 } }] }] })).toBe(0);
  });
});
