import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(SCRIPT_DIR, "../public/icons");

let crcTable;

const crc32 = (buf) => {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
};

const createPng = (size, [r, g, b]) => {
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) {
    const i = 1 + x * 3;
    row[i] = r;
    row[i + 1] = g;
    row[i + 2] = b;
  }
  const raw = Buffer.alloc(size * row.length);
  for (let y = 0; y < size; y++) {
    row.copy(raw, y * row.length);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

mkdirSync(ICONS_DIR, { recursive: true });
const COLOR = [232, 89, 12];
writeFileSync(join(ICONS_DIR, "icon16.png"), createPng(16, COLOR));
writeFileSync(join(ICONS_DIR, "icon48.png"), createPng(48, COLOR));
writeFileSync(join(ICONS_DIR, "icon128.png"), createPng(128, COLOR));
