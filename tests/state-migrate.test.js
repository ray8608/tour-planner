import { describe, it, expect } from "vitest";
import { defaultState, makeSpot, migrateState } from "../js/state.js";

describe("state 模型擴充", () => {
  it("makeSpot 具備 openingHours / imageUrl", () => {
    const sp = makeSpot("清水寺");
    expect(sp.openingHours).toBe("");
    expect(sp.imageUrl).toBe("");
  });

  it("defaultState 具備 trip 層側記錄欄位且 version=4", () => {
    const s = defaultState();
    expect(s.version).toBe(4);
    expect(s.notes).toBe("");
    expect(s.todos).toEqual([]);
    expect(s.accommodations).toEqual([]);
    expect(s.flights).toEqual([]);
    expect(s.guides).toEqual([]);
  });

  it("migrateState 為舊資料補齊新欄位、保留既有 days/routes", () => {
    const old = {
      version: 3,
      tripName: "舊行程",
      days: [{ id: "d1", label: "第 1 天", startTime: "09:00", spots: [{ id: "s1", name: "A", stayDuration: 30 }] }],
      routes: { "hs_d1→s1": { transport: "walking", recordedTime: 10 } },
    };
    const m = migrateState(old);
    expect(m.notes).toBe("");
    expect(m.todos).toEqual([]);
    expect(m.accommodations).toEqual([]);
    expect(m.flights).toEqual([]);
    expect(m.guides).toEqual([]);
    expect(m.days[0].spots[0].openingHours).toBe("");
    expect(m.days[0].spots[0].imageUrl).toBe("");
    expect(m.days[0].spots[0].name).toBe("A");
    expect(m.routes["hs_d1→s1"].recordedTime).toBe(10);
  });
});
