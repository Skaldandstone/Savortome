import test from 'node:test';
import assert from 'node:assert/strict';
import { careReturnRecord, careSignInHref, restoreCareReturn } from './care-state';

test('restoration validates untrusted fields and the fixed return destination', () => {
  const restored = restoreCareReturn(JSON.stringify({ at: 10, link: { source: 'wispling', effort: 'anything', return_to: 'https://evil.example', diagnosis: 'private' }, choices: { time: ['two'], texture: 'soft', usePantry: true, appetite: 'small', allergens: ['milk'] }, selectedId: 'unknown' }), 20)!;
  assert.deepEqual(restored.link, { source: 'wispling' });
  assert.equal(restored.choices.time, undefined);
  assert.equal(restored.choices.texture, 'soft');
  assert.equal(restored.choices.usePantry, true);
  assert.equal(restored.selectedId, null);
  assert.ok(!JSON.stringify(restored).includes('allergens'));
  assert.ok(!JSON.stringify(restored).includes('diagnosis'));
});

test('expired, future, malformed and non-finite return records cannot restore', () => {
  for (const raw of [null, '{', '[]', JSON.stringify({ at: 31 }), JSON.stringify({ at: '20' }), JSON.stringify({ at: null }), JSON.stringify({ at: 30 - 1800000 })]) assert.equal(restoreCareReturn(raw, 30), null);
});

test('selection and handoff survive locally without keeping a dietary profile', () => {
  const record = careReturnRecord({ source: 'wispling', return_to: 'wispling://care-return' }, { effort: 'open', time: 'two', appetite: 'small', usePantry: true }, 'banana', 50);
  assert.deepEqual(restoreCareReturn(JSON.stringify(record), 60), record);
});

test('sign-in redirect carries only the allowlisted protocol fields', () => {
  const href = careSignInHref({ source: 'wispling', intent: 'eat_now', return_to: 'wispling://care-return', effort: 'open', time: 'two', texture: 'soft', appetite: 'small', usePantry: true, selectedId: 'banana', completion: true, allergens: ['milk'] } as never);
  const redirect = new URL(href, 'https://secondbreakfast.example').searchParams.get('redirect_url')!;
  const query = new URL(redirect, 'https://secondbreakfast.example').searchParams;
  assert.equal(query.get('return_to'), 'wispling://care-return');
  assert.deepEqual([...query.keys()], ['source', 'intent', 'effort', 'time', 'texture', 'return_to']);
  assert.ok(!href.includes('banana'));
  assert.equal(careSignInHref({ return_to: 'wispling://arbitrary' } as never), '/sign-in?redirect_url=%2Fcare');
});
