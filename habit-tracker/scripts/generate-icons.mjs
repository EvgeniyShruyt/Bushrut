/**
 * Генерирует PNG-иконки PWA без внешних зависимостей: клетчатый флаг в круге
 * гоночного красного на почти чёрном фоне (палитра из раздела 7 ТЗ).
 *
 * Запуск: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const BG = [0x0b, 0x0d, 0x10];
const RED = [0xe1, 0x06, 0x00];
const WHITE = [0xff, 0xff, 0xff];
const CYAN = [0x00, 0xd4, 0xff];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // фильтр None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixelAt(x, y);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 бит на канал
  ihdr[9] = 2; // truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function icon(size) {
  const center = size / 2;
  const outer = size * 0.40;
  const ring = size * 0.45;
  const flagHalf = size * 0.20;
  const cell = (flagHalf * 2) / 4;

  return (x, y) => {
    const dx = x + 0.5 - center;
    const dy = y + 0.5 - center;
    const dist = Math.hypot(dx, dy);

    if (dist > ring) return BG;
    if (dist > outer) return CYAN;

    // Клетчатый флаг внутри круга.
    if (Math.abs(dx) <= flagHalf && Math.abs(dy) <= flagHalf) {
      const cx = Math.floor((dx + flagHalf) / cell);
      const cy = Math.floor((dy + flagHalf) / cell);
      return (cx + cy) % 2 === 0 ? WHITE : BG;
    }
    return RED;
  };
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePng(size, icon(size)));
  console.log(`icons/icon-${size}.png`);
}
