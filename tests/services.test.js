import { describe, it, expect } from "vitest";
import {
  wmoToEmoji,
  getModelForCountry,
  parseDailyForecast,
  weatherBadgeParts,
  getCachedForecast,
} from "../js/services/weather.js";
import { parseNominatim, parsePhoton } from "../js/services/geocode.js";
import {
  osrmProfileFor,
  parseOsrmDuration,
  secondsToMinutes,
  mapsNavUrl,
  mapsDirectionsUrl,
} from "../js/services/route.js";

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
