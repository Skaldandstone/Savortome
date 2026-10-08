// Actual recovery store; synthetic encrypted-storage/session/clock boundaries.
// Does not prove platform encryption, backup exclusion or physical restart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
const mocks = {
  'expo-secure-store': `export const WHEN_UNLOCKED_THIS_DEVICE_ONLY='synthetic-device-only'; export const getItemAsync=(...args)=>native.get(...args); export const setItemAsync=(...args)=>native.set(...args); export const deleteItemAsync=(...args)=>native.remove(...args);`,
  'expo-crypto': `export const CryptoDigestAlgorithm={SHA256:'synthetic-sha256'}; export const digestStringAsync=(algorithm,text)=>native.digest(algorithm,text);`,
  '@clerk/expo': `export const getClerkInstance=()=>({get session(){if(native.sessionError)throw Error('private-session-accessor');return native.session;}});`,
  './api': `export const apiBaseUrl=()=>native.origin;`,
};
const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `export {createFoodNoteRecoveryStore} from './apps/mobile/lib/foodNoteRecovery.ts'; export {createNativeFoodNoteRecovery} from './apps/mobile/lib/nativeFoodNoteRecovery.ts';` }, bundle: true, write: false, format: 'iife', globalName: 'recoveryModule', plugins: [{ name: 'real-contract-storage-boundaries', setup(api) {
  api.onResolve({ filter: /^@seconds\/core\/format$/ }, () => ({ path: `${process.cwd()}/packages/core/src/food-log.ts` }));
  api.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : undefined);
  api.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
} }] });
const context = { native: {}, setTimeout, clearTimeout, process: { env: { EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'synthetic-public-instance' } } }; runInNewContext(bundle.outputFiles[0].text, context);
const createStore = context.recoveryModule.createFoodNoteRecoveryStore;
const input = { id: '00000000-0000-4000-8000-000000000001', date: '2026-10-04', title: 'Synthetic soup', portion: null, source: 'text', expectedUpdatedAt: '2026-10-04T12:00:00.000Z' };
const draft = () => ({ kind: 'draft', input: { ...input }, uncertainty: 'Review the food name.' });
const plain = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
  const state = { session: { accountId: 'synthetic-account-a', sessionId: 'synthetic-session-a' }, clock: 1791115200000, values: new Map(), calls: [] };
  const storage = {
    get: async key => { state.calls.push(['get', key]); return state.values.get(key) ?? null; },
    set: async (key, value) => { state.calls.push(['set', key]); state.values.set(key, value); },
    remove: async key => { state.calls.push(['remove', key]); state.values.delete(key); },
  };
  const options = { ...state.session, environment: `synthetic-test-${++fixture.counter}`, currentSession: () => state.session, storage, digest: async text => createHash('sha256').update(text).digest('hex'), now: () => state.clock };
  return { state, storage, options, store: createStore(options) };
}
fixture.counter = 0;

