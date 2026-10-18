// Actual nutrition component; synthetic hooks, Clerk and transport. No provider calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';

const mocks = {
  react: `export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=v;return[state.values[i],v=>{state.writes++;state.values[i]=v;}];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useEffect=fn=>{const i=state.cursor++;if(!(i in state.values)){state.values[i]=true;state.cleanups.push(fn());}};`,
  '@clerk/nextjs': `export const useAuth=()=>state.auth;`,
  'react/jsx-runtime': `export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
  '@seconds/core/format': `export const NUTRITION_DISCLAIMER='Estimate disclaimer';export const nutritionLabel=()=> 'Estimated';`,
  './NutritionFacts.module.css': `export default {};`,
};
const bundle = await build({ bundle: true, write: false, format: 'iife', globalName: 'app', jsx: 'automatic', stdin: { resolveDir: process.cwd(), contents: "export {NutritionFacts} from './apps/web/modules/recipe/NutritionFacts.tsx';" }, plugins: [{ name: 'nutrition-recovery', setup(api) {
  api.onResolve({ filter: /.*/ }, args => Object.hasOwn(mocks, args.path) ? { path: args.path, namespace: 'mock' } : undefined);
  api.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
} }] });
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const state = { cursor: 0, values: [], cleanups: [], writes: 0, calls: [], reloads: 0, auth: { isLoaded: true, userId: 'user-a', sessionId: 'session-a' }, response: async () => ({ ok: true }) };
  const context = { state, fetch: async (...args) => { state.calls.push(args); return state.response(); }, window: { location: { reload() { state.reloads++; } } } };
  runInNewContext(bundle.outputFiles[0].text, context);
  const props = { recipe: { nutrition: null }, shelvedId: '10000000-0000-4000-8000-000000000001' };
  const resolve = node => !node ? [] : Array.isArray(node) ? node.flatMap(resolve) : typeof node.type === 'function' ? resolve(node.type(node.props)) : [node, ...resolve(node.props?.children)];
  const render = () => { state.cursor = 0; return resolve(context.app.NutritionFacts(props)); };
  return { state, props, render, button: () => render().find(node => node.type === 'button'), unmount: () => state.cleanups.forEach(fn => fn?.()) };
}

test('nutrition action pins the independently checked session and locks duplicate presses immediately', async () => {
  const f = fixture(); let finish;
  f.state.response = () => new Promise(resolve => { finish = resolve; });
  const click = f.button().props.onClick; click(); click();
  assert.equal(f.state.calls.length, 1);
  assert.equal(f.state.calls[0][1].headers['x-savortome-expected-session'], 'session-a');
  assert.equal(f.button().props.disabled, true);
  finish({ ok: true }); await flush(); assert.equal(f.state.reloads, 1);
});
test('unconfirmed nutrition request does not retry or expose private transport errors', async () => {
  const f = fixture(); f.state.response = async () => { throw Error('private provider detail'); };
  f.button().props.onClick(); await flush();
  const tree = f.render(); const copy = JSON.stringify(tree);
  assert.match(copy, /unconfirmed and may still finish/); assert.doesNotMatch(copy, /private provider detail/);
  assert.equal(f.button().props.disabled, true);
  f.button().props.onClick(); await flush(); assert.equal(f.state.calls.length, 1);
});
test('late completion and retained handlers after unmount cannot reload or send again', async () => {
  const f = fixture(); let finish;
  f.state.response = () => new Promise(resolve => { finish = resolve; });
  const click = f.button().props.onClick; click(); f.unmount(); const writes = f.state.writes;
  finish({ ok: true }); await flush(); click();
  assert.equal(f.state.reloads, 0); assert.equal(f.state.writes, writes); assert.equal(f.state.calls.length, 1);
});
test('loading and signed-out sessions never expose a nutrition write', () => {
  const f = fixture(); f.state.auth.isLoaded = false; assert.equal(f.button(), undefined);
  f.state.auth = { isLoaded: true, userId: null, sessionId: null }; assert.equal(f.button(), undefined);
  assert.equal(f.state.calls.length, 0);
});
test('local account route does not require Clerk and keeps session headers absent', async () => {
  const f = fixture(); f.props.clerkEnabled = false; f.state.auth = null;
  f.button().props.onClick(); await flush(); assert.equal(f.state.calls[0][1].headers, undefined);
});
test('HTTP rejection remains unconfirmed rather than allowing another provider request', async () => {
  const f = fixture(); f.state.response = async () => ({ ok: false });
  f.button().props.onClick(); await flush();
  assert.equal(f.state.reloads, 0); assert.equal(f.button().props.disabled, true);
  assert.match(JSON.stringify(f.render()), /unconfirmed/);
});
test('nutrition stays opt-in and distinguishes unknown figures from measured zero', () => {
  const f = fixture(); f.props.recipe.nutrition = { perServing: { calories: 0, proteinGrams: null, carbGrams: null, fatGrams: null, fiberGrams: null, sodiumMg: null } };
  const tree = f.render(); assert.equal(tree.find(node => node.type === 'details').props.open, undefined);
  const values = tree.filter(node => node.type === 'dd').map(node => node.props.children);
  assert.deepEqual(values, ['0', ...Array(5).fill('Not available')]);
  assert.equal(f.state.calls.length, 0);
});
