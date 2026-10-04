/** Small, bounded header checks. This does NOT decode, sanitize or certify a file.
 * Based on WHATWG MIME Sniffing signatures, with M4A/ISO MP4 audio brands.
 * https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern
 * https://mimesniff.spec.whatwg.org/#matching-an-audio-or-video-type-pattern
 */
function asciiAt(bytes: Uint8Array, offset: number, value: string) {
  return offset >= 0 && offset + value.length <= bytes.length && Array.from(value).every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}
function starts(bytes: Uint8Array, signature: number[]) {
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}
function mp4Header(bytes: Uint8Array) {
  if (bytes.length < 16 || !asciiAt(bytes, 4, "ftyp")) return false;
  const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
  // Bound the brand scan; extended/unknown-sized boxes are not accepted here.
  if (size < 16 || size > bytes.length || size > 4096 || size % 4 !== 0) return false;
  const brands = ["M4A ", "M4B ", "isom", "iso2", "mp41", "mp42", "dash"];
  for (let offset = 8; offset + 4 <= size; offset += 4) {
    if (offset === 12) continue; // Minor version, not a brand.
    if (brands.some(brand => asciiAt(bytes, offset, brand))) return true;
  }
  return false;
}
function webmHeader(bytes: Uint8Array) {
  if (!starts(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return false;
  // Search only the small EBML header prefix, never arbitrary file contents.
  for (let offset = 4; offset < Math.min(38, bytes.length - 2); offset++) {
    if (bytes[offset] !== 0x42 || bytes[offset + 1] !== 0x82) continue;
    const start = offset + 2; const first = bytes[start]!;
    let width = 1; let marker = 0x80;
    while (width <= 8 && !(first & marker)) { width++; marker >>= 1; }
    if (width > 8 || start + width > bytes.length) continue;
    let length = first & (marker - 1);
    for (let index = 1; index < width && length <= 32; index++) length = length * 256 + bytes[start + index]!;
    if (length === 4 && asciiAt(bytes, start + width, "webm")) return true;
  }
  return false;
}
export function matchesFoodMediaHeader(bytes: Uint8Array, mediaType: string): boolean {
  if (bytes.length < 16) return false;
  switch (mediaType) {
    case "image/jpeg": return starts(bytes, [0xff, 0xd8, 0xff]);
    case "image/png": return starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && asciiAt(bytes, 12, "IHDR");
    case "image/webp": return asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP") && asciiAt(bytes, 12, "VP8");
    case "audio/mp4": return mp4Header(bytes);
    case "audio/webm": return webmHeader(bytes);
    case "audio/wav": return asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WAVE");
    case "audio/mpeg": {
      if (asciiAt(bytes, 0, "ID3")) return true;
      const second = bytes[1]!; const third = bytes[2]!;
      return bytes[0] === 0xff && (second & 0xe0) === 0xe0 && (second & 0x18) !== 0x08 && (second & 0x06) !== 0 && (third >> 4) > 0 && (third >> 4) < 15 && (third & 0x0c) !== 0x0c;
    }
    default: return false;
  }
}
