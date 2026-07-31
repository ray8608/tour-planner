// 造一個「串流式」zip：local header 的 crc/compSize/uncompSize 皆為 0、
// general-purpose flag bit 3=1，真實大小放在資料後的 data descriptor 與
// central directory。用於測試 unzip 是否以 central directory 為權威值
// （伺服器端串流打包如 Python zipfile / Go archive/zip 常見）。
import { crc32 } from "../../js/services/zip.js";

export function buildDescriptorDeflateZip(name, raw, comp) {
  const enc = new TextEncoder();
  const nameB = enc.encode(name);
  const crc = crc32(raw) >>> 0;
  const le16 = (n) => [n & 255, (n >>> 8) & 255];
  const le32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

  // local header：flag bit3 設定，sizes/crc 皆 0
  const local = [
    ...le32(0x04034b50), ...le16(20), ...le16(0x0008), ...le16(8),
    ...le16(0), ...le16(0), ...le32(0),
    ...le32(0), ...le32(0),
    ...le16(nameB.length), ...le16(0), ...nameB, ...comp,
  ];
  // data descriptor（含可選 signature）
  const descriptor = [...le32(0x08074b50), ...le32(crc), ...le32(comp.length), ...le32(raw.length)];
  const localBlock = [...local, ...descriptor];

  const central = [
    ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0x0008), ...le16(8),
    ...le16(0), ...le16(0), ...le32(crc),
    ...le32(comp.length), ...le32(raw.length),
    ...le16(nameB.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0),
    ...le32(0), ...le32(0), ...nameB,
  ];
  const cdStart = localBlock.length;
  const end = [
    ...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(1), ...le16(1),
    ...le32(central.length), ...le32(cdStart), ...le16(0),
  ];
  return new Uint8Array([...localBlock, ...central, ...end]);
}
