import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betaAccess, CARE_EFFORTS, CARE_FOODS, CARE_LIMITS, CARE_NOURISHMENT, parseCareLink, suggestCare } from '../src/care.js';
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
  assert.deepEqual(suggestCare({effort:'open',time:'two',appetite:'more'}).map(x=>[x.kind,x.food.id]),[['now','smoothie'],['more','hummus'],['future','cheese_crackers']]);
  // Smooth and cold used to collapse to a single option for anyone avoiding
  // milk. The catalogue now carries enough dairy-free smooth food to fill the
  // ladder, which is the whole point of widening it.
  assert.deepEqual(suggestCare({texture:'smooth',temperature:'cold'},{allergens:['milk']}).map(x=>x.kind),['now','more','future']);
  assert.deepEqual(suggestCare({texture:'smooth',temperature:'cold'}).map(x=>[x.kind,x.food.id]),[['now','kefir'],['more','applesauce'],['future','avocado']]);
  assert.deepEqual(suggestCare({temperature:'warm',time:'two'}),[]);
});
test('pantry priority remains intact across all slots rather than forcing a slower second choice',()=>{
  const matches=suggestCare({usePantry:true},{pantry:['egg','olive oil','banana']});
  assert.deepEqual(matches.map(x=>x.food.id),['scramble','banana','poached_egg']);
  assert.deepEqual(matches.map(x=>x.kind),['now','more','future']);
});
test('pantry names use the existing canonicalizer and complete coverage precedes partial coverage',()=>{
  assert.equal(suggestCare({usePantry:true,temperature:'warm'},{pantry:['cooked bean']})[0]?.food.id,'beans');
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

test('the three slots differ from each other and every stated preference has real depth',()=>{
  // The reported problem: choosing "open and eat" plus "soft" offered a
  // banana, applesauce, and a banana with yogurt on it. Three cards, one
  // idea, and no sense that the preferences had been read.
  const soft = suggestCare({effort:'open',time:'twenty',temperature:'any',texture:'soft',appetite:'regular'});
  assert.equal(soft.length,3);
  assert.equal(new Set(soft.map(x=>x.food.ingredients[0])).size,3,'suggestions share a main ingredient');

  // Every sensible combination should have more to draw on than the three
  // slots it fills, otherwise the page is just listing the whole catalogue.
  for(const effort of CARE_EFFORTS) for(const texture of ['crunchy','soft','smooth','plain'] as const) {
    const pool=CARE_FOODS.filter(food=>
      CARE_EFFORTS.indexOf(food.effort)<=CARE_EFFORTS.indexOf(effort) &&
      food.textures.includes(texture) && food.portions.includes('regular'));
    assert.ok(pool.length>3,`only ${pool.length} options for ${effort}/${texture}`);
  }

  // The ladder has to climb: "Future me" should ask more of someone than
  // "Right now", or the labels are decoration.
  const spread=suggestCare({time:'twenty'});
  const demand=(x:typeof spread[number])=>CARE_EFFORTS.indexOf(x.food.effort)*30+x.food.minutes;
  assert.equal(spread.length,3);
  assert.ok(demand(spread[2]!)>demand(spread[0]!),'the last slot asks no more than the first');
  assert.ok(demand(spread[1]!)>=demand(spread[0]!),'the middle slot sits below the first');
});

test('what gives back the most rises, but never above what someone can manage',()=>{
  // Nourishment breaks ties and only ties. The first card has to stay the
  // easiest thing on offer: someone may only manage that one, and a bowl of
  // beans is no use to them if they cannot stand up.
  for(const choices of [{},{effort:'open' as const},{effort:'microwave' as const},{texture:'soft' as const},{time:'ten' as const}]) {
    const results=suggestCare(choices);
    if(results.length<2) continue;
    const demand=(x:typeof results[number])=>CARE_EFFORTS.indexOf(x.food.effort)*30+x.food.minutes;
    assert.ok(results.every(x=>demand(x)>=demand(results[0]!)),'the first card is not the easiest');
  }

  // Between two options that ask exactly the same, the one that gives more
  // back goes first.
  const open=suggestCare({effort:'open',time:'two',appetite:'more'});
  assert.equal(open[0]!.food.id,'smoothie');
  assert.ok(open.slice(1).every(x=>x.food.nourishment==='sustaining'),'a steadier option outranked a sustaining one at equal effort');

  // Exactly one suggestion is marked, and only when it genuinely beats the
  // others - highlighting one of three equals would be a recommendation the
  // data cannot support.
  for(const choices of [{},{effort:'open' as const},{texture:'smooth' as const},{effort:'cook' as const}]) {
    const results=suggestCare(choices);
    const marked=results.filter(x=>x.mostNourishing);
    assert.ok(marked.length<=1,'more than one suggestion was highlighted');
    const ranks=results.map(x=>CARE_NOURISHMENT.indexOf(x.food.nourishment));
    if(new Set(ranks).size===1) assert.equal(marked.length,0,'highlighted one of several equals');
    else {
      assert.equal(marked.length,1);
      assert.equal(CARE_NOURISHMENT.indexOf(marked[0]!.food.nourishment),Math.max(...ranks));
    }
  }

  // Using the pantry still leads with what is already in the house.
  const pantry=suggestCare({usePantry:true},{pantry:['egg','olive oil','banana']});
  assert.equal(pantry[0]!.food.id,'scramble');
  assert.equal(pantry[0]!.mostNourishing,true);
});
