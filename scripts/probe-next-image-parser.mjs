// Opt-in diagnosis, not a passing security test. Never run malformed input in
// the main isolate or through a real server. Each disposable worker has its own
// 32 MiB old-generation limit and a two-second deadline after module readiness.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));

if (!isMainThread) {
  const parser = require('next/dist/compiled/image-size');
  parentPort.postMessage({ ready: true });
  parentPort.once('message', bytes => {
    try { parentPort.postMessage({ result: parser(new Uint8Array(bytes)) }); }
    catch (error) { parentPort.postMessage({ parserError: error.name + ': ' + error.message }); }
  });
} else {
  if (!process.argv.includes('--bounded')) throw Error('Explicit --bounded is required');
  const icns = Buffer.alloc(16);
  icns.write('icns'); icns.writeUInt32BE(16, 4); icns.write('ICON', 8);
  const jxl = Buffer.alloc(36);
  jxl.writeUInt32BE(12); jxl.write('JXL ', 4); jxl.set([13, 10, 135, 10], 8);
  jxl.writeUInt32BE(12, 12); jxl.write('ftyp', 16); jxl.write('jxl ', 20); jxl.write('jxlp', 28);
  const cases = [
    ['actual-skillet-png', readFileSync(new URL('../apps/web/app/icon.png', import.meta.url))],
    ['zero-size-icns-chunk', icns], ['zero-size-jxl-partial-box', jxl],
  ];
  async function probe(name, bytes) {
    const start = Date.now();
    const worker = new Worker(new URL(import.meta.url), {
      env: {}, execArgv: [], workerData: null,
      resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 8, stackSizeMb: 2 },
      stdout: true, stderr: true,
    });
    // Drain without echoing runtime payloads. No inherited provider environment.
    worker.stdout.resume(); worker.stderr.resume();
    let loaded = false;
    return new Promise(resolve => {
      let done = false;
      let timer = setTimeout(() => finish({ outcome: 'startup-timeout' }), 5000);
      async function finish(result) {
        if (done) return;
        done = true; clearTimeout(timer);
        await worker.terminate();
        resolve({ name, bytes: bytes.length, loaded, elapsedMs: Date.now() - start, ...result });
      }
      worker.on('message', message => {
        if (message.ready) {
          loaded = true; clearTimeout(timer);
          timer = setTimeout(() => finish({ outcome: 'parse-timeout' }), 2000);
          worker.postMessage(bytes);
        } else finish({ outcome: message.result ? 'returned' : 'rejected', ...message });
      });
      worker.on('error', error => finish({ outcome: 'worker-error', code: error.code, error: error.message }));
      worker.on('exit', code => { if (!done) finish({ outcome: 'unexpected-exit', code }); });
    });
  }
  const parserPath = require.resolve('next/dist/compiled/image-size');
  const results = [];
  for (const [name, bytes] of cases) results.push(await probe(name, bytes));
  console.log(JSON.stringify({ recordedAt: new Date().toISOString(), nextVersion: require('next/package.json').version,
    parserSha256: createHash('sha256').update(readFileSync(parserPath)).digest('hex'),
    limits: { oldGenerationMiB: 32, youngGenerationMiB: 8, stackMiB: 2, startupMs: 5000, parseMs: 2000 },
    note: 'Heap limits are per isolate, not a total RSS cap. A malformed failure is residual risk, not a fix or endpoint exploit proof.',
    results }, null, 2));
  if (!results.every(r => r.loaded) || results[0].result?.width !== 32) process.exitCode = 1;
}
