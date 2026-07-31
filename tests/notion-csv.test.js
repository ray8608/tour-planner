import { describe, it, expect } from "vitest";
import {
  parseCsv, serializeCsv, parseDuration, formatDuration,
  parseNotionDate, detectCsvType,
  notionCategoryToEnum, enumCategoryToNotion,
  notionTransportToEnum, enumTransportToNotion,
} from "../js/services/notion-csv.js";

describe("parseCsv", () => {
  it("解析引號內逗號與換行、去除 BOM", () => {
    const rows = parseCsv('﻿a,b\n"x,y","line1\nline2"\n');
    expect(rows[0]).toEqual(["a", "b"]);
    expect(rows[1]).toEqual(["x,y", "line1\nline2"]);
  });
  it("處理跳脫雙引號 \"\"", () => {
    expect(parseCsv('"he said ""hi"""')[0][0]).toBe('he said "hi"');
  });
});

describe("serializeCsv round-trip", () => {
  it("含逗號/引號的值可 parse 回原值", () => {
    const rows = [["名稱", "備註"], ["A", 'x, "y"']];
    const back = parseCsv(serializeCsv(rows));
    expect(back).toEqual(rows);
  });
  it("以 BOM 開頭", () => {
    expect(serializeCsv([["a"]]).charCodeAt(0)).toBe(0xfeff);
  });
});

describe("parseDuration", () => {
  it.each([
    ["2 hrs 45 mins", 165],
    ["1 hr", 60],
    ["15 mins", 15],
    ["1 hr 10 mins", 70],
    ["3 hrs  15 mins", 195], // 雙空格 typo
    ["", 0],
    ["亂寫", 0],
  ])("%s → %i 分", (s, m) => expect(parseDuration(s)).toBe(m));
});

describe("formatDuration", () => {
  it.each([
    [165, "2 hrs 45 mins"],
    [60, "1 hr"],
    [15, "15 mins"],
    [0, ""],
  ])("%i 分 → %s", (m, s) => expect(formatDuration(m)).toBe(s));
});

describe("parseNotionDate", () => {
  it("24 小時制範圍：起訖時刻與 ISO 日期", () => {
    const r = parseNotionDate("July 15, 2026 9:05 (GMT+8) → 11:05");
    expect(r.isoDate).toBe("2026-07-15");
    expect(r.startClock).toBe("09:05");
    expect(r.endClock).toBe("11:05");
  });
  it("12 小時制 AM/PM（航班時刻）", () => {
    const r = parseNotionDate("July 15, 2026 2:50 PM (GMT+8)");
    expect(r.isoDate).toBe("2026-07-15");
    expect(r.startClock).toBe("14:50");
  });
  it("只有日期範圍（住宿）", () => {
    const r = parseNotionDate("July 18, 2026 → July 20, 2026");
    expect(r.isoDate).toBe("2026-07-18");
    expect(r.startClock).toBe("");
  });
  it("無法解析回空", () => {
    expect(parseNotionDate("")).toEqual({ isoDate: "", startClock: "", endClock: "" });
  });
});

describe("detectCsvType（欄位簽名）", () => {
  it("行程", () => {
    expect(detectCsvType(["日期","Day","Details","類別","移動方式","時間"])).toBe("itinerary");
  });
  it("住宿", () => {
    expect(detectCsvType(["Name","image","付款類型","地址","城市","日期","花費"])).toBe("accommodation");
  });
  it("交通（航班）", () => {
    expect(detectCsvType(["Transport","No.","出發機場","航空公司","飛行時間"])).toBe("flight");
  });
  it("攻略", () => {
    expect(detectCsvType(["Name","圖片","城市","筆記"])).toBe("guide");
  });
  it("無法辨識回 null", () => {
    expect(detectCsvType(["foo","bar"])).toBe(null);
  });
});

describe("類別／交通對映", () => {
  it("Notion 類別 → enum", () => {
    expect(notionCategoryToEnum("景點參觀")).toBe("sightseeing");
    expect(notionCategoryToEnum("晚餐")).toBe("food");
    expect(notionCategoryToEnum("購物")).toBe("shopping");
    expect(notionCategoryToEnum("自由活動")).toBe("activity");
    expect(notionCategoryToEnum("")).toBe(null);
  });
  it("enum → Notion 類別", () => {
    expect(enumCategoryToNotion("sightseeing")).toBe("景點參觀");
    expect(enumCategoryToNotion("food")).toBe("餐飲");
  });
  it("Notion 交通多值 → 取首＋溢出", () => {
    expect(notionTransportToEnum("JR, 步行")).toEqual({ id: "transit", overflow: "步行" });
    expect(notionTransportToEnum("步行")).toEqual({ id: "walking", overflow: "" });
    expect(notionTransportToEnum("飛機")).toEqual({ id: "transit", overflow: "飛機" });
    expect(notionTransportToEnum("包車接送")).toEqual({ id: "driving", overflow: "" });
  });
  it("enum → Notion 交通", () => {
    expect(enumTransportToNotion("transit")).toBe("大眾運輸");
    expect(enumTransportToNotion("walking")).toBe("步行");
  });
});
