import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betaAccess, CARE_EFFORTS, CARE_FOODS, CARE_LIMITS, parseCareLink, suggestCare } from '../src/care.js';
import { ALLERGENS, DIETARY_TAGS, flagsForRecipe } from '../src/dietary.js';

test('link parser removes private, unknown, duplicate and malformed values', () => {
  assert.deepEqual(parseCareLink({ source: 'wispling', intent: 'eat_now', time: ['two', 'ten'], effort: 'open', mood: 'sad', appetite: 'more', diagnosis: 'private', return_to: 'https://evil.test' }), { source: 'wispling', intent: 'eat_now', effort: 'open' });
  for (const return_to of ['wispling://care-return/evil', 'wispling://care-return?food=banana', 'javascript:alert(1)', ['wispling://care-return']]) assert.equal(parseCareLink({ return_to }).return_to, undefined);
  assert.equal(parseCareLink({ return_to: 'wispling://care-return' }).return_to, 'wispling://care-return');
});
test('malformed containers and inherited or unknown fields cannot become link parameters', () => {
  for (const value of [null, undefined, '', 'seconds://care?effort=open', [], ['open'], 7, true]) assert.deepEqual(parseCareLink(value), {});
  assert.deepEqual(parseCareLink(Object.create({ effort:'open', return_to:'wispling://care-return' })), {});
  const input = {effort:'open', get diagnosis() { throw new Error('Unknown fields must not be read'); }};
  assert.deepEqual(parseCareLink(input),{effort:'open'});
  for(const field of ['source','intent','effort','time','temperature','texture','return_to']) {
    for(const value of [[],{},true,1,'',null,['open'],' OPEN ','%6fpen']) assert.deepEqual(parseCareLink({[field]:value}),{});
  }
});
test('all seven documented handoff fields round trip without any extra personal data',()=>{
  const safe={source:'wispling',intent:'eat_now',effort:'microwave',time:'ten',temperature:'warm',texture:'soft',return_to:'wispling://care-return'};
  assert.deepEqual(parseCareLink({...safe,appetite:'small',allergens:['milk'],food:'rice',completed:true,medication:'private',history:['private']}),safe);
  assert.deepEqual(parseCareLink(Object.fromEntries(new URLSearchParams(safe))),safe);
});
test('all combinations keep explicit effort and time ceilings and unique choices', () => {
  for (const effort of CARE_EFFORTS) for (const time of ['two', 'ten', 'twenty'] as const) {
    const results = suggestCare({ effort, time });
    assert.ok(results.length <= 3);
    assert.equal(new Set(results.map(x => x.food.id)).size, results.length);
    for (const { food } of results) { assert.ok(food.minutes <= CARE_LIMITS[time]); assert.ok(CARE_EFFORTS.indexOf(food.effort) <= CARE_EFFORTS.indexOf(effort)); }
  }
});
test('each available candidate fills the next slot, including equal-time alternatives',()=>{
  assert.deepEqual(suggestCare({effort:'open',time:'two',appetite:'more'}).map(x=>[x.kind,x.food.id]),[['now','cereal'],['more','crackers'],['future','hummus']]);
  assert.deepEqual(suggestCare({texture:'smooth',temperature:'cold'},{allergens:['milk']}).map(x=>x.kind),['now']);
  assert.deepEqual(suggestCare({texture:'smooth',temperature:'cold'}).map(x=>x.kind),['now','more']);
  assert.deepEqual(suggestCare({temperature:'warm',time:'two'}),[]);
});
test('pantry priority remains intact across all slots rather than forcing a slower second choice',()=>{
  const matches=suggestCare({usePantry:true},{pantry:['egg','olive oil','banana']});
  assert.deepEqual(matches.map(x=>x.food.id),['scramble','banana','yogurt']);
  assert.deepEqual(matches.map(x=>x.kind),['now','more','future']);
});
test('pantry names use the existing canonicalizer and complete coverage precedes partial coverage',()=>{
  assert.equal(suggestCare({usePantry:true,temperature:'warm'},{pantry:['cooked beans']})[0]?.food.id,'beans');
  assert.equal(suggestCare({usePantry:true},{pantry:['rice','chickpea','tahini']})[0]?.food.id,'rice');
  assert.deepEqual(suggestCare({usePantry:true},{pantry:[' bananas ','YOGURT','bananas']}),suggestCare({usePantry:true},{pantry:['yogurt','banana']}));
});

