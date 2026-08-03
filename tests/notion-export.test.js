import { describe, it, expect } from "vitest";
import { tripToNotionFiles, notionId, buildRecords } from "../js/services/notion-export.js";
import { parseCsv, detectCsvType } from "../js/services/notion-csv.js";

const dec = (u) => new TextDecoder().decode(u);

function makeState() {
  return {
    version: 4, tripName: "京都測試", tripStartDate: "2026-07-15",
    activeDayId: "d1", settings: {},
    notes: "", todos: [{ id: "t1", text: "換日圓", done: false }, { id: "t2", text: "訂票", done: true }],
    accommodations: [{ id: "a1", name: "季針小路", type: "Airbnb", address: "京都", mapUrl: "", city: "京都", checkIn: "2026-07-15", checkOut: "2026-07-18", cost: "NT$73,646", paymentStatus: "Paid", bookingUrl: "", imageUrl: "" }],
    flights: [{ id: "f1", direction: "去程", airline: "國泰航空", flightNo: "CX564", cabin: "Economy", fromAirport: "TPE", departTime: "", toAirport: "KIX", arriveTime: "", duration: "2 hrs 45 mins", international: true }],
    guides: [{ id: "g1", title: "京都景點", city: "京都", imageUrl: "", body: "清水寺\n伏見稻荷" }],
    days: [{
      id: "d1", label: "Day 1", startTime: "09:00", startHotelName: "", endHotelName: "",
      spots: [
        { id: "s1", name: "伏見稻荷", stayDuration: 85, notes: "自由參加", category: "sightseeing", lat: 34.96, lng: 135.77, resolvedAddress: "京都市", openingHours: "24 hrs", imageUrl: "http://x/y.jpg" },
        { id: "s2", name: "京都車站", stayDuration: 80, notes: "", category: "food", lat: null, lng: null, resolvedAddress: "", openingHours: "", imageUrl: "" },
      ],
    }],
    routes: { "s1→s2": { transport: "transit", recordedTime: 10 } },
  };
}

describe("tripToNotionFiles", () => {
  const files = tripToNotionFiles(makeState());
  const byPath = Object.fromEntries(files.map((f) => [f.path, dec(f.bytes)]));

  it("含頂層 md 與行程 CSV", () => {
    expect(byPath["京都測試.md"]).toContain("換日圓");
    expect(byPath["京都測試.md"]).toContain("- [x] 訂票");
    expect(byPath["京都測試/行程.csv"]).toBeDefined();
  });
  it("行程 CSV 表頭可被自身辨識為 itinerary", () => {
    const rows = parseCsv(byPath["京都測試/行程.csv"]);
    expect(detectCsvType(rows[0])).toBe("itinerary");
  });
  it("景點列含中文類別與時長字串、交通段獨立成列", () => {
    const csv = byPath["京都測試/行程.csv"];
    expect(csv).toContain("景點參觀");
    expect(csv).toContain("1 hr 25 mins"); // 85 分
    expect(csv).toContain("伏見稻荷 - 京都車站"); // leg
    expect(csv).toContain("大眾運輸");
  });
  it("有資料才產生住宿/交通/攻略檔", () => {
    expect(byPath["京都測試/住宿.csv"]).toContain("季針小路");
    expect(byPath["京都測試/交通.csv"]).toContain("CX564");
    expect(byPath["京都測試/旅遊攻略.csv"]).toContain("京都景點");
    expect(byPath["京都測試/旅遊攻略/京都景點.md"]).toContain("清水寺");
  });
});

describe("notionId", () => {
  it("回傳 32 個小寫 hex 字元", () => {
    expect(notionId("行程")).toMatch(/^[0-9a-f]{32}$/);
  });
  it("同一 seed 確定性、不同 seed 不同", () => {
    expect(notionId("db:行程")).toBe(notionId("db:行程"));
    expect(notionId("db:行程")).not.toBe(notionId("db:住宿"));
  });
});

describe("buildRecords", () => {
  const recs = buildRecords(makeState());

  it("行程：交通段獨立成列、含移動方式，且無座標欄", () => {
    const leg = recs["行程"].find((r) => r.values.Details === "伏見稻荷 - 京都車站");
    expect(leg).toBeTruthy();
    expect(leg.values["移動方式"]).toBe("大眾運輸");
    const spot = recs["行程"].find((r) => r.values.Details === "伏見稻荷");
    expect(spot.values["類別"]).toBe("景點參觀");
    expect(spot.values["時間"]).toBe("1 hr 25 mins");
    expect(spot.values).not.toHaveProperty("緯度");
    expect(spot.values).not.toHaveProperty("經度");
    expect(spot.dayId).toBe("d1");
  });

  it("住宿：日期範圍與付款欄對映", () => {
    const a = recs["住宿"][0];
    expect(a.values.Name).toBe("季針小路");
    expect(a.values["日期"]).toBe("July 15, 2026 → July 18, 2026");
    expect(a.values["付款類型"]).toBe("Paid");
    expect(a.values["類型"]).toBe("Airbnb");
  });

  it("交通：類型依 international 對映、標題欄為 Transport", () => {
    const f = recs["交通"][0];
    expect(f.values.Transport).toBe("去程");
    expect(f.values["No."]).toBe("CX564");
    expect(f.values["類型"]).toBe("International");
  });

  it("旅遊攻略：body 帶內文", () => {
    const g = recs["旅遊攻略"][0];
    expect(g.values.Name).toBe("京都景點");
    expect(g.body).toContain("清水寺");
  });
});
