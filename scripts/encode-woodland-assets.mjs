// Lossless file encoding only: no resize, crop, recoloring or generated content.
// Preserve the original PNGs and fail if the decoded pixel buffers differ.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json', { paths: [path.join(root, 'apps/web')] }));
const sharp = nextRequire('sharp');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const records = [];
for (const name of ['kitchen-scene', 'food-atlas', 'parchment', 'timber']) {
  const source = `apps/web/public/woodland/${name}.png`;
  const target = `apps/web/public/woodland/${name}.webp`;
  const input = await fs.readFile(path.join(root, source));
  const output = await sharp(input).webp({ lossless: true, effort: 6 }).toBuffer();
  const originalPixels = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const encodedPixels = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (JSON.stringify(originalPixels.info) !== JSON.stringify(encodedPixels.info) || !originalPixels.data.equals(encodedPixels.data)) {
    throw new Error(`Decoded pixels changed for ${name}; derivative not written.`);
  }
  await fs.writeFile(path.join(root, target), output);
  records.push({ source, target, sourceBytes: input.length, targetBytes: output.length, width: originalPixels.info.width, height: originalPixels.info.height, pixelsEqual: true, sourceSha256: sha256(input), targetSha256: sha256(output) });
}
const report = { encoder: `sharp ${sharp.versions.sharp}; webp ${sharp.versions.webp}`, lossless: true, records, sourceBytes: records.reduce((n, r) => n + r.sourceBytes, 0), targetBytes: records.reduce((n, r) => n + r.targetBytes, 0) };
await fs.writeFile(path.join(root, 'docs/beta/checks/web-concept-encoding.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ files: records.length, sourceBytes: report.sourceBytes, targetBytes: report.targetBytes, pixelsEqual: true }));
