import { describe, it, expect } from "vitest";
import { zipStore, unzip, crc32 } from "../js/services/zip.js";

const enc = (s) => new TextEncoder().encode(s);
const dec = (u) => new TextDecoder().decode(u);

describe("zip.crc32", () => {
  it("符合已知向量：'123456789' → 0xCBF43926", () => {
    expect(crc32(enc("123456789")) >>> 0).toBe(0xcbf43926);
  });
});

describe("zip store round-trip", () => {
  it("zipStore → unzip 還原多檔內容與路徑", async () => {
    const files = [
      { path: "行程.csv", bytes: enc("名稱,天\nA,Day 1\n") },
      { path: "旅遊攻略/京都.md", bytes: enc("# 京都\n內文") },
    ];
    const zipped = zipStore(files);
    expect(zipped[0]).toBe(0x50); // 'P'
    expect(zipped[1]).toBe(0x4b); // 'K'
    const out = await unzip(zipped);
    const map = Object.fromEntries(out.map((f) => [f.path, dec(f.bytes)]));
    expect(map["行程.csv"]).toBe("名稱,天\nA,Day 1\n");
    expect(map["旅遊攻略/京都.md"]).toBe("# 京都\n內文");
  });

  it("設定 UTF-8 檔名旗標（flag bit 11），避免中文檔名亂碼", () => {
    const zipped = zipStore([{ path: "行程.csv", bytes: enc("x") }]);
    // local header general-purpose flag 在 offset 6（緊接 sig 4 + version 2）
    const localFlag = zipped[6] | (zipped[7] << 8);
    expect(localFlag & 0x0800).toBe(0x0800);
  });
});

describe("zip deflate 解壓", () => {
  it("能解 method=8（deflate）條目", async () => {
    // 用原生 CompressionStream 造一個 deflate 條目，組成 zip 後解回
    const raw = enc("hello deflate ".repeat(50));
    const cs = new CompressionStream("deflate-raw");
    const w = cs.writable.getWriter();
    w.write(raw); w.close();
    const comp = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    const { buildDeflateZip } = await import("./helpers/build-deflate-zip.js");
    const zip = buildDeflateZip("a.txt", raw, comp);
    const out = await unzip(zip);
    expect(dec(out[0].bytes)).toBe(dec(raw));
  });

  it("能解含 data descriptor 的串流式 zip（local header size=0，H1 回歸）", async () => {
    const raw = enc("streamed content ".repeat(40));
    const cs = new CompressionStream("deflate-raw");
    const w = cs.writable.getWriter();
    w.write(raw); w.close();
    const comp = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    const { buildDescriptorDeflateZip } = await import("./helpers/build-descriptor-zip.js");
    const zip = buildDescriptorDeflateZip("行程/資料.txt", raw, comp);
    const out = await unzip(zip);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("行程/資料.txt");
    expect(dec(out[0].bytes)).toBe(dec(raw));
  });
});

describe("zip 畸形輸入", () => {
  it("非 ZIP（無 EOCD）丟出明確錯誤而非靜默截斷", async () => {
    await expect(unzip(enc("this is not a zip file at all"))).rejects.toThrow(/ZIP/);
  });
});