test('pantry canonicalization never changes preparation requirements or relaxes restrictions',()=>{
  const pantry=['dried beans','cooked beans','beans'];
  const beans=CARE_FOODS.find(food=>food.id==='beans')!;
  const before=JSON.stringify(beans);
  const match=suggestCare({usePantry:true,temperature:'warm'},{pantry})[0]!;
  assert.equal(match.food.id,'beans');
  assert.equal(match.food,beans);
  assert.equal(match.food.effort,'microwave');
  assert.equal(match.food.minutes,5);
  assert.ok(match.food.steps.some(step=>step.includes('ready-cooked')));
  for(const choices of [{effort:'open' as const},{time:'two' as const},{temperature:'cold' as const},{texture:'crunchy' as const}]) {
    assert.ok(suggestCare({...choices,usePantry:true},{pantry}).every(x=>x.food.id!=='beans'));
  }
  assert.ok(suggestCare({usePantry:true},{pantry,dietaryTags:['keto']}).every(x=>x.food.id!=='beans'));
  assert.equal(JSON.stringify(beans),before);
});
test('sensory, appetite and dietary filters apply to every suggestion slot',()=>{
  for(const texture of ['crunchy','soft','smooth','plain'] as const) for(const temperature of ['cold','warm'] as const) for(const appetite of ['small','regular','more'] as const) {
    for(const {food} of suggestCare({texture,temperature,appetite,usePantry:true},{pantry:['egg','rice','banana','yogurt']})) {
      assert.ok(food.textures.includes(texture));
      assert.equal(food.temperature,temperature);
      assert.ok(food.portions.includes(appetite));
    }
  }
  for(const tag of DIETARY_TAGS) for(const {food} of suggestCare({}, {dietaryTags:[tag]})) assert.ok(food.dietaryTags.includes(tag));
});
test('each known detected allergen conflict is excluded even with a favored pantry match',()=>{
  for(const allergen of ALLERGENS) {
    for(const candidate of CARE_FOODS) {
      const results=suggestCare({usePantry:true},{allergens:[allergen],pantry:candidate.ingredients});
      for(const {food} of results) assert.deepEqual(flagsForRecipe(food.ingredients.map(canonicalItem=>({canonicalItem,optional:false})),[allergen]),[]);
    }
  }
});
test('never broadens impossible requests or uncertain dietary certifications', () => {
  assert.deepEqual(suggestCare({ effort: 'open', temperature: 'warm' }), []);
  assert.deepEqual(suggestCare({}, { dietaryTags: ['kosher'] }), []);
  assert.deepEqual(suggestCare({}, { dietaryTags: ['halal'] }), []);
});
test('allergens exclude conflicts including optional future shopping suggestions', () => {
  const results = suggestCare({}, { allergens: ['milk', 'eggs', 'sesame'], pantry: ['yogurt', 'banana', 'egg', 'tahini'] });
  assert.ok(results.every(x => !['yogurt', 'scramble', 'hummus'].includes(x.food.id)));
});
test('pantry ranking is opt-in, deterministic, and does not override sensory preferences', () => {
  assert.equal(suggestCare({ usePantry: true }, { pantry: ['yogurt', 'banana'] })[0].food.id, 'yogurt');
  assert.notEqual(suggestCare({}, { pantry: ['yogurt', 'banana'] })[0].food.id, 'yogurt');
  assert.ok(suggestCare({ texture: 'crunchy', usePantry: true }, { pantry: ['yogurt'] }).every(x => x.food.textures.includes('crunchy')));
  assert.deepEqual(suggestCare(), suggestCare());
  assert.equal(new Set(CARE_FOODS.map(x => x.id)).size, CARE_FOODS.length);
});
test('beta is closed by default and a local-preview flag never opens production', () => {
  assert.equal(betaAccess({ userId: 'user_a', allowedIds: 'user_a' }), false);
  assert.equal(betaAccess({ enabled: 'true', nodeEnv: 'production', localPreview: 'true' }), false);
  assert.equal(betaAccess({ enabled: 'true', userId: 'user_a', allowedIds: 'user_abc' }), false);
  assert.equal(betaAccess({ enabled: 'true', userId: 'user_a', allowedIds: 'user_b, user_a' }), true);
  assert.equal(betaAccess({ enabled: 'true', nodeEnv: 'development', localPreview: 'true' }), true);
});
test('public access opens the experience only when enabled and set to the exact string true', () => {
  assert.equal(betaAccess({ enabled: 'true', publicAccess: 'true' }), true);
  assert.equal(betaAccess({ enabled: 'true', nodeEnv: 'production', publicAccess: 'true', userId: null }), true);
  assert.equal(betaAccess({ publicAccess: 'true' }), false);
  assert.equal(betaAccess({ enabled: 'false', publicAccess: 'true' }), false);
  for (const value of ['TRUE', ' true', '1', 'yes', 'on', '', undefined]) assert.equal(betaAccess({ enabled: 'true', nodeEnv: 'production', publicAccess: value }), false);
});
