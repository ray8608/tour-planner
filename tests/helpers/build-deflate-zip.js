// 最小 zip：single method=8 entry。用於測試 unzip 的 inflate 路徑。
import { crc32 } from "../../js/services/zip.js";

export function buildDeflateZip(name, raw, comp) {
  const enc = new TextEncoder();
  const nameB = enc.encode(name);
  const crc = crc32(raw) >>> 0;
  const le16 = (n) => [n & 255, (n >>> 8) & 255];
  const le32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const local = [
    ...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(8),
    ...le16(0), ...le16(0), ...le32(crc),
    ...le32(comp.length), ...le32(raw.length),
    ...le16(nameB.length), ...le16(0), ...nameB, ...comp,
  ];
  const offset = 0;
  const central = [
    ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(8),
    ...le16(0), ...le16(0), ...le32(crc),
    ...le32(comp.length), ...le32(raw.length),
    ...le16(nameB.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0),
    ...le32(0), ...le32(offset), ...nameB,
  ];
  const cdStart = local.length;
  const end = [
    ...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(1), ...le16(1),
    ...le32(central.length), ...le32(cdStart), ...le16(0),
  ];
  return new Uint8Array([...local, ...central, ...end]);
}
