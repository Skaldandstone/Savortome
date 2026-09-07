/**
 * Draws every app icon, for both platforms.
 *
 *   node scripts/make-icons.mjs
 *
 * The icons are generated rather than drawn so they can't drift from the app's
 * own colours, and so a change to the mark is one edit rather than six exports.
 * A full image pipeline would be more machinery than two circles earn, so this
 * writes the PNGs itself — the encoder below is the whole of it.
 *
 * Android's adaptive icon is the reason this isn't one file at several sizes.
 * A launcher masks the foreground layer to whatever shape it likes — circle,
 * squircle, teardrop — and crops anything outside the middle 66%. So the
 * adaptive foreground draws the mark smaller, on transparency, with the
 * background supplied as a flat colour underneath.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
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

// --- the mark ----------------------------------------------------------------

/**
 * Two eggs in a cast-iron skillet, handle toward the cook — you put a pan down
 * with the handle near you, not pointing away.
 *
 * Drawn on the same 100-unit grid as the master artwork, so every number below
 * matches the spec rather than approximating it. The whites overlap on purpose:
 * two eggs cracked into one pan run together, and the merge is what makes it
 * read as a face as well as a breakfast.
 */
const IRON = [74, 66, 58]; // #4A423A — warm charcoal; a true grey goes cold next to the yolk
const WHITE = [251, 247, 239]; // #FBF7EF
const YOLK = [232, 154, 12]; // #E89A0C
const CLEAR = [0, 0, 0, 0];

const PAN = { x: 40, y: 46, r: 32 };
const EGGS = [
  { x: 30, y: 40 },
  { x: 52, y: 40 },
];
const WHITE_R = 14;
const YOLK_R = 9;
const HANDLE = { x1: 61.3, y1: 60.9, x2: 85.9, y2: 78.1, w: 14 };

const within = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) < r;

/** The handle is a capsule: everything within half its width of the segment. */
function distToSegment(px, py, { x1, y1, x2, y2 }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * `scale` shrinks the mark about the middle, for the Android adaptive
 * foreground. `ground` is the tile colour, or null to leave it transparent.
 */
const skillet =
  ({ scale = 1, ground = null } = {}) =>
  (x, y, size) => {
    const px = 50 + ((x / size) * 100 - 50) / scale;
    const py = 50 + ((y / size) * 100 - 50) / scale;

    // Innermost first — painter's order, reversed. The handle is tested last so
    // its root disappears under the rim and the iron reads as one silhouette.
    for (const e of EGGS) if (within(px, py, e.x, e.y, YOLK_R)) return [...YOLK, 255];
    for (const e of EGGS) if (within(px, py, e.x, e.y, WHITE_R)) return [...WHITE, 255];
    if (within(px, py, PAN.x, PAN.y, PAN.r)) return [...IRON, 255];
    if (distToSegment(px, py, HANDLE) < HANDLE.w / 2) return [...IRON, 255];
    return ground ? [...ground, 255] : CLEAR;
  };

/**
 * Android renders a notification icon as a flat silhouette: it keeps the alpha
 * and throws the colour away. So the eggs become holes — the only way to keep
 * the face when you are allowed exactly one value.
 */
const skilletSilhouette = (x, y, size) => {
  const px = 50 + ((x / size) * 100 - 50) / 0.9;
  const py = 50 + ((y / size) * 100 - 50) / 0.9;
  for (const e of EGGS) if (within(px, py, e.x, e.y, WHITE_R)) return CLEAR;
  if (within(px, py, PAN.x, PAN.y, PAN.r)) return [255, 255, 255, 255];
  if (distToSegment(px, py, HANDLE) < HANDLE.w / 2) return [255, 255, 255, 255];
  return CLEAR;
};

const write = (path, buffer) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  console.log(`${path}  ${buffer.length.toLocaleString()} bytes`);
};

// --- web ---------------------------------------------------------------------

// Next serves these two by file convention, so no <link> tags are needed.
write("apps/web/app/icon.png", png(32, skillet({ ground: YOLK })));
write("apps/web/app/apple-icon.png", png(180, skillet({ ground: YOLK })));

// The installable PWA.
write("apps/web/public/icons/icon-192.png", png(192, skillet({ ground: YOLK })));
write("apps/web/public/icons/icon-512.png", png(512, skillet({ ground: YOLK })));

// A maskable icon is cropped to whatever shape the platform likes, so the mark
// is drawn well inside the safe area rather than filling the frame.
write(
  "apps/web/public/icons/icon-maskable-512.png",
  png(512, skillet({ scale: 0.72, ground: YOLK })),
);

// --- mobile ------------------------------------------------------------------

// iOS crops nothing and forbids transparency, so the mark fills a solid tile.
write("apps/mobile/assets/icon.png", png(1024, skillet({ ground: YOLK })));

// Android masks the foreground and crops past the middle 66%, so the mark is
// drawn smaller on transparency; app.json supplies the ground underneath.
write("apps/mobile/assets/adaptive-icon.png", png(1024, skillet({ scale: 0.62 })));

// Status bar. Only the alpha survives.
write("apps/mobile/assets/notification-icon.png", png(96, skilletSilhouette));

// The splash sits on the app's own background colour, so the mark is drawn on
// transparency rather than carrying a tile of its own into a full-screen flash.
write("apps/mobile/assets/splash-icon.png", png(512, skillet({ scale: 0.8 })));
