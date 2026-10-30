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

const OUTER_FLAME = { tip: 0.03, center: 0.64, radius: 0.31, lean: 0.08 };
const INNER_FLAME = { tip: 0.38, center: 0.75, radius: 0.15, lean: 0.04 };
const OUTER_COLOR = [232, 89, 12];
const INNER_COLOR = [255, 212, 59];
const SUPERSAMPLING = 4;

// Teardrop in unit coordinates: a circle at the bottom, tapering into a
// slightly leaning tip. sin^1.6 keeps the join with the circle smooth.
const insideFlame = (x, y, { tip, center, radius, lean }) => {
  if (y < tip) return false;
  if (y >= center) return (x - 0.5) ** 2 + (y - center) ** 2 <= radius ** 2;
  const t = (y - tip) / (center - tip);
  const axis = 0.5 + lean * (1 - t) ** 2;
  const halfWidth = radius * Math.sin((t * Math.PI) / 2) ** 1.6;
  return Math.abs(x - axis) <= halfWidth;
};

const sampleColor = (x, y) => {
  if (insideFlame(x, y, INNER_FLAME)) return INNER_COLOR;
  if (insideFlame(x, y, OUTER_FLAME)) return OUTER_COLOR;
  return null;
};

const createPng = (size) => {
  const rowLength = 1 + size * 4;
  const raw = Buffer.alloc(size * rowLength);
  const samples = SUPERSAMPLING ** 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const sum = [0, 0, 0];
      let hits = 0;
      for (let sy = 0; sy < SUPERSAMPLING; sy++) {
        for (let sx = 0; sx < SUPERSAMPLING; sx++) {
          const color = sampleColor(
            (px + (sx + 0.5) / SUPERSAMPLING) / size,
            (py + (sy + 0.5) / SUPERSAMPLING) / size,
          );
          if (!color) continue;
          hits++;
          color.forEach((channel, i) => (sum[i] += channel));
        }
      }
      const i = py * rowLength + 1 + px * 4;
      if (hits) {
        raw[i] = Math.round(sum[0] / hits);
        raw[i + 1] = Math.round(sum[1] / hits);
        raw[i + 2] = Math.round(sum[2] / hits);
      }
      raw[i + 3] = Math.round((hits / samples) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

mkdirSync(ICONS_DIR, { recursive: true });
writeFileSync(join(ICONS_DIR, "icon16.png"), createPng(16));
writeFileSync(join(ICONS_DIR, "icon48.png"), createPng(48));
writeFileSync(join(ICONS_DIR, "icon128.png"), createPng(128));
