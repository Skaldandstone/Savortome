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
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const o = rowStart + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
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

// Straight from apps/web/ui/tokens.css, so the icon and the app can't disagree.
const ACCENT = [180, 69, 31];
const YOLK = [244, 179, 76];
const WHITE = [255, 248, 240];
const CLEAR = [0, 0, 0, 0];

/**
 * A fried egg: a warm disc with a lighter centre, slightly above middle so it
 * doesn't look like it's sliding out of the frame.
 *
 * `scale` shrinks the mark for the adaptive foreground; `background` is false
 * there, because Android paints its own layer underneath.
 */
const egg =
  ({ scale = 1, background = true } = {}) =>
  (x, y, size) => {
    const cx = size / 2;
    const cy = size * 0.48;
    const d = Math.hypot(x - cx, y - cy);
    if (d < size * 0.16 * scale) return [...YOLK, 255];
    if (d < size * 0.3 * scale) return [...WHITE, 255];
    return background ? [...ACCENT, 255] : CLEAR;
  };

// A flat square for the Android notification icon's tint source, which Android
// renders as a silhouette — only the alpha channel survives, so colour here is
// irrelevant and shape is everything.
const eggSilhouette = (x, y, size) => {
  const d = Math.hypot(x - size / 2, y - size * 0.48);
  return d < size * 0.32 ? [255, 255, 255, 255] : CLEAR;
};

const write = (path, buffer) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  console.log(`${path}  ${buffer.length.toLocaleString()} bytes`);
};

// --- web: the installable PWA ------------------------------------------------

write("apps/web/public/icons/icon-192.png", png(192, egg()));
write("apps/web/public/icons/icon-512.png", png(512, egg()));

// --- mobile ------------------------------------------------------------------

// Both stores want 1024. iOS crops nothing, so the mark fills the frame.
write("apps/mobile/assets/icon.png", png(1024, egg()));

// Android masks the foreground and crops past the middle 66%, so the mark is
// drawn smaller and the ground is left to the background colour in app.json.
write("apps/mobile/assets/adaptive-icon.png", png(1024, egg({ scale: 0.62, background: false })));

// Rendered as a white silhouette in the status bar; only alpha matters.
write("apps/mobile/assets/notification-icon.png", png(96, eggSilhouette));

// The splash is the mark on the app's paper ground rather than the accent, so
// launching doesn't flash a full screen of orange.
write(
  "apps/mobile/assets/splash-icon.png",
  png(512, (x, y, size) => {
    const c = size / 2;
    const d = Math.hypot(x - c, y - size * 0.48);
    if (d < size * 0.16) return [...YOLK, 255];
    if (d < size * 0.3) return [...WHITE, 255];
    if (d < size * 0.33) return [...ACCENT, 255];
    return CLEAR;
  }),
);
