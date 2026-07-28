import { describe, it, expect } from "vitest";
import {
  escapeHtml,
  addMinsToHHMM,
  hhmmToMins,
  fmtMins,
  routeKey,
  getDayDate,
  getDayDateTime,
} from "../js/utils.js";

describe("escapeHtml", () => {
  it("跳脫 HTML 特殊字元防止 XSS", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });
  it("null / undefined 回傳空字串", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
  it("跳脫單引號", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });
});

describe("addMinsToHHMM", () => {
  it("一般相加", () => {
    expect(addMinsToHHMM("08:00", 90)).toBe("09:30");
  });
  it("跨午夜 wrap 到隔日", () => {
    expect(addMinsToHHMM("23:30", 60)).toBe("00:30");
  });
  it("負分鐘往回", () => {
    expect(addMinsToHHMM("00:30", -60)).toBe("23:30");
  });
  it("無效輸入原樣回傳", () => {
    expect(addMinsToHHMM("", 30)).toBe("");
  });
});

describe("hhmmToMins", () => {
  it("轉換為當日分鐘", () => {
    expect(hhmmToMins("08:15")).toBe(495);
  });
  it("無效回傳 null", () => {
    expect(hhmmToMins("abc")).toBeNull();
  });
});

describe("fmtMins", () => {
  it("時+分", () => expect(fmtMins(150)).toBe("2h 30m"));
  it("整時", () => expect(fmtMins(120)).toBe("2h"));
  it("僅分", () => expect(fmtMins(45)).toBe("45m"));
  it("零/負回傳 null", () => {
    expect(fmtMins(0)).toBeNull();
    expect(fmtMins(-5)).toBeNull();
  });
});

describe("routeKey", () => {
  it("以箭頭串接", () => expect(routeKey("a", "b")).toBe("a→b"));
});

describe("getDayDate", () => {
  it("依起始日 + 索引推算含星期", () => {
    // 2026-07-27 是週一
    expect(getDayDate("2026-07-27", 0)).toBe("7/27(一)");
    expect(getDayDate("2026-07-27", 1)).toBe("7/28(二)");
  });
  it("無起始日回傳空字串", () => {
    expect(getDayDate("", 0)).toBe("");
  });
});

describe("getDayDateTime", () => {
  it("依起始日 + 索引 + 出發時間組出 Date", () => {
    const d = getDayDateTime("2026-07-27", 1, "08:30");
    expect(d).toBeInstanceOf(Date);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // 7 月
    expect(d.getDate()).toBe(28); // +1 天
    expect(d.getHours()).toBe(8);
    expect(d.getMinutes()).toBe(30);
  });
  it("無出發時間預設上午 9:00", () => {
    const d = getDayDateTime("2026-07-27", 0, "");
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });
  it("無起始日回傳 null", () => {
    expect(getDayDateTime("", 0, "08:00")).toBeNull();
    expect(getDayDateTime(null, 0, "08:00")).toBeNull();
  });
});