test('actual native adapter fails closed and sanitizes unavailable initial SDK lookup for every operation', async () => {
  let calls = 0;
  Object.assign(context.native, { sessionError: true, origin: 'https://unavailable-synthetic.invalid',
    digest: async () => { calls++; return 'a'.repeat(64); },
    get: async () => { calls++; return null; }, set: async () => { calls++; }, remove: async () => { calls++; },
  });
  try {
    const store = context.recoveryModule.createNativeFoodNoteRecovery('native-account', 'native-session');
    for (const invoke of [() => store.read(true), () => store.keep(draft(), true), () => store.discard(true)]) {
      await assert.rejects(invoke(), error => /Local recovery could not be confirmed/.test(error.message) && !error.message.includes('private-session-accessor'));
    }
    assert.equal(calls, 0);
  } finally { context.native.sessionError = false; }
});
test('explicit consent is required for reads, writes and discard', async () => {
  const f = fixture();
  await assert.rejects(f.store.keep(draft(), false)); await assert.rejects(f.store.read(false)); await assert.rejects(f.store.discard(false));
  assert.equal(f.state.calls.length, 0);
});
test('new store instance restores exact draft identity/revision without sending or changing inventory', async () => {
  const f = fixture(); await f.store.keep(draft(), true);
  assert.deepEqual(plain(await createStore(f.options).read(true)), { status: 'review', recovery: draft() });
  assert.deepEqual(f.state.calls.map(call => call[0]), ['set', 'get']);
});
test('uncertain save stays uncertain; removal stores only the note identity', async () => {
  const f = fixture(); const uncertain = { ...draft(), kind: 'save-unconfirmed' }; await f.store.keep(uncertain, true);
  assert.deepEqual(plain(await f.store.read(true)), { status: 'review', recovery: uncertain });
  await f.store.keep({ kind: 'delete-unconfirmed', id: input.id, title: 'Must not persist', media: 'private-file' }, true);
  const raw = [...f.state.values.values()][0]; assert.doesNotMatch(raw, /Must not persist|private-file|title|portion|date/);
  assert.deepEqual(plain(await f.store.read(true)), { status: 'review', recovery: { kind: 'delete-unconfirmed', id: input.id } });
});
test('only allowlisted note data persists and mutation after invocation cannot change queued input', async () => {
  const f = fixture(); const value = { ...draft(), audio: 'private-uri', token: 'secret', input: { ...input, diagnosis: 'private', pantry: ['banana'] } };
  const pending = f.store.keep(value, true); value.input.title = 'Mutated later'; await pending;
  const raw = [...f.state.values.values()][0]; assert.doesNotMatch(raw, /private|secret|diagnosis|pantry|Mutated later/);
  assert.equal((await f.store.read(true)).recovery.input.title, input.title);
});
test('accounts and environments never share keys; transplanted envelope is rejected', async () => {
  const f = fixture(); await f.store.keep(draft(), true); const [key, raw] = [...f.state.values][0];
  assert.doesNotMatch(key, /synthetic-account|synthetic-session/);
  f.state.session = { accountId: 'synthetic-account-b', sessionId: 'synthetic-session-b' };
  const other = createStore({ ...f.options, ...f.state.session }); assert.equal((await other.read(true)).status, 'empty');
  const otherKey = f.state.calls.at(-1)[1]; assert.notEqual(otherKey, key); f.state.values.set(otherKey, raw);
  assert.equal((await other.read(true)).status, 'invalid');
  const environment = createStore({ ...f.options, ...f.state.session, environment: 'different-api-or-clerk' });
  assert.equal((await environment.read(true)).status, 'empty');
});
test('account/session change during namespace lookup prevents all storage access', async () => {
  const f = fixture(); const pendingHash = deferred(); const store = createStore({ ...f.options, digest: () => pendingHash.promise });
  const outcome = assert.rejects(store.read(true), /Local recovery/); f.state.session = null;
  pendingHash.resolve('a'.repeat(64)); await outcome; assert.equal(f.state.calls.length, 0);
});

test('lookup failure after delayed namespace resolution blocks storage and permits deliberate retry', async () => {
  const f = fixture(), hash = deferred(); let unavailable = false;
  const store = createStore({ ...f.options, digest: () => hash.promise, currentSession: () => { if (unavailable) throw Error('private lookup'); return f.state.session; } });
  const outcome = assert.rejects(store.keep(draft(), true), error => /Local recovery/.test(error.message) && !error.message.includes('private lookup'));
  unavailable = true; hash.resolve('b'.repeat(64)); await outcome;
  assert.equal(f.state.calls.length, 0); unavailable = false;
  await store.keep(draft(), true); assert.equal((await store.read(true)).status, 'review');
});

