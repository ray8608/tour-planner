/* ============================================================
   services/zip.js — 純函式 ZIP：store-only 打包 + 原生解壓
   匯出用 store（method=0）；匯入解 Notion zip（method=8）用
   瀏覽器原生 DecompressionStream('deflate-raw')。零依賴。
   ============================================================ */

/** CRC-32（IEEE 802.3），回傳 unsigned 32-bit */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
function le16(n) { return [n & 255, (n >>> 8) & 255]; }
function le32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }

/** store-only 打包。files: [{path, bytes:Uint8Array}] → Uint8Array */
export function zipStore(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const nameB = enc.encode(f.path);
    const data = f.bytes;
    const crc = crc32(data);
    local.push(
      ...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(crc),
      ...le32(data.length), ...le32(data.length),
      ...le16(nameB.length), ...le16(0), ...nameB, ...data
    );
    central.push(
      ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(crc),
      ...le32(data.length), ...le32(data.length),
      ...le16(nameB.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0),
      ...le32(0), ...le32(offset), ...nameB
    );
    offset += 30 + nameB.length + data.length;
  }
  const cdStart = offset;
  const end = [
    ...le32(0x06054b50), ...le16(0), ...le16(0),
    ...le16(files.length), ...le16(files.length),
    ...le32(central.length), ...le32(cdStart), ...le16(0),
  ];
  return new Uint8Array([...local, ...central, ...end]);
}

function readU16(b, o) { return b[o] | (b[o + 1] << 8); }
function readU32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 8 * 3)) >>> 0; }

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

/**
 * 解 zip。掃描 local file headers（method 0 store / 8 deflate）。
 * @returns {Promise<{path:string, bytes:Uint8Array}[]>}
 */
export async function unzip(bytes) {
  const dec = new TextDecoder();
  const out = [];
  let i = 0;
  while (i + 4 <= bytes.length && readU32(bytes, i) === 0x04034b50) {
    const method = readU16(bytes, i + 8);
    const compSize = readU32(bytes, i + 18);
    const nameLen = readU16(bytes, i + 26);
    const extraLen = readU16(bytes, i + 28);
    const nameStart = i + 30;
    const dataStart = nameStart + nameLen + extraLen;
    const path = dec.decode(bytes.subarray(nameStart, nameStart + nameLen));
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    if (!path.endsWith("/")) {
      const data = method === 8 ? await inflateRaw(comp) : comp.slice();
      out.push({ path, bytes: data });
    }
    i = dataStart + compSize;
  }
  return out;
}
