import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import test from 'node:test';

// Real Git archives, without touching this checkout's index or calling a DB.
// Drizzle hashes exact SQL text, so checkout/export line endings are significant.
const root = resolve(import.meta.dirname, '..');
const git = (cwd, args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
const paths = git(root, ['ls-files', 'packages/db/migrations/*.sql'])
  .toString('utf8').trim().split(/\r?\n/).filter(Boolean);
assert.ok(paths.length > 0, 'Expected tracked migration SQL');
const sources = new Map(paths.map(path => [path, git(root, ['show', `HEAD:${path}`])]));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function tarFiles(bytes) {
  const files = new Map();
  for (let offset = 0; offset + 512 <= bytes.length;) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const field = (start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/s, '');
    const name = field(0, 100);
    const size = parseInt(field(124, 136).trim(), 8) || 0;
    if (header[156] === 0 || header[156] === 48) {
      assert.ok(!files.has(name), `Duplicate archive entry: ${name}`);
      files.set(name, bytes.subarray(offset + 512, offset + 512 + size));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

for (const autocrlf of ['false', 'true', 'input']) {
  test(`migration archive bytes preserve canonical hashes with core.autocrlf=${autocrlf}`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'savortome-migration-archive-'));
    try {
      git(directory, ['init', '--quiet']);
      writeFileSync(join(directory, '.gitattributes'), readFileSync(join(root, '.gitattributes')));
      for (const [path, bytes] of sources) {
        assert.ok(!bytes.includes(Buffer.from('\r\n')), `Canonical SQL must use LF: ${path}`);
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        writeFileSync(join(directory, path), bytes);
      }
      git(directory, ['-c', `core.autocrlf=${autocrlf}`, 'add', '.']);
      const tree = git(directory, ['write-tree']).toString('utf8').trim();
      const files = tarFiles(git(directory, ['-c', `core.autocrlf=${autocrlf}`, 'archive', '--format=tar', tree]));
      for (const [path, bytes] of sources) {
        assert.ok(files.has(path), `Missing migration: ${path}`);
        assert.equal(hash(files.get(path)), hash(bytes), `Archive changed Drizzle migration identity: ${path}`);
      }
    } finally {
      const withinTemp = relative(resolve(tmpdir()), resolve(directory));
      assert.ok(!withinTemp.startsWith('..') && !withinTemp.includes('/') && !withinTemp.includes('\\'));
      assert.ok(withinTemp.startsWith('savortome-migration-archive-'));
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