test('lookup failure after a dispatched read withholds contents without discarding the copy', async () => {
  const f = fixture(); await f.store.keep(draft(), true);
  const gate = deferred(); let unavailable = false;
  const store = createStore({ ...f.options, currentSession: () => { if (unavailable) throw Error('private late lookup'); return f.state.session; } });
  const original = f.storage.get; f.storage.get = () => gate.promise;
  const outcome = assert.rejects(store.read(true), error => /Local recovery/.test(error.message) && !error.message.includes('private late lookup'));
  await flush(); unavailable = true; gate.resolve([...f.state.values.values()][0]); await outcome;
  assert.equal(f.state.values.size, 1); assert.equal(f.state.calls.some(c => c[0] === 'remove'), false);
  unavailable = false; f.storage.get = original; assert.equal((await store.read(true)).status, 'review');
});
test('late old-session read never exposes data after same-account session replacement', async () => {
  const f = fixture(); await f.store.keep(draft(), true); const read = deferred(); f.storage.get = () => read.promise;
  const outcome = assert.rejects(f.store.read(true), /Local recovery/); await flush();
  f.state.session = { ...f.state.session, sessionId: 'replacement-session' }; read.resolve([...f.state.values.values()][0]); await outcome;
});
test('discard queues after pending keep across instances and cannot be overwritten late', async () => {
  const f = fixture(); const gate = deferred(); const original = f.storage.set;
  f.storage.set = async (...args) => { await gate.promise; await original(...args); };
  const keep = f.store.keep(draft(), true); await flush(); const discard = createStore(f.options).discard(true); await flush();
  assert.equal(f.state.calls.length, 0); gate.resolve(); await Promise.all([keep, discard]);
  assert.equal((await f.store.read(true)).status, 'empty'); assert.deepEqual(f.state.calls.map(call => call[0]), ['set', 'remove', 'get']);
});
test('queued operation from a superseded session is refused without deleting current recovery', async () => {
  const f = fixture(); const gate = deferred(); const original = f.storage.set;
  f.storage.set = async (...args) => { await gate.promise; await original(...args); };
  const keep = assert.rejects(f.store.keep(draft(), true)); await flush(); const discard = assert.rejects(f.store.discard(true));
  await flush(); f.state.session = null; gate.resolve(); await Promise.all([keep, discard]);
  assert.equal(f.state.values.size, 1); assert.equal(f.state.calls.some(call => call[0] === 'remove'), false);
});
test('expired and clock-rollback records are withheld without silent discard or retry', async () => {
  const f = fixture(); await f.store.keep(draft(), true); f.state.clock += 86400000;
  assert.equal((await f.store.read(true)).status, 'expired'); assert.equal(f.state.values.size, 1);
  f.state.clock -= 86400001; assert.equal((await f.store.read(true)).status, 'expired'); assert.equal(f.state.values.size, 1);
});
test('corrupted/unknown-version storage is invalid, never a restored or saved claim', async () => {
  const f = fixture(); await f.store.keep(draft(), true); const [key, raw] = [...f.state.values][0];
  for (const value of ['not-json', JSON.stringify({ ...JSON.parse(raw), version: 2 }), JSON.stringify({ ...JSON.parse(raw), recovery: { kind: 'saved' } })]) {
    f.state.values.set(key, value); assert.equal((await f.store.read(true)).status, 'invalid');
  }
});
test('UTF-8 payload bounds and malformed input are refused, storage failures do not poison retry', async () => {
  const f = fixture(); await assert.rejects(f.store.keep({ ...draft(), input: { ...input, id: 'invalid' } }, true));
  await assert.rejects(f.store.keep({ ...draft(), uncertainty: '界'.repeat(300), input: { ...input, title: '界'.repeat(160), portion: '界'.repeat(120) } }, true));
  assert.equal(f.state.values.size, 0);
  const original = f.storage.set; f.storage.set = async () => { throw Error('private-platform-details'); };
  await assert.rejects(f.store.keep(draft(), true), error => !error.message.includes('private-platform-details'));
  f.storage.set = original; await f.store.keep(draft(), true); assert.equal((await f.store.read(true)).status, 'review');
});
test('actual native adapter routes every operation through device-only SecureStore options', async () => {
  const values = new Map(); const calls = [];
  Object.assign(context.native, { session: { id: 'native-session', user: { id: 'native-account' } }, origin: 'https://synthetic.invalid',
    digest: async (algorithm, value) => { assert.equal(algorithm, 'synthetic-sha256'); return createHash('sha256').update(value).digest('hex'); },
    get: async (key, options) => { calls.push(['get', plain(options)]); return values.get(key) ?? null; },
    set: async (key, value, options) => { calls.push(['set', plain(options)]); values.set(key, value); },
    remove: async (key, options) => { calls.push(['remove', plain(options)]); values.delete(key); },
  });
  const store = context.recoveryModule.createNativeFoodNoteRecovery('native-account', 'native-session');
  await store.keep(draft(), true); assert.equal((await store.read(true)).status, 'review');
  context.native.origin = 'https://other-synthetic.invalid';
  const other = context.recoveryModule.createNativeFoodNoteRecovery('native-account', 'native-session');
  assert.equal((await other.read(true)).status, 'empty');
  context.process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'synthetic-other-instance';
  const instance = context.recoveryModule.createNativeFoodNoteRecovery('native-account', 'native-session');
  assert.equal((await instance.read(true)).status, 'empty');
  await store.discard(true); assert.equal(values.size, 0);
  for (const [, options] of calls) assert.deepEqual(options, { keychainAccessible: 'synthetic-device-only' });
  context.native.session = null; await assert.rejects(store.read(true));
});
function virtualDeadline() {
  const timers = new Map(); let id = 0;
  context.setTimeout = (fn, ms) => { assert.equal(ms, 12000); const key = ++id; timers.set(key, fn); return key; };
  context.clearTimeout = key => timers.delete(key);
  return {
    timers,
    expire: () => { const first = timers.entries().next().value; assert.ok(first, 'Expected request deadline'); const [key, fn] = first; timers.delete(key); fn(); },
    restore: () => { context.setTimeout = setTimeout; context.clearTimeout = clearTimeout; },
  };
}
test('stalled digest times out and late digest cannot dispatch storage', async () => {
  const clock = virtualDeadline();
  try {
    const f = fixture(); const hash = deferred(); const store = createStore({ ...f.options, digest: () => hash.promise });
    const outcome = assert.rejects(store.keep(draft(), true), /earlier local operation may still finish/);
    await flush(); clock.expire(); await outcome; hash.resolve('a'.repeat(64)); await flush();
    assert.equal(f.state.calls.length, 0); assert.equal(clock.timers.size, 0);
  } finally { clock.restore(); }
});
test('a dispatched keep times out but remains serialized before a subsequent discard', async () => {
  const clock = virtualDeadline();
  try {
    const f = fixture(); const gate = deferred(); const original = f.storage.set;
    f.storage.set = async (...args) => { await gate.promise; await original(...args); };
    const outcome = assert.rejects(f.store.keep(draft(), true), /Local recovery/);
    await flush(); clock.expire(); await outcome;
    const discard = createStore(f.options).discard(true); await flush(); assert.equal(f.state.calls.length, 0);
    gate.resolve(); await discard; assert.equal(f.state.values.size, 0);
    assert.deepEqual(f.state.calls.map(call => call[0]), ['set', 'remove']); assert.equal(clock.timers.size, 0);
  } finally { clock.restore(); }
});
test('timed-out queued discard never dispatches later or silently clears late saved recovery', async () => {
  const clock = virtualDeadline();
  try {
    const f = fixture(); const gate = deferred(); const original = f.storage.set;
    f.storage.set = async (...args) => { await gate.promise; await original(...args); };
    const keep = assert.rejects(f.store.keep(draft(), true)); await flush();
    const discard = assert.rejects(createStore(f.options).discard(true)); await flush();
    clock.expire(); clock.expire(); await Promise.all([keep, discard]); gate.resolve(); await flush();
    assert.deepEqual(f.state.calls.map(call => call[0]), ['set']); assert.equal(f.state.values.size, 1);
    // The caller must deliberately retry/review; completed old queue no longer blocks it.
    await f.store.discard(true); assert.equal(f.state.values.size, 0); assert.equal(clock.timers.size, 0);
  } finally { clock.restore(); }
});
test('late read after timeout is never returned as recovered data; explicit reread works', async () => {
  const clock = virtualDeadline();
  try {
    const f = fixture(); await f.store.keep(draft(), true); const gate = deferred(); const original = f.storage.get;
    f.storage.get = () => gate.promise; const outcome = assert.rejects(f.store.read(true));
    await flush(); clock.expire(); await outcome; gate.resolve([...f.state.values.values()][0]); await flush();
    f.storage.get = original; assert.equal((await f.store.read(true)).status, 'review'); assert.equal(clock.timers.size, 0);
  } finally { clock.restore(); }
});
test('timed-out dispatched removal can still finish and never reports success to the expired caller', async () => {
  const clock = virtualDeadline();
  try {
    const f = fixture(); await f.store.keep(draft(), true); const gate = deferred(); const original = f.storage.remove;
    f.storage.remove = async (...args) => { await gate.promise; await original(...args); };
    const outcome = assert.rejects(f.store.discard(true), /earlier local operation may still finish/);
    await flush(); clock.expire(); await outcome; assert.equal(f.state.values.size, 1);
    gate.resolve(); await flush(); assert.equal((await f.store.read(true)).status, 'empty'); assert.equal(clock.timers.size, 0);
  } finally { clock.restore(); }
});
