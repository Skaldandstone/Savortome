import test from 'node:test';
import assert from 'node:assert/strict';
import { saveCareIdea } from '../modules/care/saveIdea.ts';
import { getAccountToken } from '../lib/accountToken.ts';

const food = { shoppingItem: 'banana' };
test('guest care never calls the shopping API', async () => {
  let writes = 0;
  const result = await saveCareIdea(food, { accountId: null, currentAccount: () => null, write: async () => { writes++; } });
  assert.equal(result.status, 'sign-in');
  assert.equal(writes, 0);
});
test('saved is reported only after an acknowledged authenticated write', async () => {
  const writes = [];
  const result = await saveCareIdea(food, { accountId: 'cook-a', currentAccount: () => 'cook-a', write: async items => { writes.push(items); } });
  assert.equal(result.status, 'saved');
  assert.deepEqual(writes, [[{ canonicalItem: 'banana', displayName: 'banana' }]]);
});
test('session expiry and network failure keep a choice retryable without reporting saved', async () => {
  const expired = await saveCareIdea(food, { accountId: 'cook-a', currentAccount: () => 'cook-a', write: async () => { throw { status: 401 }; } });
  assert.equal(expired.status, 'sign-in');
  let writes = 0;
  const offline = await saveCareIdea(food, { accountId: 'cook-a', currentAccount: () => 'cook-a', write: async () => { writes++; throw new Error('Network request failed'); } });
  assert.equal(offline.status, 'unconfirmed');
  assert.equal(writes, 1, 'a failed request is not silently retried');
});
test('switching accounts suppresses both late success and late failure', async () => {
  for (const fail of [false, true]) {
    let current = 'cook-a';
    const result = await saveCareIdea(food, { accountId: current, currentAccount: () => current, write: async () => { current = 'cook-b'; if (fail) throw new Error('late failure'); } });
    assert.equal(result.status, 'superseded');
  }
});
test('a shopping write cannot acquire a different account token during token refresh', async () => {
  let active;
  const first = { id: 'session-a', user: { id: 'cook-a' }, getToken: async () => { active = second; return 'token-a'; } };
  const second = { id: 'session-b', user: { id: 'cook-b' }, getToken: async () => 'token-b' };
  active = first;
  await assert.rejects(getAccountToken('cook-a', () => active), /Sign in/);
  await assert.rejects(getAccountToken('cook-a', () => second), /Sign in/);
  assert.equal(await getAccountToken('cook-b', () => second), 'token-b');
});
test('a hung shopping request becomes unconfirmed without queuing or retrying it', async () => {
  let writes = 0;
  const result = await saveCareIdea(food, { accountId: 'cook-a', currentAccount: () => 'cook-a', timeoutMs: 1, write: () => { writes++; return new Promise(() => {}); } });
  assert.equal(result.status, 'unconfirmed');
  assert.equal(writes, 1);
});
