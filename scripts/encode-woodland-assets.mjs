// Browser delivery derivatives only: no resize, crop, recoloring or generated
// content. Preserve the original PNG masters and record decoded-image error so
// this optimization never masquerades as lossless source preservation.
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
const quality = 82;
const records = [];
const derivatives = [];
for (const name of ['kitchen-scene', 'food-atlas', 'parchment', 'timber']) {
  const source = `apps/web/public/woodland/${name}.png`;
  const target = `apps/web/public/woodland/${name}.webp`;
  const input = await fs.readFile(path.join(root, source));
  const output = await sharp(input).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
  const originalPixels = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const encodedPixels = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (JSON.stringify(originalPixels.info) !== JSON.stringify(encodedPixels.info)) {
    throw new Error(`Decoded dimensions or channel layout changed for ${name}; derivative not written.`);
  }
  let absoluteError = 0;
  let squaredError = 0;
  for (let index = 0; index < originalPixels.data.length; index += 1) {
    const difference = Math.abs(originalPixels.data[index] - encodedPixels.data[index]);
    absoluteError += difference;
    squaredError += difference * difference;
  }
  derivatives.push({ target, output });
  records.push({
    source,
    target,
    sourceBytes: input.length,
    targetBytes: output.length,
    reductionPercent: Number((100 * (1 - output.length / input.length)).toFixed(1)),
    width: originalPixels.info.width,
    height: originalPixels.info.height,
    channels: originalPixels.info.channels,
    meanAbsoluteChannelError: Number((absoluteError / originalPixels.data.length).toFixed(3)),
    rootMeanSquareChannelError: Number(Math.sqrt(squaredError / originalPixels.data.length).toFixed(3)),
    sourceSha256: sha256(input),
    targetSha256: sha256(output),
  });
}
// Validate every derivative before replacing any tracked delivery file.
await Promise.all(derivatives.map(({ target, output }) => fs.writeFile(path.join(root, target), output)));
const sourceBytes = records.reduce((n, record) => n + record.sourceBytes, 0);
const targetBytes = records.reduce((n, record) => n + record.targetBytes, 0);
const report = {
  encoder: `sharp ${sharp.versions.sharp}; webp ${sharp.versions.webp}`,
  lossless: false,
  quality,
  dimensionsPreserved: true,
  visuallyReviewed: false,
  records,
  sourceBytes,
  targetBytes,
  reductionPercent: Number((100 * (1 - targetBytes / sourceBytes)).toFixed(1)),
};
await fs.writeFile(path.join(root, 'docs/beta/checks/web-concept-encoding.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ files: records.length, sourceBytes, targetBytes, reductionPercent: report.reductionPercent, dimensionsPreserved: true }));
