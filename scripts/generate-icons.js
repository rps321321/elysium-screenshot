import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIZES = [16, 32, 48, 128];
const OUTPUT_DIR = join(__dirname, '..', 'public', 'icons');

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const size of SIZES) {
  const pixels = renderIcon(size);
  const png = encodePng(pixels, size, size);
  writeFileSync(join(OUTPUT_DIR, `icon-${size}.png`), png);
  console.log(`Generated icon-${size}.png (${png.length} bytes)`);
}

console.log('All icons generated!');

function renderIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.45;
  const cornerRadius = size * 0.18;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Rounded rect bounds
      let inside = true;
      if (x < cornerRadius && y < cornerRadius)
        inside = Math.hypot(x - cornerRadius, y - cornerRadius) <= cornerRadius;
      else if (x > size - 1 - cornerRadius && y < cornerRadius)
        inside = Math.hypot(x - (size - 1 - cornerRadius), y - cornerRadius) <= cornerRadius;
      else if (x < cornerRadius && y > size - 1 - cornerRadius)
        inside = Math.hypot(x - cornerRadius, y - (size - 1 - cornerRadius)) <= cornerRadius;
      else if (x > size - 1 - cornerRadius && y > size - 1 - cornerRadius)
        inside = Math.hypot(x - (size - 1 - cornerRadius), y - (size - 1 - cornerRadius)) <= cornerRadius;

      if (!inside) {
        pixels[i] = pixels[i+1] = pixels[i+2] = pixels[i+3] = 0;
        continue;
      }

      // Background gradient: indigo (#4f46e5) -> purple (#7c3aed)
      const t = (x + y) / (size * 2);
      let r = Math.round(79 + (124 - 79) * t);
      let g = Math.round(70 + (58 - 70) * t);
      let b = Math.round(229 + (237 - 229) * t);

      // Camera accent dot (bottom-right)
      if (size >= 32) {
        const dotDist = Math.hypot(x - size * 0.75, y - size * 0.75);
        if (dotDist <= size * 0.12) {
          r = 251; g = 191; b = 36; // yellow
          if (dotDist <= size * 0.06) { r = 79; g = 70; b = 229; } // indigo center
        }
      }

      // "E" letter using bars
      const nx = (x - cx) / radius;
      const ny = (y - cy) / radius;
      const thick = 0.14;

      // Vertical bar (left side of E)
      const isVert = nx > -0.45 && nx < -0.45 + thick && ny > -0.55 && ny < 0.55;
      // Top bar
      const isTop = ny > -0.55 && ny < -0.55 + thick && nx > -0.45 && nx < 0.35;
      // Middle bar
      const isMid = ny > -thick/2 && ny < thick/2 && nx > -0.45 && nx < 0.25;
      // Bottom bar
      const isBot = ny > 0.55 - thick && ny < 0.55 && nx > -0.45 && nx < 0.35;

      if (isVert || isTop || isMid || isBot) {
        r = 255; g = 255; b = 255;
      }

      pixels[i] = r;
      pixels[i+1] = g;
      pixels[i+2] = b;
      pixels[i+3] = 255;
    }
  }
  return pixels;
}

function encodePng(pixels, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // RGBA
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 4;
      const di = y * (1 + width * 4) + 1 + x * 4;
      rawData[di] = pixels[si];
      rawData[di+1] = pixels[si+1];
      rawData[di+2] = pixels[si+2];
      rawData[di+3] = pixels[si+3];
    }
  }
  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);

  // IEND
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
