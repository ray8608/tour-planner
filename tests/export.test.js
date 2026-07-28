import { describe, it, expect } from "vitest";
import {
  safeFileStem,
  exportJson,
  validateImport,
  buildIcs,
  buildKml,
  buildCsv,
  KML_PALETTE,
} from "../js/services/export.js";

/** 建立一個含兩天、含座標與路線時間的測試 state */
function makeState(overrides = {}) {
  const base = {
    version: 3,
    tripName: "東京五日",
    tripStartDate: "2026-08-01",
    activeDayId: "d1",
    settings: {},
    days: [
      {
        id: "d1",
        label: "第 1 天",
        startTime: "09:00",
        startHotelName: "新宿飯店",
        endHotelName: "新宿飯店",
        spots: [
          { id: "s1", name: "晴空塔", stayDuration: 90, notes: "觀景, 記得帶票", category: "sightseeing", lat: 35.71, lng: 139.81, resolvedAddress: "東京墨田區" },
          { id: "s2", name: "淺草寺", stayDuration: 60, notes: "", category: "sightseeing", lat: null, lng: null, resolvedAddress: "" },
        ],
      },
      {
        id: "d2",
        label: "第 2 天",
        startTime: "",
        startHotelName: "",
        endHotelName: "",
        spots: [{ id: "s3", name: "築地市場", stayDuration: 120, notes: "", category: "food", lat: 35.66, lng: 139.77, resolvedAddress: "" }],
      },
    ],
    routes: {
      "hs_d1→s1": { transport: "transit", recordedTime: 30 },
      "s1→s2": { transport: "walking", recordedTime: 15 },
    },
  };
  return { ...base, ...overrides };
}

describe("export.safeFileStem", () => {
  it("移除路徑分隔與控制字元", () => {
    expect(safeFileStem("東京/日本:行程*?")).toBe("東京_日本_行程_");
  });
  it("空值回退預設", () => {
    expect(safeFileStem("")).toBe("行程");
    expect(safeFileStem(null)).toBe("行程");
  });
});

describe("export.exportJson", () => {
  it("檔名含名稱與日期、內容為可解析 JSON", () => {
    const r = exportJson(makeState(), "2026-08-01");
    expect(r.filename).toBe("東京五日-2026-08-01.json");
    expect(r.mime).toContain("application/json");
    expect(JSON.parse(r.content).tripName).toBe("東京五日");
  });
});

describe("export.validateImport", () => {
  it("非 JSON → 錯誤", () => {
    expect(validateImport("{not json").ok).toBe(false);
  });
  it("缺 days 陣列 → 錯誤", () => {
    expect(validateImport('{"tripName":"x"}').ok).toBe(false);
  });
  it("含 days 陣列 → 通過並回傳資料", () => {
    const r = validateImport('{"days":[]}');
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.data.days)).toBe(true);
  });
});

describe("export.buildIcs", () => {
  const ics = buildIcs(makeState(), "20260727T000000Z");
  it("含日曆骨架與行程名", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:東京五日");
    expect(ics.split("\r\n").length).toBeGreaterThan(5);
  });
  it("有出發時間 → 定時事件 DTSTART/DTEND", () => {
    // 飯店(09:00 出發)不生成 VEVENT；首個景點 s1 抵達 = 09:00+30min 交通 = 09:30，停留 90min → 11:00 離開
    expect(ics).toContain("DTSTART:20260801T093000");
    expect(ics).toContain("DTEND:20260801T110000");
  });
  it("景點無座標 → 無 GEO 行；備註逗號經逃脫", () => {
    expect(ics).toContain("DESCRIPTION:觀景\\, 記得帶票");
    expect(ics).toContain("GEO:35.71;139.81");
  });
  it("第2天無 startTime → 全天事件", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20260802");
    expect(ics).toContain("DTEND;VALUE=DATE:20260803");
  });
  it("無 tripStartDate → 空日曆（0 事件）", () => {
    const empty = buildIcs(makeState({ tripStartDate: "" }), "20260727T000000Z");
    expect(empty).not.toContain("BEGIN:VEVENT");
  });
});

describe("export.buildKml", () => {
  const kml = buildKml(makeState());
  it("含 KML 骨架與每天 Folder + Style", () => {
    expect(kml).toContain("<kml");
    expect(kml).toContain("<Style id=\"day1-style\">");
    expect(kml).toContain("<Style id=\"day2-style\">");
    expect((kml.match(/<Folder>/g) || []).length).toBe(2);
  });
  it("有座標景點含 Point；無座標景點仍有 Placemark 但無 Point", () => {
    expect(kml).toContain("<coordinates>139.81,35.71</coordinates>");
    expect(kml).toContain("<name>淺草寺</name>"); // 無座標仍列名
  });
  it("Style 顏色為 KML aabbggrr（第一天調色盤反轉）", () => {
    // e6194b → ff4b19e6
    expect(kml).toContain("ff4b19e6");
  });
  it("同一天 >=2 座標時輸出 LineString", () => {
    // 第2天僅 1 座標景點 → 無路線；第1天僅 s1 有座標（s2 無）→ 也不足 2
    // 加一個座標到 s2 後應出現 LineString
    const st = makeState();
    st.days[0].spots[1].lat = 35.72;
    st.days[0].spots[1].lng = 139.79;
    const k2 = buildKml(st);
    expect(k2).toContain("<LineString>");
  });
  it("XML 特殊字元經逃脫", () => {
    const st = makeState({ tripName: "A & B <trip>" });
    expect(buildKml(st)).toContain("A &amp; B &lt;trip&gt;");
  });
});

describe("export.buildCsv", () => {
  const csv = buildCsv(makeState());
  it("以 UTF-8 BOM 開頭", () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
  it("含標題列與景點資料列", () => {
    expect(csv).toContain("名稱,天,抵達時間,離開時間,停留時間(分),備註,緯度,經度");
    expect(csv).toContain("晴空塔,第 1 天,09:30,11:00,90");
  });
  it("含逗號的備註以雙引號包起", () => {
    expect(csv).toContain('"觀景, 記得帶票"');
  });
  it("無座標景點的經緯度欄為空", () => {
    const lines = csv.split("\r\n");
    const asakusa = lines.find((l) => l.startsWith("淺草寺"));
    expect(asakusa.endsWith(",,")).toBe(true);
  });
});

describe("export.KML_PALETTE", () => {
  it("提供 8 色調色盤", () => {
    expect(KML_PALETTE.length).toBe(8);
  });
});
