// Draws the app icons, four rising bars (the four skills, and a chart as in Writing Task 1) on deep blue,
// straight into PNG files without an image library. Usage: node tools/icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const out = path.join(__dirname, "..", "docs", "icons");
const BLUE = [33, 64, 112];
const WHITE = [255, 255, 255];
const GOLD = [236, 186, 84];

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encode(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);   // each row starts with filter byte 0
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bits per channel
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
  ]);
}

// in a unit square: four bars with rounded tops standing on one line, the last one gold; everything stays
// inside the maskable safe circle (radius 0.4), so Android can crop the icon to any shape
const BARS = [0.2, 0.3, 0.4, 0.5], W = 0.1, GAP = 0.05, LEFT = 0.225, BASE = 0.72;
function colourAt(x, y) {
  for (let k = 0; k < BARS.length; k++) {
    const x0 = LEFT + k * (W + GAP), top = BASE - BARS[k], r = W / 2;
    if (x < x0 || x > x0 + W || y > BASE || y < top) continue;
    // round the top: below top + r the bar is full width, above it a half disc
    if (y < top + r && Math.hypot(x - (x0 + r), y - (top + r)) > r) continue;
    return k === BARS.length - 1 ? GOLD : WHITE;
  }
  return null;
}
function inRounded(x, y, r) {
  const qx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0);
  const qy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0);
  return qx * qx + qy * qy <= r * r;
}
// corner = 0 fills the whole square (maskable and Apple icons); 5×5 samples per pixel smooth the edges
function draw(size, corner) {
  const S = 5, rgba = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      const sum = [0, 0, 0];
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = (px + (sx + 0.5) / S) / size, y = (py + (sy + 0.5) / S) / size;
          if (corner && !inRounded(x, y, corner)) continue;
          bg++;
          const c = colourAt(x, y) || BLUE;
          for (let i = 0; i < 3; i++) sum[i] += c[i];
        }
      }
      if (!bg) continue;
      const o = (py * size + px) * 4;
      for (let i = 0; i < 3; i++) rgba[o + i] = Math.round(sum[i] / bg);
      rgba[o + 3] = Math.round((255 * bg) / (S * S));
    }
  }
  return encode(size, rgba);
}

fs.mkdirSync(out, { recursive: true });
const ICONS = { "icon-192.png": [192, 0.22], "icon-512.png": [512, 0.22], "maskable-512.png": [512, 0], "apple-touch-icon.png": [180, 0] };
for (const [name, [size, corner]] of Object.entries(ICONS)) {
  const png = draw(size, corner);
  fs.writeFileSync(path.join(out, name), png);
  console.log(name, `${size}px`, `${(png.length / 1024).toFixed(1)} KB`);
}
