import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  COOK_TIERS,
  COOK_TIER_LABEL,
  COOK_TIER_QUOTE,
  KITCHEN_SKILLS,
  KITCHEN_STOCKS,
  activeSecondsFor,
  assumedSkill,
  fitForCook,
  orderByFit,
  recipeMinutesFor,
  tierRank,
  toolsAtStock,
  type CookProfile,
} from '../src/cooking-skill.js';
import { suggestCare } from '../src/care.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

test('every tier has a label and an attributed line, and the ladder is ordered', () => {
  assert.equal(COOK_TIERS.length, 5);
  for (const tier of COOK_TIERS) {
    assert.ok(COOK_TIER_LABEL[tier].length > 0);
    assert.ok(COOK_TIER_QUOTE[tier].line.length > 0);
    // The attribution is what makes clear we are riffing rather than quoting.
    assert.ok(COOK_TIER_QUOTE[tier].character.length > 0);
  }
  assert.deepEqual(COOK_TIERS.map(tierRank), [1, 2, 3, 4, 5]);
});

test('an unrated skill falls back to the tier, not to the middle', () => {
  // Assuming 3 for everybody would tell a Sage that a chicken is a challenge.
  assert.equal(assumedSkill({ tier: 'apprentice' }, 'knife'), 1);
  assert.equal(assumedSkill({ tier: 'sage' }, 'knife'), 5);
  // A stated rating always wins over the tier's guess.
  assert.equal(assumedSkill({ tier: 'apprentice', skills: { knife: 4 } }, 'knife'), 4);
  // Nothing said at all: the middle is the only fair guess left.
  assert.equal(assumedSkill({}, 'knife'), 3);
});

test('a kitchen holds everything from the levels below it', () => {
  const bare = toolsAtStock('bare');
  const outfitted = toolsAtStock('outfitted');
  for (const tool of bare) assert.ok(outfitted.has(tool), `${tool} vanished at the top level`);
  assert.ok(outfitted.size > bare.size);
  assert.ok(toolsAtStock('equipped').has('chef knife'), 'levels are not cumulative');
});

test('fit is comfortable, a stretch, or a challenge, and always says why', () => {
  const cook: CookProfile = { tier: 'adept', skills: { knife: 2, oven: 2 }, stock: 'basic' };

  const easy = fitForCook(cook, { skills: { knife: 2 } });
  assert.equal(easy.verdict, 'comfortable');
  assert.equal(easy.reason, null, 'a comfortable recipe needs no explanation');

  const stretch = fitForCook(cook, { skills: { knife: 3 } });
  assert.equal(stretch.verdict, 'stretch');
  assert.match(stretch.reason!, /knife work/i);

  const hard = fitForCook(cook, { skills: { oven: 5 } });
  assert.equal(hard.verdict, 'challenge');
  assert.match(hard.reason!, /baking/i);

  // A missing tool is a challenge however skilled the cook is - and the
  // reason has to name the tool, because "you cannot make this" with no
  // explanation is just a locked door.
  const sage: CookProfile = { tier: 'sage', stock: 'basic' };
  const needsKit = fitForCook(sage, { tools: ['stand mixer'] });
  assert.equal(needsKit.verdict, 'challenge');
  assert.deepEqual(needsKit.missingTools, ['stand mixer']);
  assert.match(needsKit.reason!, /stand mixer/);
});

test('nothing is ever hidden, only reordered', () => {
  const cook: CookProfile = { tier: 'apprentice', stock: 'bare' };
  const recipes = [
    { id: 'hard', demands: { skills: { knife: 5 } } },
    { id: 'easy', demands: { skills: { knife: 1 } } },
    { id: 'mid', demands: { skills: { knife: 2 } } },
  ];
  const ordered = orderByFit(recipes, cook, r => r.demands);

  assert.equal(ordered.length, recipes.length, 'a recipe was dropped');
  assert.deepEqual(ordered.map(r => r.id), ['easy', 'mid', 'hard']);
});

test('ties keep their original order so this layers onto existing ranking', () => {
  const cook: CookProfile = { tier: 'artisan' };
  const same = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(orderByFit(same, cook, () => ({})).map(r => r.id), ['a', 'b', 'c']);
});

