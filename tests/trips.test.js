import { describe, it, expect } from "vitest";
import {
  normalizeTripsContainer,
  tripSummaries,
  removeAt,
  TRIPS_KEY,
  LEGACY_KEY,
} from "../js/trips.js";

const trip = (name, days = 1) => ({
  tripName: name,
  days: Array.from({ length: days }, (_, i) => ({ id: "d" + i })),
});

describe("normalizeTripsContainer", () => {
  it("讀取有效容器並保留 activeIdx", () => {
    const c = { trips: [trip("A"), trip("B")], activeIdx: 1 };
    expect(normalizeTripsContainer(c, null)).toEqual({
      trips: c.trips,
      activeIdx: 1,
    });
  });

  it("activeIdx 越界時回退 0", () => {
    const c = { trips: [trip("A")], activeIdx: 9 };
    expect(normalizeTripsContainer(c, null).activeIdx).toBe(0);
    const c2 = { trips: [trip("A")], activeIdx: -3 };
    expect(normalizeTripsContainer(c2, null).activeIdx).toBe(0);
  });

  it("activeIdx 非整數時回退 0", () => {
    const c = { trips: [trip("A"), trip("B")] };
    expect(normalizeTripsContainer(c, null).activeIdx).toBe(0);
  });

  it("過濾掉非物件的 trip 項目", () => {
    const good = trip("A");
    const c = { trips: [null, good, 42, "x"], activeIdx: 1 };
    const r = normalizeTripsContainer(c, null);
    expect(r.trips).toEqual([good]);
  });

  it("容器無效但有 legacy 單行程 → 包成單元素", () => {
    const legacy = trip("舊行程");
    expect(normalizeTripsContainer(null, legacy)).toEqual({
      trips: [legacy],
      activeIdx: 0,
    });
  });

  it("容器 trips 為空陣列時改用 legacy", () => {
    const legacy = trip("舊行程");
    expect(normalizeTripsContainer({ trips: [] }, legacy)).toEqual({
      trips: [legacy],
      activeIdx: 0,
    });
  });

  it("完全無資料 → 空陣列（呼叫端補預設）", () => {
    expect(normalizeTripsContainer(null, null)).toEqual({ trips: [], activeIdx: 0 });
    expect(normalizeTripsContainer(undefined, undefined)).toEqual({ trips: [], activeIdx: 0 });
  });
});

describe("tripSummaries", () => {
  it("回傳含 index/name/placeholder/days/active 的摘要", () => {
    const trips = [trip("東京", 3), trip("大阪", 2)];
    const s = tripSummaries(trips, 1);
    expect(s).toEqual([
      { index: 0, name: "東京", placeholder: "未命名行程 1", days: 3, active: false },
      { index: 1, name: "大阪", placeholder: "未命名行程 2", days: 2, active: true },
    ]);
  });

  it("空白 / 缺名時 name 保留原值供就地編輯，placeholder 提示「未命名行程 N」", () => {
    const trips = [{ tripName: "  ", days: [] }, {}];
    const s = tripSummaries(trips, 0);
    expect(s[0].name).toBe("  ");
    expect(s[0].placeholder).toBe("未命名行程 1");
    expect(s[1].name).toBe("");
    expect(s[1].placeholder).toBe("未命名行程 2");
    expect(s[1].days).toBe(0);
  });
});

describe("removeAt", () => {
  const base = [trip("A"), trip("B"), trip("C")];

  it("刪除 active 之前 → activeIdx 前移", () => {
    const r = removeAt(base, 2, 0);
    expect(r.trips.map((t) => t.tripName)).toEqual(["B", "C"]);
    expect(r.activeIdx).toBe(1);
  });

  it("刪除 active 之後 → activeIdx 不變", () => {
    const r = removeAt(base, 0, 2);
    expect(r.trips.map((t) => t.tripName)).toEqual(["A", "B"]);
    expect(r.activeIdx).toBe(0);
  });

  it("刪除 active 本身且為最後一筆 → activeIdx 收斂到新末端", () => {
    const r = removeAt(base, 2, 2);
    expect(r.trips.map((t) => t.tripName)).toEqual(["A", "B"]);
    expect(r.activeIdx).toBe(1);
  });

  it("刪除 active 本身且為中間 → 停在同索引（下一筆遞補）", () => {
    const r = removeAt(base, 1, 1);
    expect(r.trips.map((t) => t.tripName)).toEqual(["A", "C"]);
    expect(r.activeIdx).toBe(1);
  });

  it("不可變：不動到原陣列", () => {
    const copy = [...base];
    removeAt(base, 1, 0);
    expect(base).toEqual(copy);
  });
});

describe("keys", () => {
  it("匯出穩定的儲存鍵", () => {
    expect(TRIPS_KEY).toBe("tour-planner-trips-v1");
    expect(LEGACY_KEY).toBe("tour-planner-v3");
  });
});
