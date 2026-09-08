/**
 * Draws every app icon, for both platforms.
 *
 *   node scripts/make-icons.mjs
 *
 * Full-colour launcher icons are copied from the approved, versioned woodland
 * raster exports. The notification and splash marks remain code-generated so
 * their reduced platform treatments cannot drift from the app palette.
 *
 * Android masks its launcher artwork to circles, squircles, and other shapes,
 * so the painted source keeps its tome and botanical frame inside the safe
 * central region. The notification icon still needs a separate silhouette.
 */
import { deflateSync } from "node:zlib";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// --- a minimal PNG encoder ---------------------------------------------------

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function png(size, draw) {
  // One filter byte per row, then RGBA. Filter 0 (none) keeps this readable;
  // the deflate pass afterwards is where the size actually comes from.
  // Four samples per axis. A 32px favicon drawn with hard edges is a staircase;
  // the mark is all circles, so this is the difference between usable and not.
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < size; x++) {
      // Accumulate premultiplied: averaging straight RGBA pulls edge pixels
      // toward black wherever alpha is zero, which shows as a dark fringe.
      let pr = 0;
      let pg = 0;
      let pb = 0;
      let pa = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [r, g, b, a] = draw(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, size);
          const f = a / 255;
          pr += r * f;
          pg += g * f;
          pb += b * f;
          pa += f;
        }
      }

      const o = rowStart + 1 + x * 4;
      if (pa === 0) continue; // already zeroed, and dividing by it would not end well
      raw[o] = Math.round(pr / pa);
      raw[o + 1] = Math.round(pg / pa);
      raw[o + 2] = Math.round(pb / pa);
      raw[o + 3] = Math.round((pa / (SS * SS)) * 255);
    }
  }

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed) >>> 0);
    return Buffer.concat([len, typed, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- the Savortome mark ------------------------------------------------------

/**
 * An open recipe tome holds a single hearth flame. It keeps the warm charcoal,
 * parchment and ember palette from the original kitchen while replacing the
 * breakfast-specific skillet with a mark that fits recipes of every kind.
 *
 * The geometry stays on a 100-unit grid so the same source can produce a tiny
 * favicon, launcher icons, an Android adaptive layer and a notification glyph.
 */
const IRON = [74, 66, 58]; // #4A423A
const PARCHMENT = [251, 247, 239]; // #FBF7EF
const EMBER = [232, 154, 12]; // #E89A0C
const MOSS = [92, 98, 58]; // #5C623A
const CLEAR = [0, 0, 0, 0];

const COVER_LEFT = [[11, 43], [45, 34], [50, 40], [50, 80], [16, 72]];
const PAGE_LEFT = [[16, 40], [46, 36], [49, 42], [49, 74], [20, 67]];
const mirror = (points) => points.map(([x, y]) => [100 - x, y]);
const COVER_RIGHT = mirror(COVER_LEFT);
const PAGE_RIGHT = mirror(PAGE_LEFT);
const FLAME = [[50, 14], [60, 31], [58, 43], [50, 58], [42, 45], [40, 35], [47, 27]];
const FLAME_CORE = [[50, 29], [55, 39], [50, 50], [46, 42]];
const PAGE_LINES = [
  { x1: 23, y1: 51, x2: 43, y2: 48 },
  { x1: 24, y1: 58, x2: 43, y2: 56 },
  { x1: 57, y1: 48, x2: 77, y2: 51 },
  { x1: 57, y1: 56, x2: 76, y2: 58 },
];

function distToSegment(px, py, { x1, y1, x2, y2 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function inPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * `scale` shrinks the mark about the middle, for the Android adaptive
 * foreground. `ground` is the tile colour, or null to leave it transparent.
 */
const savortome =
  ({ scale = 1, ground = null } = {}) =>
  (x, y, size) => {
    const px = 50 + ((x / size) * 100 - 50) / scale;
    const py = 50 + ((y / size) * 100 - 50) / scale;

    // Frontmost first because each pixel returns on the first matching shape.
    if (inPolygon(px, py, FLAME_CORE)) return [...PARCHMENT, 255];
    if (inPolygon(px, py, FLAME)) return [...EMBER, 255];
    for (const line of PAGE_LINES) if (distToSegment(px, py, line) < 1.15) return [...IRON, 255];
    if (inPolygon(px, py, PAGE_LEFT) || inPolygon(px, py, PAGE_RIGHT)) return [...PARCHMENT, 255];
    if (inPolygon(px, py, COVER_LEFT) || inPolygon(px, py, COVER_RIGHT)) return [...MOSS, 255];
    return ground ? [...ground, 255] : CLEAR;
  };

/**
 * Android renders a notification icon as a flat silhouette: it keeps the alpha
 * and throws the colour away. A filled book-and-flame silhouette survives that
 * reduction more clearly than interior page details.
 */
const savortomeSilhouette = (x, y, size) => {
  const px = 50 + ((x / size) * 100 - 50) / 0.9;
  const py = 50 + ((y / size) * 100 - 50) / 0.9;
  if (
    inPolygon(px, py, FLAME) ||
    inPolygon(px, py, COVER_LEFT) ||
    inPolygon(px, py, COVER_RIGHT)
  ) return [255, 255, 255, 255];
  return CLEAR;
};

const write = (path, buffer) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  console.log(`${path}  ${buffer.length.toLocaleString()} bytes`);
};

const copy = (source, destination) => {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  console.log(`${destination}  from ${source}`);
};

const RASTER = "design/savortome/icons";

// --- web ---------------------------------------------------------------------

// Next serves these two by file convention, so no <link> tags are needed.
copy(`${RASTER}/app-icon-32-v1.png`, "apps/web/app/icon.png");
copy(`${RASTER}/app-icon-180-v1.png`, "apps/web/app/apple-icon.png");

// The installable PWA.
copy(`${RASTER}/app-icon-192-v1.png`, "apps/web/public/icons/icon-192.png");
copy(`${RASTER}/app-icon-512-v1.png`, "apps/web/public/icons/icon-512.png");

// A maskable icon is cropped to whatever shape the platform likes, so the mark
// is drawn well inside the safe area rather than filling the frame.
copy(`${RASTER}/app-icon-512-v1.png`, "apps/web/public/icons/icon-maskable-512.png");

// --- mobile ------------------------------------------------------------------

// iOS crops nothing and forbids transparency, so the artwork fills a solid tile.
copy(`${RASTER}/app-icon-1024-v1.png`, "apps/mobile/assets/icon.png");

// The painted subject stays inside Android's safe zone. The edge-to-edge
// woodland ground lets platform masks crop it without exposing empty corners.
copy(`${RASTER}/app-icon-1024-v1.png`, "apps/mobile/assets/adaptive-icon.png");

// Status bar. Only the alpha survives.
write("apps/mobile/assets/notification-icon.png", png(96, savortomeSilhouette));

// The splash sits on the app's own background colour, so the mark is drawn on
// transparency rather than carrying a tile of its own into a full-screen flash.
write("apps/mobile/assets/splash-icon.png", png(512, savortome({ scale: 0.8 })));
