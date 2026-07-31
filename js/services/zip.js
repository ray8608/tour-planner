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
    // flag bit 11 (0x0800)：宣告檔名為 UTF-8，避免解壓程式以本地碼頁解讀中文檔名成亂碼
    local.push(
      ...le32(0x04034b50), ...le16(20), ...le16(0x0800), ...le16(0),
      ...le16(0), ...le16(0), ...le32(crc),
      ...le32(data.length), ...le32(data.length),
      ...le16(nameB.length), ...le16(0), ...nameB, ...data
    );
    central.push(
      ...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0x0800), ...le16(0),
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

/** 解壓後總量上限（防 zip-bomb OOM）；正常旅遊行程遠低於此。 */
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;

async function inflateRaw(bytes) {
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(bytes); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

/** 由檔尾往前找 End Of Central Directory（sig 0x06054b50）；找不到回 -1。 */
function findEocd(bytes) {
  const min = 22; // EOCD 固定長度
  const start = bytes.length - min;
  const limit = Math.max(0, bytes.length - min - 0xffff); // 允許最大 comment
  for (let i = start; i >= limit; i--) {
    if (readU32(bytes, i) === 0x06054b50) return i;
  }
  return -1;
}

/**
 * 解 zip。以 central directory 取權威 method/compSize/offset，
 * 正確處理 store（0）與 deflate（8），且不受 data descriptor
 * （general-purpose flag bit 3、local header size=0）影響。
 * @returns {Promise<{path:string, bytes:Uint8Array}[]>}
 */
export async function unzip(bytes) {
  const dec = new TextDecoder();
  const eocd = findEocd(bytes);
  if (eocd < 0) {
    throw new Error("不是有效的 ZIP（找不到 central directory）");
  }
  const count = readU16(bytes, eocd + 10);
  let cd = readU32(bytes, eocd + 16);
  const out = [];
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (readU32(bytes, cd) !== 0x02014b50) {
      throw new Error("ZIP central directory 損毀");
    }
    const method = readU16(bytes, cd + 10);
    const compSize = readU32(bytes, cd + 20);
    const nameLen = readU16(bytes, cd + 28);
    const extraLen = readU16(bytes, cd + 30);
    const commentLen = readU16(bytes, cd + 32);
    const localOff = readU32(bytes, cd + 42);
    const path = dec.decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
    cd += 46 + nameLen + extraLen + commentLen;

    if (path.endsWith("/")) continue; // 目錄項
    // 由 local header 定位資料起點（local 的 name/extra 長度可能與 central 不同）
    if (readU32(bytes, localOff) !== 0x04034b50) {
      throw new Error(`ZIP local header 損毀：${path}`);
    }
    const lNameLen = readU16(bytes, localOff + 26);
    const lExtraLen = readU16(bytes, localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);
    const data = method === 8 ? await inflateRaw(comp) : comp.slice();
    total += data.length;
    if (total > MAX_TOTAL_BYTES) {
      throw new Error("ZIP 解壓內容過大，已中止（疑似 zip-bomb）");
    }
    out.push({ path, bytes: data });
  }
  return out;
}
