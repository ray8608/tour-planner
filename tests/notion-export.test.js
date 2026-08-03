import { describe, it, expect } from "vitest";
import { tripToNotionFiles, notionId, buildRecords, emitDbFiles, DB_SPECS } from "../js/services/notion-export.js";
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

describe("tripToNotionFiles（原生鏡像）", () => {
  const files = tripToNotionFiles(makeState());
  const byPath = Object.fromEntries(files.map((f) => [f.path, dec(f.bytes)]));
  const paths = Object.keys(byPath);

  it("頂層頁檔名帶 32-hex ID、含導覽與待辦", () => {
    const top = paths.find((p) => /^京都測試 [0-9a-f]{32}\.md$/.test(p));
    expect(top).toBeTruthy();
    expect(byPath[top]).toContain("## 快速導覽");
    expect(byPath[top]).toContain("- [x] 訂票");
    expect(byPath[top]).toContain("- [ ] 換日圓");
  });

  it("導覽連結為 URL-encoded 相對路徑，指向帶 ID 的 CSV", () => {
    const top = byPath[paths.find((p) => /^京都測試 [0-9a-f]{32}\.md$/.test(p))];
    const stem = encodeURIComponent("京都測試");
    expect(top).toMatch(new RegExp(`\\[行程\\]\\(${stem}/${encodeURIComponent("行程")}%20[0-9a-f]{32}\\.csv\\)`));
  });

  it("每個 present DB 有帶 ID 的雙 CSV 與不帶 ID 的子頁資料夾", () => {
    expect(paths.some((p) => /^京都測試\/行程 [0-9a-f]{32}\.csv$/.test(p))).toBe(true);
    expect(paths.some((p) => /^京都測試\/行程 [0-9a-f]{32}_all\.csv$/.test(p))).toBe(true);
    expect(paths.some((p) => /^京都測試\/行程\/伏見稻荷 [0-9a-f]{32}\.md$/.test(p))).toBe(true);
    expect(paths.some((p) => /^京都測試\/住宿 [0-9a-f]{32}\.csv$/.test(p))).toBe(true);
    expect(paths.some((p) => /^京都測試\/交通 [0-9a-f]{32}\.csv$/.test(p))).toBe(true);
    expect(paths.some((p) => /^京都測試\/旅遊攻略 [0-9a-f]{32}\.csv$/.test(p))).toBe(true);
  });

  it("行程檢視 CSV 可被辨識為 itinerary 且不含座標", () => {
    const p = paths.find((x) => /^京都測試\/行程 [0-9a-f]{32}\.csv$/.test(x));
    expect(detectCsvType(parseCsv(byPath[p])[0])).toBe("itinerary");
    expect(byPath[p]).not.toContain("34.96");
  });

  it("無資料的 DB 不產檔（此 state 皆有資料時共 4 個 DB）", () => {
    const empty = tripToNotionFiles({ ...makeState(), accommodations: [], flights: [], guides: [] });
    const ep = empty.map((f) => f.path);
    expect(ep.some((p) => p.includes("/住宿 "))).toBe(false);
    expect(ep.some((p) => p.includes("/行程 "))).toBe(true);
  });

  it("確定性：同一 state 兩次匯出得到完全相同的檔案集", () => {
    const a = tripToNotionFiles(makeState()).map((f) => [f.path, dec(f.bytes)]);
    const b = tripToNotionFiles(makeState()).map((f) => [f.path, dec(f.bytes)]);
    expect(a).toEqual(b);
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

describe("emitDbFiles", () => {
  const recs = buildRecords(makeState());
  const files = emitDbFiles("京都測試", "行程", recs["行程"], "abc");
  const byPath = Object.fromEntries(files.map((f) => [f.path, dec(f.bytes)]));

  it("產出檢視 + _all 雙 CSV，欄位順序正確", () => {
    const view = parseCsv(byPath["京都測試/行程 abc.csv"]);
    expect(view[0]).toEqual(["Details", "日期", "時間", "類別", "移動方式", "營業時間", "備註"]);
    const all = parseCsv(byPath["京都測試/行程 abc_all.csv"]);
    expect(all[0]).toEqual(["Details", "Day", "備註", "圖片", "地址", "日期", "時間", "營業時間", "移動方式", "類別"]);
  });

  it("檢視 CSV 不含座標字串", () => {
    expect(byPath["京都測試/行程 abc.csv"]).not.toContain("緯度");
    expect(byPath["京都測試/行程 abc.csv"]).not.toContain("34.96");
  });

  it("每列產一份 per-row 子頁（標題 + 非空屬性、順序正確）", () => {
    const pagePath = Object.keys(byPath).find((p) => /^京都測試\/行程\/伏見稻荷 [0-9a-f]{32}\.md$/.test(p));
    expect(pagePath).toBeTruthy();
    const md = byPath[pagePath];
    expect(md.startsWith("# 伏見稻荷\n")).toBe(true);
    expect(md).toContain("類別: 景點參觀");
    expect(md).toContain("營業時間: 24 hrs");
    expect(md).not.toContain("Day:");        // 行程頁不含 Day
    expect(md).not.toContain("移動方式:");     // 景點列無移動方式 → 省略
  });

  it("旅遊攻略頁：屬性後接 body 內文", () => {
    const gFiles = emitDbFiles("京都測試", "旅遊攻略", recs["旅遊攻略"], "gid");
    const gByPath = Object.fromEntries(gFiles.map((f) => [f.path, dec(f.bytes)]));
    const path = Object.keys(gByPath).find((p) => /^京都測試\/旅遊攻略\/京都景點 [0-9a-f]{32}\.md$/.test(p));
    expect(gByPath[path]).toContain("城市: 京都");
    expect(gByPath[path]).toContain("清水寺");
    // _all 表頭可被辨識為 guide
    expect(detectCsvType(parseCsv(gByPath["京都測試/旅遊攻略 gid_all.csv"])[0])).toBe("guide");
  });
});
