// Runs installed Next code in an isolated handler harness. No server or network.
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = resolve(root, 'apps/web');
const require = createRequire(resolve(web, 'package.json'));
const ts = require('typescript');
const { imageConfigDefault } = require('next/dist/shared/lib/image-config');
const optimizer = require('next/dist/server/image-optimizer');
const source = readFileSync(require.resolve('next/dist/server/next-server'), 'utf8');
const ast = ts.createSourceFile('next-server.js', source, ts.ScriptTarget.Latest, true);
let handler;
function visit(node) {
  if (ts.isBinaryExpression(node) && ts.isPropertyAccessExpression(node.left)
      && node.left.name.text === 'handleNextImageRequest' && ts.isArrowFunction(node.right)) {
    assert.equal(handler, undefined, 'ambiguous installed handler');
    handler = node.right.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(handler, 'installed Next handler must be located, not recreated');
const compiled = await build({ entryPoints: [resolve(web, 'next.config.ts')], bundle: true,
  write: false, platform: 'node', format: 'cjs' });
const sandbox = { module: { exports: {} }, process: { env: { NODE_ENV: 'production' } } };
runInNewContext(compiled.outputFiles[0].text, sandbox);
const config = sandbox.module.exports.default;

function fixture(images, dev = false) {
  const calls = { validation: 0, cache: 0, notFound: 0, moduleLoads: 0 };
  class Cache extends optimizer.ImageOptimizerCache {
    static validateParams(...args) { calls.validation++; return super.validateParams(...args); }
  }
  const server = {
    nextConfig: { images: { ...imageConfigDefault, ...images }, experimental: { isrFlushToDisk: false } },
    distDir: resolve(web, '.next-build'), renderOpts: { dev },
    imageResponseCache: { get() { calls.cache++; throw Error('OPTIMIZER_BOUNDARY'); } },
    async render404(_req, res) { calls.notFound++; res.statusCode = 404; },
  };
  const fn = runInNewContext(`(function () { return (${handler}); })`, {
    process: { env: {} },
    _requestmeta: { getRequestMeta: () => false },
    _routekind: require('next/dist/server/route-kind'),
    require(name) {
      if (name === './image-optimizer') { calls.moduleLoads++; return { ...optimizer, ImageOptimizerCache: Cache }; }
      if (name === './serve-static') return { getExtension: () => 'png' };
      throw Error(`Unexpected dependency: ${name}`);
    },
  }).call(server);
  const req = { originalRequest: { headers: {} } };
  const res = { statusCode: 200, body() { return this; }, send() {} };
  return { calls, res, run: (query = {}, pathname = '/_next/image') => fn(req, res, { pathname, query }) };
}

test('source config disables optimizer while retaining metadata/static import support', () => {
  assert.equal(config.images.unoptimized, true);
  assert.equal(config.images.remotePatterns.length, 0);
  assert.notEqual(config.images.disableStaticImages, true);
});

for (const dev of [false, true]) {
  test(`installed ${dev ? 'development' : 'production'} handler rejects all image queries before validation/cache`, async () => {
    for (const query of [
      {}, { url: ['malformed'], w: 'nonsense', q: 'nonsense' },
      { url: 'https://synthetic.invalid/image.icns', w: '640', q: '75' },
      { url: '/woodland/kitchen-scene.webp', w: '640', q: '75' },
      { url: '/icon.png', w: '8', q: '70' },
      { url: '/api/recipes', w: '640', q: '75' },
    ]) {
      const f = fixture(config.images, dev);
      assert.equal(await f.run(query), true);
      assert.equal(f.res.statusCode, 404);
      assert.equal(f.calls.notFound, 1);
      assert.equal(f.calls.validation, 0);
      assert.equal(f.calls.cache, 0);
      assert.ok(f.calls.moduleLoads > 0, 'parser module is still imported, not removed');
    }
  });
}

test('baseline wildcard control reaches optimizer boundary without any fetch', async () => {
  const f = fixture({ remotePatterns: [{ protocol: 'https', hostname: '**' }], unoptimized: false });
  await assert.rejects(f.run({ url: 'https://synthetic.invalid/photo.png', w: '640', q: '75' }), /OPTIMIZER_BOUNDARY/);
  assert.equal(f.calls.validation, 1);
  assert.equal(f.calls.cache, 1);
});

test('removed wildcard independently rejects remote hosts if optimizer were enabled', async () => {
  const f = fixture({ ...config.images, unoptimized: false });
  await f.run({ url: 'https://synthetic.invalid/photo.png', w: '640', q: '75' });
  assert.equal(f.res.statusCode, 400);
  assert.equal(f.calls.cache, 0);
});

test('plain public image paths do not enter the optimizer handler', async () => {
  for (const path of ['/woodland/kitchen-scene.webp', '/icons/icon-192.png', '/icon.png', '/apple-icon.png']) {
    const f = fixture(config.images);
    assert.equal(await f.run({}, path), false);
    assert.deepEqual(f.calls, { validation: 0, cache: 0, notFound: 0, moduleLoads: 0 });
  }
});

test('installed metadata sizing preserves the actual Savortome icon dimensions', async () => {
  assert.deepEqual(await optimizer.getImageSize(readFileSync(resolve(web, 'app/icon.png'))), { width: 32, height: 32 });
  assert.deepEqual(await optimizer.getImageSize(readFileSync(resolve(web, 'app/apple-icon.png'))), { width: 180, height: 180 });
});

test('new web image-loader imports require this exposure review to be revisited', () => {
  const findings = [];
  function scan(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        const text = readFileSync(path, 'utf8');
        const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
        function check(node) {
          const value = ts.isStringLiteralLike(node) ? node.text : '';
          const imported = node.parent && (ts.isImportDeclaration(node.parent) || ts.isExportDeclaration(node.parent)
            || (ts.isCallExpression(node.parent) && (node.parent.expression.kind === ts.SyntaxKind.ImportKeyword
              || node.parent.expression.getText(tree) === 'require')));
          if (imported && (/^(next\/(image|legacy\/image|og)|sharp|image-size)(\/|$)/.test(value)
              || /\.(png|jpe?g|webp|gif|avif|ico|icns|jxl|svg)$/.test(value))) {
            findings.push(`${relative(root, path)}: ${value}`);
          }
          ts.forEachChild(node, check);
        }
        check(tree);
      }
    }
  }
  for (const dir of ['app', 'modules', 'lib', 'ui']) scan(resolve(web, dir));
  assert.deepEqual(findings, [], 'review new runtime/static parsing paths before adopting them');
});