test('skill changes hands-on time and never touches hands-off time', () => {
  const chopping = { activeSeconds: 600, demands: 'knife' as const };

  const slow = activeSecondsFor(chopping, { tier: 'apprentice' });
  const quick = activeSecondsFor(chopping, { tier: 'sage' });
  assert.ok(slow! > 600, 'a beginner should be given more time, not less');
  assert.ok(quick! < 600, 'an expert should not be held to the average');

  // The whole point: a simmer is a property of the pot. Two cooks at opposite
  // ends of the ladder must be told the same ten minutes, or the food is ruined.
  const simmer = { activeSeconds: null, timerSeconds: 600 };
  assert.equal(
    recipeMinutesFor([simmer], { tier: 'apprentice' }),
    recipeMinutesFor([simmer], { tier: 'sage' }),
  );

  // A step with no stated skill is not guessed at either.
  assert.equal(activeSecondsFor({ activeSeconds: 300, demands: null }, { tier: 'apprentice' }), 300);
  assert.equal(activeSecondsFor({ activeSeconds: null, demands: 'knife' }, { tier: 'sage' }), null);
});

test('estimates are rounded to the half minute, not to the second', () => {
  // Second-level precision on a guess is a lie told in a confident voice.
  const value = activeSecondsFor({ activeSeconds: 437, demands: 'knife' }, { tier: 'adept' });
  assert.equal(value! % 30, 0);
});

test('an empty profile still produces a usable answer', () => {
  // The tier is one tap and everything else is skippable, so every function
  // here has to do something sensible with almost nothing.
  const nothing: CookProfile = {};
  assert.equal(fitForCook(nothing, { skills: { knife: 3 } }).verdict, 'comfortable');
  // With no kitchen stated, a tool requirement cannot be held against anyone.
  assert.deepEqual(fitForCook(nothing, { tools: ['mandoline'] }).missingTools, []);
  assert.equal(fitForCook(nothing, { tools: ['mandoline'] }).verdict, 'comfortable');
});

test('the care experience is fenced off from skill ranking entirely', () => {
  // /care is for people who are ill. Telling someone too unwell to cook that
  // they are "only a Curious Apprentice", or ranking a bowl of rice as a
  // challenge, would be the worst thing this app could do. The spec says care
  // stays out of this; this test is what actually holds the line.
  const fenced = [
    'packages/core/src/care.ts',
    'apps/web/modules/care/CareScreen.tsx',
    'apps/web/app/care/page.tsx',
    'apps/mobile/modules/care/CareScreen.tsx',
  ];
  const forbidden = [
    'cooking-skill',
    'CookProfile',
    'CookTier',
    'COOK_TIER',
    'KitchenSkill',
    'KITCHEN_SKILL',
    'KitchenStock',
    'fitForCook',
    'orderByFit',
    'activeSecondsFor',
    'RecipeDemands',
  ];

  for (const relative of fenced) {
    const path = resolve(repoRoot, relative);
    // Fail loudly if a file moves, rather than silently disarming the guard.
    assert.ok(existsSync(path), `${relative} is missing; update this fence`);
    const source = readFileSync(path, 'utf8');
    for (const name of forbidden) {
      assert.ok(!source.includes(name), `${relative} reaches into skill ranking via ${name}`);
    }
  }

  // And nothing skill-shaped rides along on a suggestion.
  for (const suggestion of suggestCare({ effort: 'open' })) {
    for (const key of ['tier', 'skill', 'skills', 'demands', 'fit', 'verdict', 'challenge']) {
      assert.ok(!(key in suggestion), `a care suggestion carried ${key}`);
      assert.ok(!(key in suggestion.food), `a care food carried ${key}`);
    }
  }
});

test('the skill and stock vocabularies stay small enough to answer quickly', () => {
  // Someone doing this is tired and wants to cook, not fill in a form.
  assert.ok(KITCHEN_SKILLS.length <= 5);
  assert.equal(KITCHEN_STOCKS.length, 5);
});
