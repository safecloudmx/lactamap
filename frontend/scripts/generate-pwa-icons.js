/**
 * Generates PWA icon PNGs as solid-color squares using only Node.js built-ins.
 * Output: public/icon-192.png, public/icon-512.png, public/icon-180.png
 * Colors: LactaMap pink #f43f5e on white background with a heart-ish feel.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Brand colors
const PINK = [244, 63, 94];   // #f43f5e
const WHITE = [255, 255, 255];

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcVal = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

/**
 * Creates a PNG with a solid background and a centered circle.
 * bg: [r,g,b] background color
 * fg: [r,g,b] circle color
 */
function createCircleIconPNG(size, bg, fg) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42; // circle radius (84% diameter)

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const inCircle = dx * dx + dy * dy <= r * r;
      const [pr, pg, pb] = inCircle ? fg : bg;
      row[1 + x * 3]     = pr;
      row[2 + x * 3]     = pg;
      row[3 + x * 3]     = pb;
    }
    rows.push(row);
  }

  const rawData = Buffer.concat(rows);
  const compressed = zlib.deflateSync(rawData, { level: 6 });

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-180.png', size: 180 }, // Apple touch icon
];

sizes.forEach(({ name, size }) => {
  const buf = createCircleIconPNG(size, WHITE, PINK);
  fs.writeFileSync(path.join(PUBLIC_DIR, name), buf);
  console.log(`Created public/${name} (${buf.length} bytes)`);
});

console.log('PWA icons generated successfully.');
