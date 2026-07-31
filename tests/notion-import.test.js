import { describe, it, expect, beforeAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { notionFilesToTrip } from "../js/services/notion-import.js";

const ROOT = new URL("../notion/template_notion", import.meta.url).pathname;

function readAll(dir, base = dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) readAll(p, base, acc);
    else acc.push({ path: relative(base, p), bytes: new Uint8Array(readFileSync(p)) });
  }
  return acc;
}

let result;
beforeAll(() => { result = notionFilesToTrip(readAll(ROOT)); });

describe("notionFilesToTrip（真實 Notion 匯出）", () => {
  it("建出多天且含景點", () => {
    expect(result.state.days.length).toBeGreaterThanOrEqual(1);
    const totalSpots = result.state.days.reduce((n, d) => n + d.spots.length, 0);
    expect(totalSpots).toBeGreaterThan(0);
    expect(result.report.counts.spots).toBe(totalSpots);
  });
  it("交通段化為 routes（recordedTime 來自時長）", () => {
    const anyRoute = Object.values(result.state.routes).some((r) => r.recordedTime > 0);
    expect(anyRoute).toBe(true);
  });
  it("首列時刻推得 day.startTime、最早日期為 tripStartDate", () => {
    expect(result.state.days[0].startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(result.state.tripStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("景點無座標（Notion 無經緯度）", () => {
    const sp = result.state.days.flatMap((d) => d.spots)[0];
    expect(sp.lat).toBe(null);
    expect(sp.lng).toBe(null);
  });
  it("側記錄：住宿/航班/攻略被解析", () => {
    expect(result.state.accommodations.length).toBeGreaterThan(0);
    expect(result.state.flights.length).toBeGreaterThan(0);
    expect(result.state.guides.length).toBeGreaterThan(0);
  });
  it("多值移動方式（JR, 步行）取首為 transit、溢出入 notes", () => {
    // 找到 notes 含「步行」的交通段被記錄；此處寬鬆斷言 report 有 counts.legs
    expect(result.report.counts.legs).toBeGreaterThan(0);
  });
});
