/**
 * Erzeugt die App-Icons fuer Manifest, iOS-Home-Bildschirm und Favicon.
 *
 * Warum ein eigenes Skript statt fertiger Bilddateien: Das Spiel zeichnet auch
 * seine Spieltexturen prozedural (src/ui/textures.ts). Die Icons folgen
 * derselben Linie - dieselbe Sternform, dieselben Farben, und wer das Motiv
 * aendert, aendert eine Zahl statt fuenf Bilddateien.
 *
 * Warum ein PNG-Encoder von Hand: Icons brauchen echte PNG-Dateien (iOS
 * akzeptiert fuer `apple-touch-icon` kein SVG). Eine Bildbibliothek nur dafuer
 * ins Projekt zu holen, waere fuer vier Dateien unverhaeltnismaessig - PNG mit
 * Filter 0 ist wenig mehr als "zlib ueber die Bildzeilen".
 *
 * Aufruf:  npm run icons
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Muss zu Palette.backdrop und Palette.gold in src/ui/theme.ts passen. */
const BACKDROP = [0x0b, 0x10, 0x20];
const GOLD = [0xff, 0xd4, 0x79];
const WHITE = [0xff, 0xff, 0xff];

/**
 * Anteil der Bildbreite, den der Stern einnimmt.
 *
 * Bewusst klein: Android schneidet "maskable" Icons zu einem Kreis oder
 * Squircle zu und garantiert nur die inneren 80 % der Flaeche. Ein groesserer
 * Stern verlaere seine Zacken.
 */
const STAR_RADIUS_RATIO = 0.3;

const ICONS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // iOS ignoriert das Manifest und liest apple-touch-icon; 180 px ist die
  // Groesse, die aktuelle iPhones erwarten.
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon.png', size: 64 },
];

// --- PNG-Kodierung ----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 Bit je Kanal
  header[9] = 6; // RGBA
  header[10] = 0; // Deflate
  header[11] = 0; // Standardfilter
  header[12] = 0; // kein Interlacing

  // Jede Bildzeile bekommt ein fuehrendes Filter-Byte. Filter 0 = "keiner":
  // kostet etwas Kompression, spart die gesamte Filterlogik.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    const target = y * (stride + 1);
    raw[target] = 0;
    for (let i = 0; i < stride; i++) raw[target + 1 + i] = pixels[y * stride + i];
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Zeichnen ---------------------------------------------------------------

/** Zackenstern als Punktliste - dieselbe Form wie die Spielfigur. */
function starPolygon(center, outer, inner, spikes, rotation) {
  const points = [];
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / spikes) * i + rotation;
    points.push([center + Math.cos(angle) * radius, center + Math.sin(angle) * radius]);
  }
  return points;
}

function isInside(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function drawIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const center = size / 2;
  const outer = size * STAR_RADIUS_RATIO;

  const star = starPolygon(center, outer, outer * 0.34, 4, -Math.PI / 2);
  const innerStar = starPolygon(center, outer * 0.52, outer * 0.19, 4, -Math.PI / 2 + Math.PI / 4);

  // Kantenglaettung durch Ueberabtastung: 3x3 Proben je Bildpunkt. Ohne das
  // saehen die Zacken bei 64 px wie eine Treppe aus.
  const samples = 3;
  const step = 1 / (samples + 1);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;

      for (let sy = 1; sy <= samples; sy++) {
        for (let sx = 1; sx <= samples; sx++) {
          const px = x + sx * step;
          const py = y + sy * step;
          const distance = Math.hypot(px - center, py - center) / center;

          // Grundflaeche mit weichem Lichtschein zur Mitte hin.
          const glow = Math.max(0, 1 - distance) ** 2;
          let color = mix(BACKDROP, GOLD, glow * 0.22);

          if (isInside(innerStar, px, py)) {
            color = mix(GOLD, WHITE, 0.45);
          } else if (isInside(star, px, py)) {
            color = GOLD;
          }

          r += color[0];
          g += color[1];
          b += color[2];
        }
      }

      const count = samples * samples;
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(r / count);
      pixels[offset + 1] = Math.round(g / count);
      pixels[offset + 2] = Math.round(b / count);
      // Durchgehend deckend: iOS legt hinter transparente Icons Schwarz.
      pixels[offset + 3] = 255;
    }
  }

  return encodePng(size, pixels);
}

// --- Ausfuehrung ------------------------------------------------------------

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const icon of ICONS) {
  const png = drawIcon(icon.size);
  writeFileSync(join(OUTPUT_DIR, icon.file), png);
  console.log(`${icon.file.padEnd(22)} ${icon.size}x${icon.size}  ${png.length} Bytes`);
}
