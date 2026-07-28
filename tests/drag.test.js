import { describe, it, expect } from "vitest";
import { moveSpotBefore, moveSpotToDay } from "../js/spot-move.js";

// 就地變更的 mutator（契約同 state.commit）；每個測試給一份新 draft
const draft = () => ({
  days: [
    { id: "d1", spots: [{ id: "s1" }, { id: "s2" }, { id: "s3" }] },
    { id: "d2", spots: [{ id: "s4" }] },
  ],
  routes: {
    "s1→s2": { recordedTime: 10 },
    "s2→s3": { recordedTime: 20 },
    "hs_d1→s1": { recordedTime: 5 },
    "s3→he_d1": { recordedTime: 8 },
  },
});

const ids = (day) => day.spots.map((s) => s.id);

describe("moveSpotBefore", () => {
  it("同天內：把 s3 移到 s1 之前", () => {
    const d = draft();
    moveSpotBefore(d, "s3", "d1", "s1", "d1");
    expect(ids(d.days[0])).toEqual(["s3", "s1", "s2"]);
  });

  it("清除被移動景點引用到的所有 routes", () => {
    const d = draft();
    moveSpotBefore(d, "s1", "d1", "s3", "d1");
    // s1 的鄰接路線（s1→s2、hs_d1→s1）失效被清除，其餘保留
    expect(d.routes["s1→s2"]).toBeUndefined();
    expect(d.routes["hs_d1→s1"]).toBeUndefined();
    expect(d.routes["s2→s3"]).toEqual({ recordedTime: 20 });
    expect(d.routes["s3→he_d1"]).toEqual({ recordedTime: 8 });
  });

  it("跨天：把 d1 的 s1 移到 d2 的 s4 之前", () => {
    const d = draft();
    moveSpotBefore(d, "s1", "d1", "s4", "d2");
    expect(ids(d.days[0])).toEqual(["s2", "s3"]);
    expect(ids(d.days[1])).toEqual(["s1", "s4"]);
  });

  it("beforeSpotId 不在目標天 → 附加到該天末端", () => {
    const d = draft();
    moveSpotBefore(d, "s1", "d1", "nope", "d2");
    expect(ids(d.days[1])).toEqual(["s4", "s1"]);
  });

  it("spotId === beforeSpotId → no-op", () => {
    const d = draft();
    moveSpotBefore(d, "s2", "d1", "s2", "d1");
    expect(ids(d.days[0])).toEqual(["s1", "s2", "s3"]);
  });

  it("來源天不存在該景點 → no-op", () => {
    const d = draft();
    moveSpotBefore(d, "ghost", "d1", "s1", "d1");
    expect(ids(d.days[0])).toEqual(["s1", "s2", "s3"]);
  });
});

describe("moveSpotToDay", () => {
  it("附加到目標天末端並自來源天移除", () => {
    const d = draft();
    moveSpotToDay(d, "s2", "d1", "d2");
    expect(ids(d.days[0])).toEqual(["s1", "s3"]);
    expect(ids(d.days[1])).toEqual(["s4", "s2"]);
  });

  it("清除被移動景點引用到的 routes", () => {
    const d = draft();
    moveSpotToDay(d, "s2", "d1", "d2");
    expect(d.routes["s1→s2"]).toBeUndefined();
    expect(d.routes["s2→s3"]).toBeUndefined();
    expect(d.routes["hs_d1→s1"]).toEqual({ recordedTime: 5 });
  });

  it("fromDayId === toDayId → no-op", () => {
    const d = draft();
    moveSpotToDay(d, "s1", "d1", "d1");
    expect(ids(d.days[0])).toEqual(["s1", "s2", "s3"]);
    expect(d.routes["s1→s2"]).toEqual({ recordedTime: 10 });
  });
});
