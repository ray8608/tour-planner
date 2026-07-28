import { describe, it, expect } from "vitest";
import { computeTimeline, computeDayStats, formatSlot } from "../js/timeline.js";
import { routeKey, hotelStartId, hotelEndId } from "../js/utils.js";

function makeDay() {
  return {
    id: "d1",
    startTime: "08:00",
    spots: [
      { id: "s1", stayDuration: 90 },
      { id: "s2", stayDuration: 60 },
    ],
  };
}

describe("computeTimeline", () => {
  it("無 startTime 回傳空 slots", () => {
    expect(computeTimeline({ id: "d", startTime: "", spots: [] }, {})).toEqual({});
  });

  it("依交通+停留累加各節點時段", () => {
    const day = makeDay();
    const routes = {
      [routeKey(hotelStartId("d1"), "s1")]: { recordedTime: 30 }, // 08:00→08:30
      [routeKey("s1", "s2")]: { recordedTime: 15 }, // s1 08:30-10:00, route→10:15
      [routeKey("s2", hotelEndId("d1"))]: { recordedTime: 20 }, // s2 10:15-11:15, →11:35
    };
    const slots = computeTimeline(day, routes);
    expect(slots[hotelStartId("d1")]).toEqual({ start: "08:00", end: "08:00" });
    expect(slots["s1"]).toEqual({ start: "08:30", end: "10:00" });
    expect(slots["s2"]).toEqual({ start: "10:15", end: "11:15" });
    expect(slots[hotelEndId("d1")].start).toBe("11:35");
  });

  it("缺交通時間時下游時段為 null（不臆造抵達時間）", () => {
    const day = makeDay();
    const slots = computeTimeline(day, {}); // 無任何路線時間
    // 沒有 飯店→s1 的交通時間，無法推算抵達，故 s1 起訖皆 null
    expect(slots["s1"]).toEqual({ start: null, end: null });
  });
});

describe("computeDayStats", () => {
  it("彙總停留/交通/總時長/空閒", () => {
    const day = makeDay();
    const routes = {
      [routeKey(hotelStartId("d1"), "s1")]: { recordedTime: 30 },
      [routeKey("s1", "s2")]: { recordedTime: 15 },
      [routeKey("s2", hotelEndId("d1"))]: { recordedTime: 20 },
    };
    const slots = computeTimeline(day, routes);
    const stats = computeDayStats(day, slots, routes);
    expect(stats.spotCount).toBe(2);
    expect(stats.stayTotal).toBe(150);
    expect(stats.transitTotal).toBe(65);
    expect(stats.totalMins).toBe(215); // 08:00 → 11:35
    expect(stats.freeMins).toBe(0);
  });

  it("跨午夜總時長為正", () => {
    const day = {
      id: "d1",
      startTime: "23:00",
      spots: [{ id: "s1", stayDuration: 120 }],
    };
    const routes = {
      [routeKey(hotelStartId("d1"), "s1")]: { recordedTime: 30 },
      [routeKey("s1", hotelEndId("d1"))]: { recordedTime: 30 },
    };
    const slots = computeTimeline(day, routes);
    const stats = computeDayStats(day, slots, routes);
    expect(stats.totalMins).toBe(180); // 23:00 → 02:00 隔日
  });
});

describe("formatSlot", () => {
  it("同起訖只顯示一個時間", () => {
    expect(formatSlot({ start: "08:00", end: "08:00" })).toBe("08:00");
  });
  it("起訖不同顯示區間", () => {
    expect(formatSlot({ start: "08:30", end: "10:00" })).toBe("08:30–10:00");
  });
  it("無 start 回傳空", () => {
    expect(formatSlot(null)).toBe("");
  });
});
