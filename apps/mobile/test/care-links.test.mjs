import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCareIntent } from '../modules/care/nativeLink.ts';

test('native care accepts the documented fields and keeps the fixed return', () => {
  const route = normalizeCareIntent('seconds://care?source=wispling&intent=eat_now&effort=open&time=two&temperature=cold&texture=soft&return_to=wispling%3A%2F%2Fcare-return');
  const query = new URL(route, 'https://local').searchParams;
  assert.equal(query.get('effort'), 'open');
  assert.equal(query.get('return_to'), 'wispling://care-return');
  assert.equal([...query.keys()].length, 7);
});
test('duplicate, malformed and private fields never enter native care navigation', () => {
  const route = normalizeCareIntent('seconds://care?effort=open&effort=cook&time=999&diagnosis=private&food=banana&completed=true&return_to=https%3A%2F%2Fevil.test#completed');
  assert.equal(route, '/care');
  assert.equal(normalizeCareIntent('/care?time=two&unknown=private'), '/care?time=two');
  assert.equal(normalizeCareIntent('seconds://care:bad?time=two'), '/care');
  assert.equal(normalizeCareIntent('seconds://care.evil.test?time=two'), '/care');
});
test('care normalization preserves existing unrelated app routes', () => {
  for (const path of ['seconds://recipe/123', '/recipe/123', 'seconds://oauth-callback?code=opaque']) assert.equal(normalizeCareIntent(path), path);
});
