// Actual component bodies with synthetic React/API boundaries, not a browser or
// screenshot harness. These checks cannot establish pixels or real DOM focus.
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
const careCss = readFileSync(new URL('../apps/web/modules/care/care.module.css', import.meta.url), 'utf8');
const woodlandCss = readFileSync(new URL('../apps/web/ui/woodland.css', import.meta.url), 'utf8');
const stubs = {
  'react/jsx-runtime': 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx; export const Fragment="fragment";',
  react: `export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return [state.values[i],next=>state.values[i]=typeof next==='function'?next(state.values[i]):next];};
    export const useEffect=(fn,deps)=>{if(!state.plannerLifecycle){state.effects.push(fn);return;}const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};
    export const useMemo=(fn,deps)=>{if(!state.plannerLifecycle)return fn();const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.values[i]=fn();}return state.values[i];};
    export const useCallback=(fn,deps)=>state.plannerLifecycle?useMemo(()=>fn,deps):fn;
    export const useRef=value=>{const i=state.cursor++;return state.refs[i]??=({current:state.refCurrent??value});},useId=()=>"fixture-id";`,
  'next/link': 'export default function Link(){}',
  'next/navigation': 'export const usePathname=()=>state.pathname; export const useRouter=()=>({refresh:()=>state.refreshes++});',
  'expo-router': 'export const useFocusEffect=fn=>state.focusEffects.push(fn); export const useRouter=()=>({push:path=>state.routes.push(path)});',
  'react-native-safe-area-context': 'export const useSafeAreaInsets=()=>({top:0,right:0,bottom:0,left:0});',
  'react-native': `export const Modal='Modal',Pressable='Pressable',ScrollView='ScrollView',Text='Text',View='View'; export const StyleSheet={create:value=>value};`,
  '@clerk/nextjs': 'export const useAuth=()=>({userId:null});',
  // Theme is an injected native boundary, like the palette in the UI stub.
  '@/ui/ThemeProvider': 'export const useReducedMotion=()=>state.reducedMotion??false;',
  '@/lib/beta': 'export const canUseBeta=async()=>state.allowed;',
  '@/lib/client': `export const api=new Proxy({}, {get:(_,name)=>async(...args)=>{state.calls.push({name,args});if((state.defer&&name==='dietaryProfile')||(state.deferSave&&name==='setDietaryProfile')||state.deferMethods?.has(name))return new Promise((resolve,reject)=>state.pending.push({resolve,reject,name,args}));if(state.fail||state.failMethods?.has(name))throw Error('Fixture write failed');const response=state.responses?.[name]??state.response??{};return typeof response==='function'?response(...args):response;}});`,
  '@/lib/action-failure': `export const actionFailure=(error,fallback)=>({message:error instanceof Error?error.message:fallback,signInRequired:false}); export const signInReturnHref=path=>'/sign-in?redirect_url='+encodeURIComponent(path);`,
  '@/ui': `export function Button(){};export function Callout(){};export function Field(){};export function FieldRow(){};export function Panel(){};export function PanelHeader(){};export function TextArea(){};export function TextField(){};export const radius={sm:4,md:8};export const space={xs:4,sm:8,md:12,lg:16,xl:24,xxl:32};export const type={micro:12,small:14,body:16,title:20};export const usePalette=()=>({bg:'#fff',surface:'#fff',surfaceSunken:'#eee',text:'#111',textMuted:'#555',accent:'#765',border:'#aaa'});`,
  '@/modules/shelves': 'export function StarRating(){};',
  '@/modules/recipe': `export function IngredientList(){};export function ServingScaler(){};export const useServings=recipe=>({servings:recipe.servings,canScale:false,increment(){},decrement(){},ingredients:recipe.ingredients});`,
  '@/modules/profile': 'export function AllergenWarning(){};',
  '@/modules/cooking': 'export function CookingProfilePanel(){};',
  './useCookSession': 'export const useCookSession=()=>({restored:null,checked:true,save(){},clear(){}});',
  './useTimers': 'export const useTimers=()=>({timers:[],restore(){},dismiss(){},timerFor(){return null;},stateOf(){return "paused";},remaining(){return 0;},start(){},pause(){},resume(){},reset(){}});',
  './useWakeLock': 'export const useWakeLock=()=>{};',
  './TimerTray': 'export function TimerTray(){};',
  './FinishPanel': 'export function FinishPanel(){};',
  './useFriends': 'export const useFriends=()=>state.friends??({overview:{incoming:[],friends:[],outgoing:[]},feed:[],loading:false,feedLoading:false,feedLoaded:true,busy:false,error:null,overviewError:null,feedError:null,retryOverview(){},retryFeed(){},add:async()=>true,update:async()=>true});',
  './FeedList': 'export function FeedList(){};',
  './PersonRow': 'export function PersonRow(){};',
  './useDiscover': 'export const useDiscover=()=>state.discover??({data:{tags:[],recipes:[],query:"",appliedTags:[]},loading:false,loaded:true,error:null,query:"",searchedQuery:"",activeTags:[],setQuery(){},search:async()=>{},toggleTag:async()=>{},retry:async()=>{}});',
  './DiscoverCards': 'export function DiscoverCards(){};',
  './useShoppingList': 'export const useShoppingList=()=>state.shopping??({list:null,providers:[],loading:false,loaded:true,listError:null,providersLoading:false,providersLoaded:true,providersError:null,retryList(){},retryProviders(){},busy:false,error:null,handoff:null,toggle:async()=>{},remove:async()=>{},clear:async()=>{},sendToCart:async()=>{}});',
  './CartButtons': 'export function CartButtons(){};',
  './KrogerConnection': 'export function KrogerConnection(){};',
  './ListItems': 'export function ListItems(){};',
  './usePantry': 'export const usePantry=()=>state.pantry??({items:[],intakes:[],loading:false,loaded:true,pantryError:null,error:null,intakesLoading:false,intakesLoaded:true,intakesError:null,retryPantry(){},retryIntakes(){},add:async()=>{},update:async()=>{},remove:async()=>{},clear:async()=>{},resolveIntake:async()=>true}); export const usePantrySearch=()=>state.pantrySearch??({response:null,searching:false,error:null,search:async()=>{}});',
  './MatchList': 'export function MatchList(){}; export function QueryReadback(){};',
  './PantryList': 'export function PantryList(){};',
  './TemplateItems': 'export function TemplateItems(){};',
  './TemplateShareControl': 'export function TemplateShareControl(){};',
};
const result = await build({
  absWorkingDir: root, stdin: { resolveDir: root, contents: `
    export {KitchenPageHeading} from './apps/web/modules/woodland/KitchenPageHeading.tsx';
    export {WoodlandNavigation,DecorationControl} from './apps/web/modules/woodland/Woodland.tsx';
    export {CareScreen} from './apps/web/modules/care/CareScreen.tsx';
    export {NewShelf} from './apps/web/modules/library/NewShelf.tsx';
    export {AllergenWarning} from './apps/web/modules/profile/AllergenWarning.tsx';
    export {DietaryProfileForm} from './apps/web/modules/profile/DietaryProfileForm.tsx';
    export {FinishPanel} from './apps/web/modules/cook/FinishPanel.tsx';
    export {CookMode} from './apps/web/modules/cook/CookMode.tsx';
    export {RecipeHeader} from './apps/web/modules/recipe/RecipeHeader.tsx';
    export {SuggestMeal} from './apps/web/modules/plan/SuggestMeal.tsx';
    export {PairingSuggestions} from './apps/web/modules/recipe/PairingSuggestions.tsx';
    export {ShelfChecklist} from './apps/web/modules/shelves/ShelfChecklist.tsx';
    export {TimerTray} from './apps/web/modules/cook/TimerTray.tsx';
    export {FriendsPanel} from './apps/web/modules/friends/FriendsPanel.tsx';
    export {useFriends} from './apps/web/modules/friends/useFriends.ts';
    export {DiscoverPanel,DiscoverPanelView} from './apps/web/modules/discover/DiscoverPanel.tsx';
    export {useDiscover as useDiscoverController} from './apps/web/modules/discover/useDiscover.ts';
    export {ListPanel,ListPanelView} from './apps/web/modules/list/ListPanel.tsx';
    export {useShoppingList} from './apps/web/modules/list/useShoppingList.ts';
    export {CookPanel} from './apps/web/modules/pantry/CookPanel.tsx';
    export {PantryList} from './apps/web/modules/pantry/PantryList.tsx';
    export {PantryReviewQueue} from './apps/web/modules/pantry/PantryReviewQueue.tsx';
    export {usePantry} from './apps/web/modules/pantry/usePantry.ts';
    export {PlanTogether} from './apps/web/modules/plan/PlanTogether.tsx';
    export {PlanWeek} from './apps/web/modules/plan/PlanWeek.tsx';
    export {AddMealDialog} from './apps/web/modules/plan/AddMealDialog.tsx';
    export {TemplateList} from './apps/web/modules/templates/TemplateList.tsx';
    export {PlanScreen as MobilePlanScreen} from './apps/mobile/modules/plan/PlanScreen.tsx';
    export {CookingProfilePanel,mergeProfileUpdate} from './apps/web/modules/cooking/CookingProfilePanel.tsx';
    export {OnboardingJourney} from './apps/web/modules/onboarding/OnboardingJourney.tsx';
    export {CARE_FOODS} from './packages/core/src/care.ts';` },
  bundle: true, write: false, platform: 'node', format: 'iife', globalName: 'tested', jsx: 'automatic',
  define: { 'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': '""' },
  plugins: [{ name: 'woodland-boundaries', setup(api) {
    api.onResolve({ filter: /.*/ }, args => {
      if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'fixture' };
      if (args.path.endsWith('.css')) return { path: args.path, namespace: 'css-fixture' };
    });
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
    api.onLoad({ filter: /.*/, namespace: 'css-fixture' }, () => ({ contents: 'export default new Proxy({}, {get:(_,key)=>key});', loader: 'js' }));
  } }],
});
function fixture(overrides = {}) {
  const state = { allowed: false, pathname: '/', cursor: 0, values: [], refs: [], effects: [], focusEffects: [], routes: [], calls: [], fetchCalls: [], pending: [], refreshes: 0, fail: false, ...overrides };
  const stored = new Map();
  const localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: key => stored.delete(key) };
  const fetch = async (url, init) => {
    state.fetchCalls.push({ url, init });
    if (state.fetchFail) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => state.fetchResponse ?? {} };
  };
  const sandbox = { state, fetch, navigator: { onLine: true }, localStorage, setTimeout, clearTimeout, URLSearchParams };
  runInNewContext(result.outputFiles[0].text, sandbox);
  return { state, sandbox, app: sandbox.tested, render: (fn, props = {}) => { state.cursor = 0; return fn(props); } };
}
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
function text(value) {
  if (value == null || typeof value === 'boolean') return '';
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (typeof value === 'object') return text(value.props?.children);
  return String(value);
}
function careFixture(online = true) {
  const f = fixture();
  f.sandbox.navigator.onLine = online;
  const screen = f.app.CareScreen({ link: {} });
  return { ...f, care: () => f.render(screen.type, screen.props) };
}
// Read-only planner fixture: render the current account child and commit effects
// by dependency identity, without seeding private hook positions.
function plannerReadFixture(overrides = {}) {
  const f = fixture({ plannerLifecycle: true, deps: [], cleanups: [],
    responses: { plan: { meals: [] }, library: { recipes: [] }, mySuggestions: { suggestions: [] } }, ...overrides });
  f.sandbox.AbortController = AbortController;
  f.sandbox.fetch = async (url, init = {}) => {
    assert.ok(!init.method || init.method === 'GET', 'Read fixture must not write');
    const address = new URL(url, 'https://synthetic.invalid');
    const name = address.pathname === '/api/plan/suggestions' ? 'mySuggestions' : address.pathname === '/api/plan' ? 'plan' : address.pathname === '/api/recipes' ? 'library' : null;
    assert.ok(name, `Unexpected route ${address.pathname}`);
    const args = name === 'plan' ? [address.searchParams.get('week')] : [];
    f.state.calls.push({ name, args });
    let response;
    if (f.state.deferMethods?.has(name)) response = await new Promise((resolve, reject) => f.state.pending.push({ name, args, resolve, reject }));
    else if (f.state.failMethods?.has(name)) return { ok: false, status: 503, json: async () => ({ error: "Couldn't load your recipes." }) };
    else response = f.state.responses[name];
    return { ok: true, status: 200, json: async () => response };
  };
  const render = () => {
    const shell = f.app.PlanWeek({ initialWeek: '2026-09-21', clerkEnabled: false });
    const tree = f.render(shell.type, shell.props);
    f.state.effects.splice(0).forEach(effect => effect());
    return tree;
  };
  const settle = async () => { for (let i = 0; i < 3; i++) { render(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  return { ...f, render, settle };
}
// Writes are intercepted only in this explicit mutation fixture; reads still use
// the read-only fixture and real client. Record wire payloads, not mock method args.
function plannerMutationFixture(meal) {
  const f = plannerReadFixture();
  f.state.responses.plan = { meals: [meal] };
  const read = f.sandbox.fetch;
  f.state.writes = [];
  f.sandbox.fetch = async (url, init = {}) => {
    if (!init.method || init.method === 'GET') return read(url, init);
    assert.equal(init.method, 'POST');
    assert.ok(['/api/plan', '/api/plan/meal'].includes(url));
    const payload = JSON.parse(init.body);
    f.state.writes.push({ url, payload });
    if (f.state.rejectWrite) return { ok: false, status: 503, json: async () => ({ error: 'Could not confirm this change.' }) };
    const meals = url === '/api/plan/meal' ? [meal] : [];
    f.state.responses.plan = { meals };
    return { ok: true, status: 200, json: async () => ({ meals }) };
  };
  return f;
}
const plannerButton = (tree, label) => {
  const button = nodes(tree).find(n => text(n) === label && n.props?.onClick);
  assert.ok(button, `Missing planner control: ${label}`);
  return button;
};
const cards = tree => nodes(tree).filter(node => node.type === 'details' && node.props['data-kind']);
const action = card => nodes(card).find(node => node.type === 'button' && node.props['aria-label']?.startsWith('Add '));

const luminance = hex => hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
  .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (left, right) => {
  const a = luminance(left), b = luminance(right);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
};
const themeBlock = selector => {
  const start = woodlandCss.indexOf(selector);
  const open = woodlandCss.indexOf('{', start);
  return woodlandCss.slice(open + 1, woodlandCss.indexOf('}', open));
};
const themeToken = (block, name) => block.match(new RegExp(`--${name}:(#[0-9a-f]{6})`, 'i'))?.[1];

test('forced woodland themes keep error messages readable regardless of system theme', () => {
  const dark = themeBlock("[data-woodland='true'] {");
  const light = themeBlock("[data-woodland='true'][data-theme='light'] {");
  for (const block of [dark, light]) {
    assert.ok(contrast(themeToken(block, 'error'), themeToken(block, 'error-soft')) >= 4.5);
    assert.ok(contrast(themeToken(block, 'text'), themeToken(block, 'error-soft')) >= 4.5);
  }
  assert.equal((woodlandCss.match(/--error:#9e211a; --error-soft:#fdeceb/g) ?? []).length, 2);
});

test('cooking-profile updates retain the visible local answer while merging skill choices', () => {
  const f = fixture();
  const tier = f.app.mergeProfileUpdate({}, { tier: 'artisan' });
  assert.equal(tier.tier, 'artisan');
  const knife = f.app.mergeProfileUpdate(tier, { skills: { knife: 4 } });
  const timing = f.app.mergeProfileUpdate(knife, { skills: { timing: 2 } });
  assert.deepEqual({ ...timing.skills }, { knife: 4, timing: 2 });
  assert.equal(timing.tier, 'artisan');
});

test('cooking profile load failure protects saved choices until a successful retry', async () => {
  const f = fixture({ fetchFail: true });
  const render = () => f.render(f.app.CookingProfilePanel);
  assert.match(text(render()), /Loading your cooking preferences/);
  f.state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));

  let tree = render();
  assert.match(text(tree), /saved choices have not been changed/i);
  assert.equal(nodes(tree).some(node => node.type === 'fieldset' || node.props?.['aria-pressed'] !== undefined), false);

  f.state.fetchFail = false;
  f.state.fetchResponse = { tier: 'apprentice', stock: null, skills: {} };
  nodes(tree).find(node => node.props?.onClick && text(node) === 'Try again').props.onClick();
  render();
  f.state.effects.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.match(text(tree).replace(/\s+/g, ' '), /Cooking as Curious Apprentice/);
  assert.equal(f.state.fetchCalls.filter(call => call.init?.method === 'PATCH').length, 0);
});

test('failed saved-allergen checking cannot look like a conflict-free recipe and retry restores the warning', async () => {
  const f = fixture({
    failMethods: new Set(['dietaryProfile']),
    responses: { dietaryProfile: { allergens: ['milk'], dietaryTags: [] } },
  });
  const props = { ingredients: [{ canonicalItem: 'milk', optional: false }] };
  const render = () => f.render(f.app.AllergenWarning, props);
  assert.match(text(render()), /Checking saved allergen flags/);
  f.state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));

  let tree = render();
  assert.match(text(tree), /Saved allergen check unavailable/);
  assert.match(text(tree), /Treat every ingredient as unchecked/);
  assert.doesNotMatch(text(tree), /May contain/);

  f.state.failMethods.delete('dietaryProfile');
  nodes(tree).find(node => text(node) === 'Try allergen check again').props.onClick();
  render();
  f.state.effects.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.match(text(tree).replace(/\s+/g, ' '), /May contain Milk/);
  assert.equal(f.state.calls.filter(call => call.name === 'dietaryProfile').length, 2);
  assert.equal(f.state.calls.some(call => call.name !== 'dietaryProfile'), false);
});

test('discover failure never becomes a false empty community and exposes one retry', () => {
  let retries = 0;
  const discover = {
    data: { tags: [], recipes: [], query: '', appliedTags: [] },
    loading: false, loaded: false, error: 'Fixture discovery failure',
    query: '', searchedQuery: '', activeTags: [],
    setQuery() {}, search: async () => {}, toggleTag: async () => {},
    retry: async () => { retries += 1; },
  };
  const f = fixture();
  const tree = f.render(f.app.DiscoverPanelView, { discover });
  assert.match(text(tree), /No empty result has been assumed/);
  assert.doesNotMatch(text(tree), /No one has shared anything yet/);
  assert.doesNotMatch(text(tree), /Nothing shared matches/);
  nodes(tree).find(node => text(node) === 'Try again').props.onClick();
  assert.equal(retries, 1);
});

test('a late discover response cannot replace the newer search', async () => {
  const f = fixture({ deferMethods: new Set(['discover']) });
  const render = () => f.render(f.app.useDiscoverController);
  render();
  const cleanup = f.state.effects[0]();
  const newer = render().search('soup');

  const initialRequest = f.state.pending.find(request => request.name === 'discover' && request.args[0].query === '');
  const searchRequest = f.state.pending.find(request => request.name === 'discover' && request.args[0].query === 'soup');
  searchRequest.resolve({ recipes: [{ id: 'new', title: 'New soup' }], tags: [], query: 'soup', appliedTags: [] });
  await newer;
  initialRequest.resolve({ recipes: [{ id: 'old', title: 'Old toast' }], tags: [], query: '', appliedTags: [] });
  await new Promise(resolve => setImmediate(resolve));

  const controller = render();
  assert.equal(controller.loaded, true);
  assert.equal(controller.loading, false);
  assert.equal(controller.data.recipes[0].title, 'New soup');
  assert.equal(controller.searchedQuery, 'soup');
  cleanup();
});

for (const failure of ['false receipt', 'rejected request']) test(`saved meals distinguish failed reads and require review of unconfirmed deletion (${failure})`, async () => {
  const meal = { id: 'meal-1', name: 'Sunday dinner', visibility: 'private', items: [] };
  const f = fixture({ plannerLifecycle: true, deps: [], cleanups: [] });
  f.sandbox.AbortController = AbortController;
  let failRead = true, deleteResponse = { ok: false };
  const requests = [];
  f.sandbox.fetch = async (url, init = {}) => {
    const method = init.method ?? 'GET';
    requests.push({ url, method });
    if (method === 'GET') {
      assert.equal(url, '/api/templates');
      return { ok: !failRead, status: failRead ? 503 : 200, json: async () => ({ templates: [meal] }) };
    }
    assert.equal(method, 'DELETE'); assert.equal(url, '/api/templates/meal-1');
    const rejected = !deleteResponse.ok && failure === 'rejected request';
    return { ok: !rejected, status: rejected ? 503 : 200, json: async () => deleteResponse };
  };
  const render = () => {
    const shell = f.app.TemplateList({ clerkEnabled: false });
    const tree = f.render(shell.type, shell.props);
    f.state.effects.splice(0).forEach(effect => effect());
    return tree;
  };
  const settle = async () => { for (let i = 0; i < 3; i++) { render(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  const deletes = () => requests.filter(r => r.method === 'DELETE').length;
  assert.match(text(render()), /Loading saved meals/);
  let tree = await settle();
  assert.match(text(tree), /saved meals have not been changed/i);
  assert.doesNotMatch(text(tree), /Nothing saved yet/);
  failRead = false;
  plannerButton(tree, 'Try again').props.onClick();
  tree = await settle();
  assert.match(text(tree), /Sunday dinner/);
  const openDelete = () => nodes(tree).find(node => node.props?.['aria-label'] === 'Delete Sunday dinner').props.onClick();
  openDelete(); tree = render();
  assert.match(text(tree), /stops its shared link from working/i);
  assert.equal(deletes(), 0);
  const confirm = plannerButton(tree, 'Delete saved meal');
  confirm.props.onClick(); confirm.props.onClick();
  tree = await settle();
  assert.equal(deletes(), 1);
  assert.match(text(tree), /may already be deleted/i);
  assert.doesNotMatch(text(tree), /still saved|was deleted/i);
  assert.ok(nodes(tree).some(node => node.type === 'h3' && text(node) === meal.name));
  assert.equal(plannerButton(tree, 'Delete saved meal').props.disabled, true);
  plannerButton(tree, 'Delete saved meal').props.onClick();
  await settle(); assert.equal(deletes(), 1);
  plannerButton(tree, 'Reload saved meals to review deletion').props.onClick();
  tree = await settle();
  assert.match(text(tree), /does not undo or cancel/);
  assert.equal(deletes(), 1);
  assert.equal(nodes(tree).some(node => node.props?.onClick && text(node) === 'Delete saved meal'), false);
  // A fresh read still contains this meal. A new explicit confirmation is required.
  openDelete(); tree = render(); deleteResponse = { ok: true };
  plannerButton(tree, 'Delete saved meal').props.onClick();
  tree = await settle();
  assert.match(text(tree), /Sunday dinner was deleted/);
  assert.equal(nodes(tree).some(node => node.props?.['aria-label'] === 'Delete Sunday dinner'), false);
  assert.deepEqual(requests, [
    { url: '/api/templates', method: 'GET' }, { url: '/api/templates', method: 'GET' },
    { url: '/api/templates/meal-1', method: 'DELETE' }, { url: '/api/templates', method: 'GET' },
    { url: '/api/templates/meal-1', method: 'DELETE' },
  ]);
});

test('journal page headings remain server-gated and contain a native h1 when allowed', async () => {
  const f = fixture();
  const props = { title: 'Shopping list', description: 'Fixture description', icon: 'basket' };
  assert.equal(await f.app.KitchenPageHeading(props), null);
  f.state.allowed = true;
  const tree = await f.app.KitchenPageHeading(props);
  assert.equal(nodes(tree).filter(n => n.type === 'h1').length, 1);
  assert.match(text(tree), /Shopping list/);
});

test('recipe headings default to legacy h2 and accept the server-selected page h1', () => {
  const f = fixture();
  const props = { recipe: { title: 'Fixture recipe', description: null, source: { kind: 'text' } } };
  assert.equal(nodes(f.app.RecipeHeader(props)).filter(n => n.type === 'h1').length, 0);
  assert.equal(nodes(f.app.RecipeHeader(props)).filter(n => n.type === 'h2').length, 1);
  assert.equal(nodes(f.app.RecipeHeader({ ...props, headingLevel: 1 })).filter(n => n.type === 'h1').length, 1);
});

test('navigation includes saved meals and marks its containing disclosure active', () => {
  const f = fixture({ pathname: '/templates' });
  const tree = f.render(f.app.WoodlandNavigation);
  assert.ok(nodes(tree).some(n => n.props?.href === '/templates' && text(n) === 'Saved meals' && n.props['aria-current'] === 'page'));
  assert.ok(nodes(tree).some(n => n.type === 'summary' && n.props['data-active'] === true));
  assert.ok(nodes(tree).some(n => n.props?.href === '/getting-started' && text(n) === 'Getting started'));
});

test('getting started gives one useful decision at a time and saves resumable progress', () => {
  const f = fixture();
  const render = () => f.render(f.app.OnboardingJourney, { signedIn: false, storageScope: 'guest' });
  assert.ok(nodes(render()).some(n => n.props?.role === 'status' && text(n).includes('Opening')));
  f.state.effects[0]();

  let shell = render();
  let step = nodes(shell).find(n => typeof n.type === 'function' && n.type.name === 'WelcomeStep');
  let tree = f.render(step.type, step.props);
  assert.ok(nodes(tree).some(n => n.type === 'h1' && text(n) === 'What would make food easier today?'));
  assert.ok(nodes(tree).some(n => n.props?.href === '/care' && n.props?.title === 'Feed me gently'));
  assert.ok(nodes(tree).some(n => n.props?.href?.startsWith('/sign-up?redirect_url=') && n.props?.title === 'Save a recipe'));

  step.props.onContinue();
  shell = render();
  step = nodes(shell).find(n => typeof n.type === 'function' && n.type.name === 'SafetyStep');
  tree = f.render(step.type, step.props);
  assert.ok(nodes(tree).some(n => n.type === 'h1' && text(n) === 'Tell us only what helps'));
  assert.match(text(tree), /cannot verify that a food is safe/);
  assert.ok(nodes(shell).some(n => n.props?.role === 'status' && text(n).includes('Progress saved')));

  step.props.onContinue();
  shell = render();
  step = nodes(shell).find(n => typeof n.type === 'function' && n.type.name === 'CookingStep');
  tree = f.render(step.type, step.props);
  assert.ok(nodes(tree).some(n => n.type === 'h1' && text(n) === 'Suggestions can meet you where you are'));
  assert.match(text(tree), /Feed me gently always stays separate/);

  step.props.onDone();
  tree = render();
  assert.ok(nodes(tree).some(n => n.type === 'h1' && text(n) === 'Your kitchen is ready when you are'));
});

test('web meal removal offers focused undo and requires review after unconfirmed restore', async () => {
  const meal = { recipeId: '11111111-1111-4111-8111-111111111111', date: '2026-09-22', slot: 'dinner', title: 'Bean soup', imageUrl: null, totalMinutes: 25 };
  const f = plannerMutationFixture(meal);
  const remove = tree => nodes(tree).find(n => n.props?.['aria-label'] === 'Remove Bean soup from Tue 22 Sep');
  let tree = await f.settle();
  remove(tree).props.onClick();
  tree = await f.settle();
  assert.match(text(tree).replace(/\s+/g, ' '), /Removed Bean soup from dinner on Tue 22 Sep/);
  assert.equal(plannerButton(tree, 'Undo').props.autoFocus, true);
  // Confirmed undo retains the original day/slot and uses the reviewed endpoint.
  plannerButton(tree, 'Undo').props.onClick();
  tree = await f.settle();
  assert.match(text(tree), /Bean soup.*is back on/);
  assert.equal(nodes(tree).some(n => n.type === 'button' && text(n) === 'Undo'), false);
  remove(tree).props.onClick();
  tree = await f.settle();
  assert.doesNotMatch(text(tree), /is back on/);
  f.state.rejectWrite = true;
  plannerButton(tree, 'Undo').props.onClick();
  tree = await f.settle();
  assert.ok(nodes(tree).some(n => n.props?.role === 'alert'));
  const undo = plannerButton(tree, 'Undo');
  assert.equal(undo.props.disabled, true);
  undo.props.onClick(); // Even a queued event must not resend an uncertain write.
  tree = await f.settle();
  assert.equal(f.state.writes.length, 4);
  assert.equal(plannerButton(tree, 'I reviewed the result; allow further changes').props.disabled, true);
  plannerButton(tree, 'Reload plan and suggestions to review').props.onClick();
  tree = await f.settle();
  // A fresh plan replaces the local undo preview, without repeating its write.
  assert.equal(nodes(tree).some(n => n.type === 'button' && text(n) === 'Undo'), false);
  assert.equal(plannerButton(tree, 'I reviewed the result; allow further changes').props.disabled, false);
  plannerButton(tree, 'I reviewed the result; allow further changes').props.onClick();
  tree = await f.settle();
  assert.match(text(tree), /No request was repeated and nothing was undone/);
  assert.equal(nodes(tree).some(n => n.type === 'button' && text(n) === 'Undo'), false);
  const removePayload = { action: 'remove', recipeId: meal.recipeId, date: meal.date, slot: meal.slot, week: '2026-09-21' };
  const addPayload = { recipeId: meal.recipeId, date: meal.date, slot: meal.slot };
  assert.deepEqual(f.state.writes, [
    { url: '/api/plan', payload: removePayload }, { url: '/api/plan/meal', payload: addPayload },
    { url: '/api/plan', payload: removePayload }, { url: '/api/plan/meal', payload: addPayload },
  ]);
});

test('web week-clear confirmation remains open when the write is rejected', async () => {
  const meal = { recipeId: '11111111-1111-4111-8111-111111111111', date: '2026-09-22', slot: 'dinner', title: 'Bean soup', imageUrl: null, totalMinutes: 25 };
  const f = plannerMutationFixture(meal);
  let tree = await f.settle();
  plannerButton(tree, 'Clear the week').props.onClick();
  tree = f.render();
  assert.equal(f.state.writes.length, 0);
  f.state.rejectWrite = true;
  plannerButton(tree, 'Clear every meal').props.onClick();
  tree = await f.settle();
  assert.ok(nodes(tree).some(n => n.props?.role === 'alert'));
  assert.equal(plannerButton(tree, 'Clear every meal').props.disabled, true);
  assert.match(text(tree), /Bean soup/);
  plannerButton(tree, 'Clear every meal').props.onClick();
  await f.settle();
  assert.deepEqual(f.state.writes, [{ url: '/api/plan', payload: { action: 'clearWeek', week: '2026-09-21' } }]);
});

for (const action of ['remove', 'accept suggestion']) test(`an earlier planner ${action} callback cannot repeat an unconfirmed write`, async () => {
  const meal = { recipeId: '11111111-1111-4111-8111-111111111111', date: '2026-09-22', slot: 'dinner', title: 'Bean soup', imageUrl: null, totalMinutes: 25 };
  const f = plannerReadFixture();
  f.state.responses.plan = { meals: [meal] };
  f.state.responses.mySuggestions = { suggestions: [{ ...meal, id: 'suggestion-1', suggestedBy: { displayName: 'Sam' } }] };
  const read = f.sandbox.fetch, writes = [];
  f.sandbox.fetch = async (url, init = {}) => {
    if (!init.method || init.method === 'GET') return read(url, init);
    writes.push({ url, method: init.method, payload: JSON.parse(init.body) });
    return { ok: false, status: 503, json: async () => ({ error: 'Unconfirmed' }) };
  };
  let tree = await f.settle();
  const button = action === 'remove'
    ? nodes(tree).find(node => node.props?.['aria-label'] === 'Remove Bean soup from Tue 22 Sep')
    : plannerButton(tree, 'Accept');
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  // Let the request fail before React commits another render. This handler still
  // captures the previously enabled state, but the uncertainty ref is current.
  await new Promise(resolve => setImmediate(resolve));
  button.props.onClick();
  tree = await f.settle();
  assert.equal(writes.length, 1, 'An uncertain write must not be repeated by an earlier callback');
  assert.match(text(tree), /pending or unconfirmed/);
  assert.deepEqual(writes[0], action === 'remove'
    ? { url: '/api/plan', method: 'POST', payload: { action: 'remove', recipeId: meal.recipeId, date: meal.date, slot: meal.slot, week: '2026-09-21' } }
    : { url: '/api/plan/suggestions/suggestion-1', method: 'POST', payload: { action: 'accept' } });
});

for (const leave of ['change week', 'unmount']) test(`an earlier planner removal cannot write after ${leave}`, async () => {
  const meal = { recipeId: '11111111-1111-4111-8111-111111111111', date: '2026-09-22', slot: 'dinner', title: 'Bean soup', imageUrl: null, totalMinutes: 25 };
  const f = plannerMutationFixture(meal);
  let tree = await f.settle();
  const remove = nodes(tree).find(node => node.props?.['aria-label'] === 'Remove Bean soup from Tue 22 Sep');
  assert.equal(remove.props.disabled, false);
  if (leave === 'change week') {
    f.state.responses.plan = { meals: [] };
    plannerButton(tree, 'Next →').props.onClick();
    tree = await f.settle();
    assert.equal(f.state.calls.filter(call => call.name === 'plan').at(-1).args[0], '2026-09-28');
  } else {
    f.state.cleanups.forEach(cleanup => cleanup?.());
  }
  remove.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.state.writes.length, 0, 'A callback from a departed planner view must not dispatch');
});

test('an earlier planner suggestion callback cannot write after unmount', async () => {
  const f = plannerReadFixture();
  f.state.responses.mySuggestions = { suggestions: [{ id: 'suggestion-1', recipeId: 'recipe-1', date: '2026-09-22', slot: 'dinner', title: 'Bean soup', suggestedBy: { displayName: 'Sam' } }] };
  const read = f.sandbox.fetch, writes = [];
  f.sandbox.fetch = async (url, init = {}) => {
    if (!init.method || init.method === 'GET') return read(url, init);
    writes.push(url); return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const tree = await f.settle();
  const accept = plannerButton(tree, 'Accept');
  assert.equal(accept.props.disabled, false);
  f.state.cleanups.forEach(cleanup => cleanup?.());
  accept.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(writes, []);
});

test('failed week loading never renders a false empty planner and retry restores the grid', async () => {
  const f = plannerReadFixture({ failMethods: new Set(['plan']) });
  let tree = await f.settle();
  assert.match(text(tree).replace(/\s+/g, ' '), /saved plan has not changed/i);
  assert.equal(nodes(tree).some(node => node.props?.['aria-label']?.startsWith('Add a recipe to')), false);
  const retry = nodes(tree).find(node => text(node) === 'Try this week again' && node.props?.onClick);
  assert.ok(retry);
  f.state.failMethods.delete('plan'); retry.props.onClick();
  tree = await f.settle();
  assert.equal(nodes(tree).filter(node => node.type === 'section' && node.props?.['aria-label']).length >= 7, true);
  assert.equal(nodes(tree).filter(node => node.props?.['aria-label']?.startsWith('Add a recipe to')).length, 21);
  assert.equal(f.state.calls.filter(call => call.name === 'plan').length, 2);
});

test('recipe picker distinguishes loading and failed requests from an empty library', () => {
  const f = fixture();
  const base = {
    date: '2026-09-22', slot: 'dinner', recipes: [], onPick() {}, onClose() {}, onRetry() {},
  };

  let tree = f.render(f.app.AddMealDialog, {
    ...base, loaded: false, loading: true, loadError: null,
  });
  assert.match(text(tree), /Loading your recipes/);
  assert.doesNotMatch(text(tree), /Nothing in your recipes yet/);
  assert.equal(nodes(tree).find(node => node.props?.['aria-label'] === 'Filter your recipes').props.disabled, true);

  let retried = false;
  tree = f.render(f.app.AddMealDialog, {
    ...base, loaded: false, loading: false, loadError: "Couldn't load your recipes.", onRetry() { retried = true; },
  });
  assert.match(text(tree), /could not load/);
  assert.match(text(tree), /Nothing has been added to this meal yet/);
  assert.doesNotMatch(text(tree), /Nothing in your recipes yet/);
  nodes(tree).find(node => node.type === 'button' && text(node) === 'Try recipes again').props.onClick();
  assert.equal(retried, true);

  tree = f.render(f.app.AddMealDialog, {
    ...base, loaded: true, loading: false, loadError: null,
  });
  assert.match(text(tree), /Nothing in your recipes yet/);
  assert.equal(nodes(tree).find(node => node.props?.['aria-label'] === 'Filter your recipes').props.disabled, false);
});

test('planner passes recipe-library failure and retry state into the open picker', async () => {
  const f = plannerReadFixture({ failMethods: new Set(['library']) });
  let tree = await f.settle();
  nodes(tree).find(node => node.props?.['aria-label']?.startsWith('Add a recipe to')).props.onClick();
  tree = f.render();
  const dialog = nodes(tree).find(node => typeof node.type === 'function' && node.type.name === 'AddMealDialog');
  assert.ok(dialog); assert.equal(dialog.props.loaded, false); assert.equal(dialog.props.loading, false);
  assert.match(dialog.props.loadError, /couldn't load/i);
  f.state.failMethods.delete('library'); dialog.props.onRetry();
  tree = await f.settle();
  const recovered = nodes(tree).find(node => typeof node.type === 'function' && node.type.name === 'AddMealDialog');
  assert.equal(recovered.props.loaded, true); assert.equal(recovered.props.loadError, null);
  assert.equal(f.state.calls.filter(call => call.name === 'library').length, 2);
});

test('a late prior-week response cannot replace the newly selected week', async () => {
  const f = plannerReadFixture({ deferMethods: new Set(['plan']) });
  let tree = f.render();
  nodes(tree).find(node => text(node) === 'Next →' && node.props?.onClick).props.onClick();
  await f.settle();
  const nextRequest = f.state.pending.find(request => request.name === 'plan' && request.args[0] === '2026-09-28');
  const oldRequest = f.state.pending.find(request => request.name === 'plan' && request.args[0] === '2026-09-21');
  assert.ok(nextRequest); assert.ok(oldRequest);
  nextRequest.resolve({ meals: [{ recipeId: 'new', date: '2026-09-29', slot: 'dinner', title: 'New soup', imageUrl: null, totalMinutes: 20 }] });
  await f.settle();
  oldRequest.resolve({ meals: [{ recipeId: 'old', date: '2026-09-22', slot: 'dinner', title: 'Old soup', imageUrl: null, totalMinutes: 20 }] });
  tree = await f.settle();
  assert.match(text(tree), /New soup/); assert.doesNotMatch(text(tree), /Old soup/);
  assert.equal(f.state.calls.filter(call => call.name === 'plan').length, 2);
});

test('mobile plan removal offers undo and clear-week requires confirmation', async () => {
  const week = '2026-09-21';
  const meal = { recipeId: 'recipe-1', date: '2026-09-22', slot: 'dinner', title: 'Bean soup', imageUrl: null, totalMinutes: 25 };
  const f = fixture({ plannerLifecycle: true, deps: [], cleanups: [] });
  let saved = [meal], rejectClear = false, focused, blur;
  const calls = [];
  const client = {
    async plan(forWeek) { assert.equal(forWeek, week); return { meals: saved }; },
    async library() { return { recipes: [] }; },
    async planRemove(...args) { calls.push({ name: 'planRemove', args }); saved = []; return { meals: saved }; },
    async reviewedPlanAdd(input) { calls.push({ name: 'reviewedPlanAdd', input }); saved = [meal]; return { meals: saved }; },
    async planClearWeek(forWeek) { calls.push({ name: 'planClearWeek', week: forWeek }); if (rejectClear) throw new Error('Unconfirmed'); saved = []; return { meals: saved }; },
  };
  const render = () => {
    const tree = f.render(f.app.MobilePlanScreen, { initialWeek: week, client });
    f.state.effects.splice(0).forEach(effect => effect());
    const focus = f.state.focusEffects.splice(0).at(-1);
    if (focus && focus !== focused) { blur?.(); focused = focus; blur = focus(); }
    return tree;
  };
  const settle = async () => { for (let i = 0; i < 3; i++) { render(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  await settle();

  nodes(render()).find(n => n.props?.accessibilityLabel === 'Remove Bean soup from Tue 22 Sep').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  let tree = render();
  assert.match(text(tree).replace(/\s+/g, ' '), /From dinner on Tue 22 Sep/);
  nodes(tree).find(n => n.props?.label === 'Undo').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.match(text(tree).replace(/\s+/g, ' '), /Bean soup is back on Tue 22 Sep/);

  nodes(tree).find(n => n.props?.label === 'Clear week').props.onPress();
  tree = render();
  assert.doesNotMatch(text(tree).replace(/\s+/g, ' '), /Bean soup is back on Tue 22 Sep/);
  assert.equal(calls.some(call => call.name === 'planClearWeek'), false);
  assert.ok(nodes(tree).some(n => n.props?.label === 'Clear every meal'));
  assert.ok(nodes(tree).some(n => n.props?.label === 'Keep this week'));

  rejectClear = true;
  nodes(tree).find(n => n.props?.label === 'Clear every meal').props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.ok(nodes(tree).some(n => n.props?.label === 'Clear every meal'));
  assert.ok(nodes(tree).some(n => typeof n.type === 'function' && n.props?.tone === 'error'));
  const confirm = nodes(tree).find(n => n.props?.label === 'Clear every meal');
  assert.equal(confirm.props.disabled, true);
  confirm.props.onPress(); await settle();
  assert.match(text(render()), /may already have saved/);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { name: 'planRemove', args: [meal.recipeId, meal.date, meal.slot, week] },
    { name: 'reviewedPlanAdd', input: { recipeId: meal.recipeId, date: meal.date, slot: meal.slot } },
    { name: 'planClearWeek', week },
  ]);
  blur?.();

});

for (const leave of ['change week', 'blur', 'unmount', 'refocus', 'blurred rerender']) test(`an earlier native planner removal cannot write after ${leave}`, async () => {
  const week = '2026-09-21';
  const meal = { recipeId: 'recipe-1', date: '2026-09-22', slot: 'dinner', title: 'Bean soup', imageUrl: null, totalMinutes: 25 };
  const f = fixture({ plannerLifecycle: true, deps: [], cleanups: [] });
  const writes = [];
  const client = {
    async plan(selectedWeek) { return { meals: selectedWeek === week ? [meal] : [] }; },
    async library() { return { recipes: [] }; },
    async planRemove(...args) { writes.push(args); return { meals: [] }; },
  };
  let focused, blur;
  const render = () => {
    const tree = f.render(f.app.MobilePlanScreen, { initialWeek: week, client });
    f.state.effects.splice(0).forEach(effect => effect());
    const focus = f.state.focusEffects.splice(0).at(-1);
    if (focus && focus !== focused) { blur?.(); focused = focus; blur = focus(); }
    return tree;
  };
  const settle = async () => { for (let i = 0; i < 3; i++) { render(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  let tree = await settle();
  const remove = nodes(tree).find(node => node.props?.accessibilityLabel === 'Remove Bean soup from Tue 22 Sep');
  assert.equal(remove.props.disabled, false);
  if (leave === 'change week') {
    nodes(tree).find(node => node.props?.accessibilityLabel === 'Next week').props.onPress();
    await settle();
  } else {
    blur();
    if (leave === 'unmount') f.state.cleanups.forEach(cleanup => cleanup?.());
    if (leave === 'refocus') { blur = focused(); tree = await settle(); }
  }
  const callback = leave === 'blurred rerender'
    ? nodes(render()).find(node => node.props?.accessibilityLabel === 'Remove Bean soup from Tue 22 Sep') : remove;
  callback.props.onPress();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(writes, [], 'A departed native view must not send a meal removal');
  if (leave === 'refocus') {
    nodes(tree).find(node => node.props?.accessibilityLabel === 'Remove Bean soup from Tue 22 Sep').props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(JSON.parse(JSON.stringify(writes)), [[meal.recipeId, meal.date, meal.slot, week]]);
  }
});

test('pantry memory shows sourced guidance and keeps every correction explicit', async () => {
  const f = fixture();
  const updates = [];
  const removals = [];
  const props = {
    items: [{
      canonicalItem: 'banana', displayName: '6 bananas', quantity: 6, unit: null,
      isStaple: false, isUsual: false, storageLocation: 'unknown',
      acquiredAt: '2020-01-01T00:00:00.000Z', lastConfirmedAt: null,
    }],
    async onAdd() { return true; }, async onUpdate(value) { updates.push(value); return true; },
    async onRemove(value) { removals.push(value); return true; }, async onClear() { return true; },
  };
  let tree = f.render(f.app.PantryList, props);
  assert.match(text(tree), /memory aids, not expiry dates/i);
  assert.match(text(tree), /Still have 6 bananas/i);
  const details = nodes(tree).find(node => node.type === 'details');
  assert.match(text(details), /Conditions vary/);
  assert.ok(nodes(details).some(node => node.type === 'a' && node.props?.href?.startsWith('https://www.fns.usda.gov/')));

  const checkboxes = nodes(tree).filter(node => node.type === 'input' && node.props?.type === 'checkbox');
  const usual = checkboxes[0];
  usual.props.onChange({ target: { checked: true } });
  checkboxes[1].props.onChange({ target: { checked: false } });
  const storage = nodes(tree).find(node => node.type === 'select');
  storage.props.onChange({ target: { value: 'countertop' } });
  const confirm = nodes(tree).find(node => typeof node.type === 'function' && text(node) === 'Yes, still here');
  confirm.props.onClick();
  nodes(tree).find(node => typeof node.type === 'function' && text(node) === 'Used some').props.onClick();
  tree = f.render(f.app.PantryList, props);
  const remaining = nodes(tree).find(node => typeof node.type === 'function' && node.props?.['aria-label'] === undefined && node.props?.id === 'remaining-banana');
  remaining.props.onChange({ target: { value: '4' } });
  tree = f.render(f.app.PantryList, props);
  nodes(tree).find(node => typeof node.type === 'function' && text(node) === 'Save amount').props.onClick?.();
  const amountForm = nodes(tree).find(node => node.type === 'form' && text(node).includes('How many'));
  amountForm.props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  tree = f.render(f.app.PantryList, props);
  nodes(tree).find(node => typeof node.type === 'function' && text(node) === 'All gone').props.onClick();
  nodes(tree).find(node => typeof node.type === 'function' && text(node).replace(/\s+/g, ' ') === 'Remind me in 3 days').props.onClick();
  nodes(tree).find(node => typeof node.type === 'function' && text(node) === 'Hide this suggestion').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(updates)), [
    { canonicalItem: 'banana', isUsual: true },
    { canonicalItem: 'banana', resurfaceHidden: true },
    { canonicalItem: 'banana', storageLocation: 'countertop' },
    { canonicalItem: 'banana', confirmPresent: true },
    { canonicalItem: 'banana', quantity: 4, unit: null, confirmPresent: true },
    { canonicalItem: 'banana', snoozeDays: 3 },
    { canonicalItem: 'banana', resurfaceHidden: true },
  ]);
  assert.deepEqual(removals, ['banana']);
});

test('pantry forms keep typed work until a write is confirmed', async () => {
  const f = fixture();
  let shouldSave = false;
  const entries = [];
  const props = {
    items: [],
    async onAdd(entry) { entries.push(entry); return shouldSave; },
    async onUpdate() { return shouldSave; },
    async onRemove() { return shouldSave; },
    async onClear() { return shouldSave; },
  };
  const render = () => f.render(f.app.PantryList, props);
  let tree = render();
  let input = nodes(tree).find(node => node.props?.['aria-label'] === 'Ingredients to add to your pantry');
  input.props.onChange({ target: { value: 'bananas and yogurt' } });
  tree = render();
  let form = nodes(tree).find(node => node.type === 'form');
  form.props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  input = nodes(tree).find(node => node.props?.['aria-label'] === 'Ingredients to add to your pantry');
  assert.equal(input.props.value, 'bananas and yogurt');
  assert.equal(input.props.disabled, true);
  assert.match(text(tree), /Retry the same pantry entry/);

  shouldSave = true;
  form = nodes(tree).find(node => node.type === 'form');
  form.props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  input = nodes(tree).find(node => node.props?.['aria-label'] === 'Ingredients to add to your pantry');
  assert.equal(input.props.value, '');
  assert.deepEqual(entries, ['bananas and yogurt', 'bananas and yogurt']);
});

test('pantry amount correction and bulk clear stay open after rejected writes', async () => {
  const f = fixture();
  const props = {
    items: [{
      canonicalItem: 'banana', displayName: 'bananas', quantity: 6, unit: null,
      isStaple: false, isUsual: false, storageLocation: 'countertop',
      acquiredAt: '2020-01-01T00:00:00.000Z', lastConfirmedAt: null,
    }],
    async onAdd() { return false; }, async onUpdate() { return false; },
    async onRemove() { return false; }, async onClear() { return false; },
  };
  const render = () => f.render(f.app.PantryList, props);
  let tree = render();
  nodes(tree).find(node => typeof node.type === 'function' && text(node) === 'Used some').props.onClick();
  tree = render();
  let amount = nodes(tree).find(node => node.props?.id === 'remaining-banana');
  amount.props.onChange({ target: { value: '4' } });
  tree = render();
  const amountForm = nodes(tree).find(node => node.type === 'form' && text(node).includes('How many'));
  await amountForm.props.onSubmit({ preventDefault() {} });
  tree = render();
  amount = nodes(tree).find(node => node.props?.id === 'remaining-banana');
  assert.equal(amount.props.value, '4');

  nodes(tree).find(node => typeof node.type === 'function' && text(node) === 'Clear pantry').props.onClick();
  tree = render();
  await nodes(tree).find(node => typeof node.type === 'function' && text(node) === 'Clear every item').props.onClick();
  tree = render();
  assert.ok(nodes(tree).some(node => text(node) === 'Keep my pantry'));
});

test('pantry and grocery reviews load independently and retry without erasing pantry memory', async () => {
  const banana = {
    canonicalItem: 'banana', displayName: 'bananas', quantity: 6, unit: null,
    isStaple: false, isUsual: true, storageLocation: 'countertop',
    acquiredAt: '2026-09-20T00:00:00.000Z', lastConfirmedAt: null,
  };
  const intake = {
    id: '00000000-0000-0000-0000-000000000001', source: 'receipt', sourceLabel: 'Market',
    acquiredAt: '2026-09-24T00:00:00.000Z', status: 'pending', createdAt: '2026-09-24T00:00:00.000Z',
    items: [],
  };
  const f = fixture({ plannerLifecycle: true, deps: [], cleanups: [],
    failMethods: new Set(['listPantryIntakes']),
    responses: { listPantry: [banana], listPantryIntakes: [intake] },
  });
  const render = () => {
    const controller = f.render(() => f.app.usePantry());
    f.state.effects.splice(0).forEach(effect => effect());
    return controller;
  };
  const settle = async () => { for (let i = 0; i < 3; i++) { render(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  let controller = await settle();
  assert.equal(controller.loaded, true);
  assert.equal(controller.items[0].canonicalItem, 'banana');
  assert.equal(controller.pantryError, null);
  assert.equal(controller.intakesLoaded, false);
  assert.match(controller.intakesError.message, /Fixture write failed/);

  f.state.failMethods.delete('listPantryIntakes');
  controller.retryIntakes();
  controller = await settle();
  assert.equal(controller.intakesLoaded, true);
  assert.equal(controller.intakes[0].sourceLabel, 'Market');

  f.state.failMethods.add('listPantry');
  controller.retryPantry();
  controller = await settle();
  assert.equal(controller.loaded, true);
  assert.equal(controller.items[0].canonicalItem, 'banana');
  assert.match(controller.pantryError.message, /Fixture write failed/);
  assert.deepEqual(f.state.calls.map(call => call.name), ['listPantry', 'listPantryIntakes', 'listPantryIntakes', 'listPantry']);

});

test('pantry panel never presents failed loading as an empty pantry', () => {
  const f = fixture({ pantry: {
    items: [], intakes: [], loading: false, loaded: false,
    pantryError: { message: 'Fixture pantry failure', signInRequired: false }, error: null,
    intakesLoading: false, intakesLoaded: false,
    intakesError: { message: 'Fixture review failure', signInRequired: false },
    retryPantry() {}, retryIntakes() {}, add: async () => false, update: async () => false,
    remove: async () => false, clear: async () => false, resolveIntake: async () => false,
  } });
  const shell = f.app.CookPanel({ clerkEnabled: false });
  const render = () => f.render(shell.type, shell.props);
  let tree = render();
  nodes(tree).find(node => text(node) === 'My pantry' && node.props?.onClick).props.onClick();
  tree = render();
  const copy = text(tree).replace(/\s+/g, ' ');
  assert.match(copy, /saved items have not changed/i);
  assert.match(copy, /pantry is still available/i);
  assert.doesNotMatch(copy, /Nothing here yet/i);
  assert.ok(nodes(tree).some(node => text(node) === 'Try pantry again'));
  assert.ok(nodes(tree).some(node => text(node) === 'Try grocery reviews again'));
});

test('receipt and grocery intake stays a human-reviewed queue', async () => {
  const f = fixture();
  const calls = [];
  const tree = f.render(f.app.PantryReviewQueue, {
    intakes: [{
      id: '00000000-0000-0000-0000-000000000001', source: 'receipt',
      sourceLabel: 'Neighborhood market', acquiredAt: '2026-09-12T12:00:00.000Z',
      status: 'pending', createdAt: '2026-09-12T12:00:00.000Z',
      items: [{ id: '00000000-0000-0000-0000-000000000002', canonicalItem: 'banana', displayName: 'bananas', quantity: 6, unit: null }],
    }],
    onResolve: async (...args) => { calls.push(args); return true; },
  });
  assert.match(text(tree), /Nothing .* enters your pantry until you confirm/i);
  const card = nodes(tree).find(node => typeof node.type === 'function' && node.type.name === 'PantryReviewCard');
  const cardTree = f.render(card.type, card.props);
  assert.match(text(cardTree), /Choose what actually came home/i);
  assert.match(text(cardTree), /replaces its displayed quantity/i);
  const add = nodes(cardTree).find(node => typeof node.type === 'function' && text(node) === 'Add selected items');
  add.props.onClick();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [[
    '00000000-0000-0000-0000-000000000001', 'accept', ['00000000-0000-0000-0000-000000000002'],
  ]]);
});

test('plan together states pantry uncertainty and awaits an explicit meal choice', async () => {
  const f = fixture({ response: {
    pantryCount: 2,
    ideas: [{ recipeId: 'banana-muffins', title: 'Banana muffins', imageUrl: null,
      totalMinutes: 35, have: ['banana'], missing: ['flour'], canMakeNow: false,
      reason: 'Uses banana, which may be worth checking while you plan.', resurfaceItems: ['banana'] }],
  } });
  const props = { date: '2026-09-13', week: '2026-09-07', onPlanned() {} };
  let tree = f.render(f.app.PlanTogether, props);
  assert.match(text(tree), /Checking your pantry/);
  f.state.effects[0]();
  await Promise.resolve();
  tree = f.render(f.app.PlanTogether, props);
  assert.match(text(tree), /Pantry quantities may be out of date/);
  assert.match(text(tree), /not verified against real allergen/);
  assert.equal(nodes(tree).find(node => node.type === 'select').props.value, 'dinner');
  assert.ok(nodes(tree).some(node => typeof node.type === 'function' && text(node) === 'Plan for today'));
});

test('focused recipe cooking removes the fixed app dock', () => {
  const f = fixture({ pathname: '/recipe/recipe-1/cook' });
  assert.equal(f.render(f.app.WoodlandNavigation), null);
});

test('Escape closes either native disclosure and requests focus on its summary only', () => {
  for (const component of ['WoodlandNavigation', 'DecorationControl']) {
    const f = fixture();
    const disclosure = nodes(f.render(f.app[component])).find(n => n.type === 'details');
    let focuses = 0, prevented = 0;
    const target = { open: true, querySelector: selector => { assert.equal(selector, 'summary'); return { focus: () => focuses++ }; } };
    const event = key => ({ key, currentTarget: target, preventDefault: () => prevented++, stopPropagation() {} });
    disclosure.props.onKeyDown(event('ArrowDown'));
    assert.equal(target.open, true);
    disclosure.props.onKeyDown(event('Escape'));
    assert.equal(target.open, false);
    assert.equal(focuses, 1);
    assert.equal(prevented, 1);
  }
});

test('every initial care choice keeps explicit ingredients and steps in its expanded content', () => {
  const f = careFixture();
  const suggestions = cards(f.care());
  assert.equal(suggestions.length, 3);
  for (const card of suggestions) {
    const title = text(nodes(card).find(n => n.type === 'h3'));
    const food = f.app.CARE_FOODS.find(food => food.title === title);
    assert.ok(food);
    const ingredients = nodes(card).find(n => n.type === 'p' && text(n).startsWith('Ingredients:'));
    assert.ok(ingredients);
    for (const ingredient of food.ingredients) assert.ok(text(ingredients).includes(ingredient));
    assert.ok(nodes(card).some(n => n.type === 'ol' && nodes(n).some(child => child.type === 'li')));
    assert.ok(action(card));
  }
});

test('care controls expose native names, grouped restrictions, live results, and fixed return copy', () => {
  const f = careFixture();
  const tree = f.care();
  const all = nodes(tree);
  const controls = all.filter(node => ['select', 'input', 'button'].includes(node.type));
  assert.ok(controls.length > 0);
  for (const control of controls) {
    const directlyNamed = typeof control.props['aria-label'] === 'string' && control.props['aria-label'].trim();
    const wrapped = all.some(node => node.type === 'label' && nodes(node).includes(control) && text(node).trim());
    assert.ok(directlyNamed || wrapped, `${control.type} requires an accessible name`);
  }
  assert.equal(all.filter(node => node.type === 'fieldset').length, 2);
  assert.ok(all.filter(node => node.type === 'fieldset').every(group => nodes(group).some(node => node.type === 'legend' && text(node).trim())));
  const results = all.find(node => node.type === 'section' && node.props['aria-label'] === 'Food suggestions');
  assert.equal(results.props['aria-live'], 'polite');
  assert.equal(all.some(node => node.props?.href === 'wispling://care-return'), false);
  const g = fixture();
  const returned = g.app.CareScreen({ link: { source: 'wispling', return_to: 'wispling://care-return' } });
  const returnedTree = g.render(returned.type, returned.props);
  assert.ok(nodes(returnedTree).some(node => node.props?.href === 'wispling://care-return' && text(node) === 'Back to Wispling'));
});

test('narrow care cards reserve an art column only when an illustration exists', () => {
  assert.match(careCss, /\.cardSummary\s*\{\s*grid-template-columns:minmax\(0,1fr\) 20px;/);
  assert.match(careCss, /\.cardSummary:has\(\.foodArt\)\s*\{\s*grid-template-columns:minmax\(96px,35%\) minmax\(0,1fr\) 20px;/);
});

test('secondary planning, pairing, and shelf controls retain explicit accessible names', async () => {
  const friend = fixture({
    values: [[{ id: 'friend-1', displayName: 'Sam' }], 'friend-1', '2026-08-31', 'dinner', 'idle', null, []],
  });
  const suggestion = friend.render(friend.app.SuggestMeal, { recipeId: 'recipe-1', ingredients: [] });
  const suggestionControls = nodes(suggestion).filter(node => ['select', 'input'].includes(node.type));
  assert.deepEqual(
    suggestionControls.map(control => control.props['aria-label']),
    ['Friend to suggest this meal to', 'Suggested meal date', 'Suggested meal slot'],
  );

  const mainId = '11111111-1111-4111-8111-111111111111';
  const candidate = { id: '22222222-2222-4222-8222-222222222222', title: 'Garden greens', imageUrl: null, nutrition: null };
  const pairings = fixture({ plannerLifecycle: true, deps: [], cleanups: [] });
  pairings.sandbox.AbortController = AbortController;
  const requestId = '33333333-3333-4333-8333-333333333333';
  pairings.sandbox.crypto = { randomUUID: () => requestId };
  const writes = [];
  pairings.sandbox.fetch = async (url, init = {}) => {
    if (!init.method) {
      assert.equal(url, `/api/recipes/${mainId}/pairings`);
      return { ok: true, status: 200, json: async () => ({ side: [candidate], drink: [], dessert: [] }) };
    }
    assert.equal(url, '/api/templates'); assert.equal(init.method, 'POST');
    writes.push(JSON.parse(init.body));
    return { ok: false, status: 503, json: async () => ({}) };
  };
  const shell = pairings.app.PairingSuggestions({ clerkEnabled: false, recipeId: mainId, mainNutrition: null, servings: 4 });
  const render = () => {
    const tree = pairings.render(shell.type, shell.props);
    pairings.state.effects.splice(0).forEach(effect => effect());
    return tree;
  };
  render(); await new Promise(resolve => setImmediate(resolve));
  let pairingTree = render();
  const pairingInputs = nodes(pairingTree).filter(node => node.type === 'input');
  assert.equal(pairingInputs.find(input => input.props.type === 'checkbox').props['aria-label'], 'Include Garden greens as a side in this meal');
  const name = pairingInputs.find(input => input.props.type === 'text');
  assert.equal(name.props['aria-label'], 'Meal name');
  name.props.onChange({ target: { value: 'Sunday dinner' } });
  pairingTree = render();
  await plannerButton(pairingTree, 'Save this meal').props.onClick();
  pairingTree = render();
  assert.ok(nodes(pairingTree).some(node => node.props?.role === 'alert' && /could not confirm the meal/i.test(text(node))));
  assert.deepEqual(writes, [{ id: requestId, name: 'Sunday dinner', items: [{ role: 'main', recipeId: mainId }, { role: 'side', recipeId: candidate.id }] }]);

  const shelves = fixture({ values: [true, ''] });
  const shelfTree = shelves.render(shelves.app.ShelfChecklist, {
    shelves: [], shelfIds: [], onToggle() {}, onCreate() {},
  });
  assert.ok(nodes(shelfTree).some(node => node.props?.['aria-label'] === 'New shelf name'));
});

test('friend suggestions expose retryable people and allergy failures without enabling send', async () => {
  const friend = { id: 'friend-1', displayName: 'Sam' };
  const f = fixture({ failMethods: new Set(['friends']), responses: { friends: { friends: [friend] }, friendAllergens: { allergens: [] } } });
  const render = () => f.render(f.app.SuggestMeal, { recipeId: 'recipe-1', ingredients: [] });
  assert.match(text(render()), /Loading people/);
  f.state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));

  let tree = render();
  assert.match(text(tree), /People could not load/);
  assert.equal(nodes(tree).some(node => node.type === 'button' && text(node) === 'Suggest'), false);
  f.state.failMethods.delete('friends');
  nodes(tree).find(node => node.type === 'button' && text(node) === 'Try again').props.onClick();
  render();
  f.state.effects.at(-2)();
  await new Promise(resolve => setImmediate(resolve));

  f.state.failMethods.add('friendAllergens');
  render();
  f.state.effects.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.match(text(tree).replace(/\s+/g, ' '), /Couldn't check Sam’s saved allergy flags/);
  assert.equal(nodes(tree).find(node => node.type === 'button' && text(node) === 'Suggest').props.disabled, true);

  f.state.failMethods.delete('friendAllergens');
  nodes(tree).find(node => node.type === 'button' && text(node) === 'Check again').props.onClick();
  render();
  f.state.effects.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.equal(nodes(tree).find(node => node.type === 'button' && text(node) === 'Suggest').props.disabled, false);
  assert.equal(f.state.calls.some(call => call.name === 'suggestForFriend'), false);
});

test('friends and recent activity load independently, and a failed feed retry never erases people', async () => {
  const friend = { id: 'friend-1', displayName: 'Sam', handle: 'sam' };
  const activity = { kind: 'cooked', recipeId: 'recipe-1', recipeTitle: 'Soup', at: '2026-09-24T00:00:00Z' };
  const f = fixture({
    failMethods: new Set(['feed']),
    responses: {
      friends: { friends: [friend], incoming: [], outgoing: [] },
      feed: [activity],
      addFriend: { friends: [friend], incoming: [], outgoing: [] },
    },
  });
  const render = () => f.render(f.app.useFriends);
  render();
  f.state.effects[0]();
  f.state.effects[1]();
  await new Promise(resolve => setImmediate(resolve));

  let controller = render();
  assert.equal(controller.overview.friends[0].displayName, 'Sam');
  assert.equal(controller.overviewError, null);
  assert.match(controller.feedError, /Fixture write failed/);
  assert.equal(controller.feedLoaded, false);

  f.state.failMethods.delete('feed');
  controller.retryFeed();
  render();
  f.state.effects.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  controller = render();
  assert.equal(controller.feedLoaded, true);
  assert.equal(controller.feed[0].recipeTitle, 'Soup');

  f.state.failMethods.add('feed');
  assert.equal(await controller.add('sam'), true);
  controller = render();
  f.state.effects.at(-1)();
  await new Promise(resolve => setImmediate(resolve));
  controller = render();
  assert.equal(controller.error, null);
  assert.match(controller.feedError, /Fixture write failed/);
  assert.equal(controller.overview.friends[0].displayName, 'Sam');
});

test('friends page protects typed handles and never presents failed loading as an empty list', async () => {
  let addResult = false;
  const friends = fixture({ friends: {
    overview: { incoming: [], friends: [], outgoing: [] }, feed: [], loading: false,
    feedLoading: false, feedLoaded: false, busy: false, error: null,
    overviewError: 'Fixture load failed', feedError: null,
    retryOverview() {}, retryFeed() {}, add: async () => addResult, update: async () => false,
  } });
  const render = () => friends.render(friends.app.FriendsPanel);
  let tree = render();
  assert.match(text(tree), /saved relationships have not changed/i);
  assert.doesNotMatch(text(tree), /No friends yet/);
  assert.equal(nodes(tree).find(node => node.props?.['aria-label'] === "Friend's handle").props.disabled, true);

  friends.state.friends.overviewError = null;
  tree = render();
  const input = nodes(tree).find(node => node.props?.['aria-label'] === "Friend's handle");
  input.props.onChange({ target: { value: '@sam' } });
  tree = render();
  nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.equal(nodes(tree).find(node => node.props?.['aria-label'] === "Friend's handle").props.value, '@sam');

  addResult = true;
  nodes(tree).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  tree = render();
  assert.equal(nodes(tree).find(node => node.props?.['aria-label'] === "Friend's handle").props.value, '');

  friends.state.friends.feedLoaded = true;
  friends.state.friends.feedError = 'Fixture feed failed';
  tree = render();
  assert.match(text(tree), /last activity we loaded remains below/i);
});

test('shopping list and provider options load independently without erasing the list', async () => {
  const list = {
    id: '11111111-1111-4111-8111-111111111111', name: 'Shopping list', createdAt: '2026-09-24T00:00:00.000Z',
    itemCount: 1, checkedCount: 0,
    items: [{ id: '22222222-2222-4222-8222-222222222222', canonicalItem: 'banana', displayName: 'bananas', quantity: 6,
      unit: null, amountUnknown: false, checked: false, mayAlreadyHave: false, recipeIds: [] }],
  };
  const providers = [{ id: 'clipboard', name: 'Copy list', kind: 'handoff', description: 'Copy the list.' }];
  const f = fixture({ plannerLifecycle: true, deps: [], cleanups: [],
    failMethods: new Set(['cartProviders']),
    responses: { getList: list, cartProviders: providers },
  });
  const render = () => {
    const controller = f.render(() => f.app.useShoppingList());
    f.state.effects.splice(0).forEach(effect => effect());
    return controller;
  };
  const settle = async () => { for (let i = 0; i < 3; i++) { render(); await new Promise(resolve => setImmediate(resolve)); } return render(); };
  let controller = await settle();
  assert.equal(controller.loaded, true);
  assert.equal(controller.list.items[0].displayName, 'bananas');
  assert.equal(controller.listError, null);
  assert.equal(controller.providersLoaded, false);
  assert.match(controller.providersError.message, /Fixture write failed/);

  f.state.failMethods.delete('cartProviders');
  controller.retryProviders();
  controller = await settle();
  assert.equal(controller.providersLoaded, true);
  assert.equal(controller.providers[0].name, 'Copy list');

  f.state.failMethods.add('getList');
  controller.retryList();
  controller = await settle();
  assert.equal(controller.loaded, true);
  assert.equal(controller.list.items[0].displayName, 'bananas');
  assert.match(controller.listError.message, /Fixture write failed/);
  assert.deepEqual(f.state.calls.map(call => call.name), ['getList', 'cartProviders', 'cartProviders', 'getList']);

});

test('shopping list panel distinguishes load failure from an empty list and provider failure', () => {
  const savedList = {
    id: 'list-1', name: 'Shopping list', createdAt: '2026-09-24T00:00:00.000Z',
    itemCount: 1, checkedCount: 0, items: [],
  };
  const f = fixture({ shopping: {
    list: null, providers: [], loading: false, loaded: false,
    listError: { message: 'Fixture list failure', signInRequired: false },
    providersLoading: false, providersLoaded: false,
    providersError: { message: 'Fixture provider failure', signInRequired: false },
    retryList() {}, retryProviders() {}, busy: false, error: null, handoff: null,
    toggle: async () => {}, remove: async () => {}, clear: async () => {}, sendToCart: async () => {},
  } });
  let tree = f.render(f.app.ListPanelView, { shopping: f.state.shopping });
  let copy = text(tree).replace(/\s+/g, ' ');
  assert.match(copy, /saved items have not changed/i);
  assert.doesNotMatch(copy, /Nothing on the list/i);
  assert.ok(nodes(tree).some(node => text(node) === 'Try list again'));

  f.state.shopping.list = savedList;
  f.state.shopping.loaded = true;
  tree = f.render(f.app.ListPanelView, { shopping: f.state.shopping });
  copy = text(tree).replace(/\s+/g, ' ');
  assert.match(copy, /1 to get/);
  assert.match(copy, /shopping list is still available/i);
  assert.ok(nodes(tree).some(node => text(node) === 'Try list options again'));
});

test('each cooking timer action names its timer and step without a per-second live region', () => {
  const f = fixture();
  const timer = { stepN: 2, label: 'Simmer gently', totalSeconds: 300, endsAt: 1, pausedRemaining: null };
  const tree = f.app.TimerTray({
    timers: [timer], remaining: () => 120, stateOf: () => 'running',
    onPause() {}, onResume() {}, onReset() {}, onDismiss() {},
  });
  const all = nodes(tree);
  const region = all.find(node => node.props?.role === 'region');
  assert.equal(region.props['aria-label'], 'Active cooking timers');
  const names = all.filter(node => node.type === 'button').map(node => node.props['aria-label']);
  assert.deepEqual(names, [
    'Pause Simmer gently timer from step 2',
    'Reset Simmer gently timer from step 2',
    'Clear Simmer gently timer from step 2',
  ]);
  assert.equal(all.some(node => node.props?.['aria-live']), false);
});

test('cook step deck puts exact amounts before the instruction and exposes technique help and swipe', () => {
  const f = fixture();
  const recipe = {
    id: 'recipe-1', title: 'Braising fixture', description: null, servings: 4,
    servingsNote: null, prepMinutes: null, cookMinutes: null, totalMinutes: null,
    ingredients: [
      { raw: '1 cup stock', quantity: 1, quantityMax: null, unit: 'cup', item: 'stock', canonicalItem: 'stock', notes: null, optional: false, group: null },
      { raw: '2 cups carrots, divided', quantity: 2, quantityMax: null, unit: 'cup', item: 'carrots', canonicalItem: 'carrot', notes: 'divided', optional: false, group: null },
    ],
    steps: [
      { n: 1, text: 'Braise the carrots in half the stock.', timerSeconds: null, sourceTimestamp: null },
      { n: 2, text: 'Add the remaining stock.', timerSeconds: null, sourceTimestamp: null },
    ],
    equipment: [], tags: [], cuisine: null, course: null, difficulty: null,
    confidence: 1, extractionNotes: [], ingredientNutritionGuesses: [], imageUrl: null,
    photos: [], nutrition: null, source: { kind: 'manual', url: null, author: null, siteName: null, extractionMethod: 'manual' },
  };
  const render = () => f.render(f.app.CookMode, { recipe, recipeId: recipe.id });
  const first = render();
  const stage = nodes(first).find(n => n.type === 'section' && n.props['aria-label']?.startsWith('Step 1 of 2'));
  assert.ok(stage);
  const all = nodes(stage);
  const amountAt = all.findIndex(n => n.type === 'ul' && n.props['aria-label'] === 'Amounts for this step');
  const instructionAt = all.findIndex(n => n.type === 'p' && text(n) === recipe.steps[0].text);
  assert.ok(amountAt >= 0 && amountAt < instructionAt);
  assert.match(text(all[amountAt]), /½ cup\s+stock/);
  const technique = all.find(n => n.type === 'button' && /What does\s+braise\s+mean\?/.test(text(n)));
  assert.ok(technique, text(stage));
  assert.equal(technique.props['aria-expanded'], false);
  technique.props.onClick();
  const expanded = nodes(render()).find(n => n.type === 'button' && /What does\s+braise\s+mean\?/.test(text(n)));
  assert.equal(expanded.props['aria-expanded'], true);
  assert.ok(nodes(render()).some(n => n.props?.role === 'tooltip' && text(n).includes('cook it slowly')));

  const currentStage = nodes(render()).find(n => n.type === 'section' && n.props['aria-label']?.startsWith('Step 1 of 2'));
  currentStage.props.onPointerDown({ pointerType: 'touch', clientX: 220, clientY: 100 });
  currentStage.props.onPointerUp({ clientX: 100, clientY: 104 });
  assert.ok(nodes(render()).some(n => n.props?.['aria-label']?.startsWith('Step 2 of 2')));
});

test('failed dietary-profile loading never exposes an empty editable form; retry restores actual saved choices', async () => {
  const f = fixture({ fail: true });
  const render = () => f.render(f.app.DietaryProfileForm);
  const initial = render();
  assert.ok(nodes(initial).some(n => n.props?.role === 'status' && text(n).includes('Loading')));
  f.state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  const failed = render();
  assert.match(text(failed), /saved choices have not been changed/);
  assert.equal(nodes(failed).some(n => n.props?.['aria-pressed'] !== undefined), false);
  f.state.fail = false;
  f.state.response = { allergens: ['milk'], dietaryTags: ['vegetarian'] };
  nodes(failed).find(n => text(n) === 'Try again' && n.props?.onClick).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const loaded = render();
  const selected = nodes(loaded).filter(n => n.props?.['aria-pressed'] === true);
  assert.equal(selected.length, 2);
  assert.equal(f.state.calls.some(call => call.name === 'setDietaryProfile'), false);
});

test('cook finish scroll respects reduced motion without recording a cooking event in the test', () => {
  for (const reduced of [false, true]) {
    const scrolls = [];
    const f = fixture({ refCurrent: { scrollIntoView: options => scrolls.push(options) } });
    f.sandbox.window = { matchMedia: query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return { matches: reduced }; } };
    f.render(f.app.FinishPanel, { recipeId: 'fixture-recipe' });
    f.state.effects[1]();
    assert.equal(scrolls[0].behavior, reduced ? 'auto' : 'smooth');
    assert.equal(f.state.calls.length, 0);
  }
});

test('an empty saved profile is editable, while a stale retry callback cannot replace later edits', async () => {
  const f = fixture({ fail: true });
  const render = () => f.render(f.app.DietaryProfileForm);
  render();
  f.state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  const retry = nodes(render()).find(n => text(n) === 'Try again' && n.props?.onClick).props.onClick;
  f.state.fail = false;
  f.state.response = { allergens: [], dietaryTags: [] };
  retry();
  await new Promise(resolve => setImmediate(resolve));
  const loaded = render();
  const options = nodes(loaded).filter(n => n.props?.['aria-pressed'] !== undefined);
  assert.ok(options.length > 0);
  assert.ok(options.every(n => n.props['aria-pressed'] === false));
  options[0].props.onClick();
  retry();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes(render()).filter(n => n.props?.['aria-pressed'] === true).length, 1);
  assert.equal(f.state.calls.length, 2);
});

test('late profile responses are ignored after cleanup and newer successful requests', async () => {
  const f = fixture({ defer: true });
  const render = () => f.render(f.app.DietaryProfileForm);
  render();
  const mount = f.state.effects[0];
  const cleanup = mount();
  cleanup();
  mount(); // React development-mode effect replay, with the old request pending.
  f.state.pending[1].resolve({ allergens: ['milk'], dietaryTags: [] });
  await new Promise(resolve => setImmediate(resolve));
  f.state.pending[0].resolve({ allergens: [], dietaryTags: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes(render()).filter(n => n.props?.['aria-pressed'] === true).length, 1);

  const g = fixture({ defer: true });
  g.render(g.app.DietaryProfileForm);
  g.state.effects[0]()();
  const before = JSON.stringify(g.state.values);
  g.state.pending[0].resolve({ allergens: ['milk'], dietaryTags: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(JSON.stringify(g.state.values), before);
});

test('profile choices cannot change during a pending save; failure preserves choices and reopens editing', async () => {
  const f = fixture({ deferSave: true, response: { allergens: [], dietaryTags: [] } });
  const render = () => f.render(f.app.DietaryProfileForm);
  render();
  f.state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  nodes(render()).find(n => n.props?.['aria-pressed'] !== undefined).props.onClick();
  const before = nodes(render()).filter(n => n.props?.['aria-pressed'] === true).map(text);
  const staleChoice = nodes(render()).find(n => n.props?.['aria-pressed'] !== undefined).props.onClick;
  const staleSave = nodes(render()).find(n => text(n) === 'Save' && n.props?.onClick).props.onClick;
  staleSave();
  const pending = render();
  assert.ok(nodes(pending).filter(n => n.props?.['aria-pressed'] !== undefined).every(n => n.props.disabled === true));
  staleChoice();
  assert.deepEqual(nodes(render()).filter(n => n.props?.['aria-pressed'] === true).map(text), before);
  staleSave();
  assert.equal(f.state.calls.filter(call => call.name === 'setDietaryProfile').length, 1);
  f.state.pending[0].reject(Error('Fixture save failed'));
  await new Promise(resolve => setImmediate(resolve));
  const failed = render();
  assert.deepEqual(nodes(failed).filter(n => n.props?.['aria-pressed'] === true).map(text), before);
  assert.ok(nodes(failed).filter(n => n.props?.['aria-pressed'] !== undefined).every(n => !n.props.disabled));
  assert.ok(nodes(failed).some(n => n.props?.role === 'alert'));
  assert.equal(nodes(failed).some(n => text(n) === 'Saved ✓'), false);
});

test('profile save results after unmount do not update state or show confirmation', async () => {
  const f = fixture({ deferSave: true, response: { allergens: [], dietaryTags: [] } });
  const render = () => f.render(f.app.DietaryProfileForm);
  render();
  const cleanup = f.state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  nodes(render()).find(n => n.props?.['aria-pressed'] !== undefined).props.onClick();
  nodes(render()).find(n => text(n) === 'Save' && n.props?.onClick).props.onClick();
  cleanup();
  const before = JSON.stringify(f.state.values);
  f.state.pending[0].resolve({ allergens: ['milk'], dietaryTags: [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(JSON.stringify(f.state.values), before);
});

test('a confirmed profile save reopens choices and a new edit clears visible saved status', async () => {
  const f = fixture({ deferSave: true, response: { allergens: [], dietaryTags: [] } });
  const render = () => f.render(f.app.DietaryProfileForm);
  render();
  const cleanup = f.state.effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  nodes(render()).find(n => n.props?.['aria-pressed'] !== undefined).props.onClick();
  nodes(render()).find(n => text(n) === 'Save' && n.props?.onClick).props.onClick();
  const submitted = f.state.calls.find(call => call.name === 'setDietaryProfile').args[0];
  f.state.pending[0].resolve(submitted);
  await new Promise(resolve => setImmediate(resolve));
  const saved = render();
  assert.ok(nodes(saved).some(n => n.props?.role === 'status' && text(n) === 'Saved ✓'));
  assert.ok(nodes(saved).filter(n => n.props?.['aria-pressed'] !== undefined).every(n => !n.props.disabled));
  assert.equal(nodes(saved).find(n => text(n) === 'Save' && n.props?.onClick).props.disabled, true);
  nodes(saved).find(n => n.props?.['aria-pressed'] !== undefined).props.onClick();
  assert.equal(nodes(render()).some(n => n.props?.role === 'status' && text(n) === 'Saved ✓'), false);
  cleanup();
});

test('guest shopping feedback and safe sign-in are colocated with the selected care choice, with no API write', () => {
  const f = careFixture();
  action(cards(f.care())[0]).props.onClick();
  const next = f.care();
  const selected = cards(next).find(n => n.props['data-selected'] === true);
  assert.match(text(selected), /Nothing has been added yet/);
  assert.ok(nodes(selected).some(n => n.props?.href === '/sign-in?redirect_url=%2Fcare'));
  assert.equal(nodes(next).filter(n => n.props?.role === 'status' && text(n).includes('Nothing has been added yet')).length, 1);
  assert.equal(f.state.calls.length, 0);
});

test('offline shopping feedback never reports saved or starts a write', () => {
  const f = careFixture(false);
  action(cards(f.care())[0]).props.onClick();
  const selected = cards(f.care()).find(n => n.props['data-selected'] === true);
  assert.match(text(selected), /Nothing has been saved/);
  assert.equal(nodes(selected).some(n => n.props?.href?.startsWith('/sign-in')), false);
  assert.equal(f.state.calls.length, 0);
});

test('new shelf confirms only a resolved write; failed writes retain the entered name', async () => {
  for (const fail of [false, true]) {
    const f = fixture({ fail });
    const render = () => f.render(f.app.NewShelf);
    nodes(render()).find(n => n.type === 'button').props.onClick();
    nodes(render()).find(n => n.type === 'input').props.onChange({ target: { value: '  Weeknight meals  ' } });
    await nodes(render()).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    const tree = render();
    assert.equal(f.state.calls.length, 1);
    assert.equal(f.state.calls[0].name, 'createShelf');
    assert.equal(f.state.calls[0].args[0], 'Weeknight meals');
    if (fail) {
      assert.equal(nodes(tree).find(n => n.type === 'input').props.value, '  Weeknight meals  ');
      assert.ok(nodes(tree).some(n => n.props?.role === 'alert'));
      assert.equal(nodes(tree).some(n => n.props?.role === 'status'), false);
      assert.equal(f.state.refreshes, 0);
    } else {
      assert.match(text(tree), /Shelf created: Weeknight meals/);
      assert.equal(f.state.refreshes, 1);
    }
  }
});

test('asynchronous collection panels announce loading, results, and failures', () => {
  const friends = fixture({ friends: {
    overview: { incoming: [], friends: [], outgoing: [] }, feed: [], loading: true,
    busy: false, error: null, add: async () => {}, update: async () => {},
  } });
  assert.ok(nodes(friends.render(friends.app.FriendsPanel)).some(
    node => node.props?.role === 'status' && text(node) === 'Loading friends…',
  ));

  const discover = fixture({ discover: {
    data: { tags: [], recipes: [], query: '', appliedTags: [] }, loading: true, loaded: false, error: null,
    query: '', searchedQuery: '', activeTags: [], setQuery() {}, search: async () => {}, toggleTag: async () => {}, retry: async () => {},
  } });
  const discoverResults = nodes(discover.render(discover.app.DiscoverPanelView, { discover: discover.state.discover })).find(
    node => node.type === 'section' && node.props?.['aria-label'] === 'Shared recipe results',
  );
  assert.equal(discoverResults.props['aria-busy'], true);
  assert.equal(discoverResults.props['aria-live'], 'polite');
  assert.ok(nodes(discoverResults).some(node => node.props?.role === 'status'));

  const shopping = fixture({ shopping: {
    list: null, providers: [], loading: true, loaded: false, listError: null,
    providersLoading: true, providersLoaded: false, providersError: null,
    retryList() {}, retryProviders() {}, busy: false, error: null, handoff: null,
    toggle: async () => {}, remove: async () => {}, clear: async () => {}, sendToCart: async () => {},
  } });
  assert.ok(nodes(shopping.render(shopping.app.ListPanelView, { shopping: shopping.state.shopping })).some(
    node => node.props?.role === 'status' && text(node) === 'Loading shopping list…',
  ));

  const pantry = fixture({ pantry: {
    items: [], intakes: [], loading: true, loaded: false, pantryError: null,
    intakesLoading: true, intakesLoaded: false, intakesError: null,
    error: { message: 'Fixture pantry failure', signInRequired: false },
    retryPantry() {}, retryIntakes() {},
    add: async () => {}, update: async () => {}, remove: async () => {}, clear: async () => {}, resolveIntake: async () => true,
  } });
  const pantryShell = pantry.app.CookPanel({ clerkEnabled: false });
  const pantryTree = pantry.render(pantryShell.type, pantryShell.props);
  nodes(pantryTree).find(node => text(node) === 'My pantry' && node.props?.onClick).props.onClick();
  const openPantry = pantry.render(pantryShell.type, pantryShell.props);
  assert.ok(nodes(openPantry).some(node => node.props?.role === 'status' && text(node) === 'Loading pantry…'));
  assert.ok(nodes(openPantry).some(node => node.props?.role === 'alert' && text(node).includes('Fixture pantry failure')));

  const expiredList = fixture({ shopping: {
    list: null, providers: [], loading: false, loaded: true, listError: null,
    providersLoading: false, providersLoaded: true, providersError: null,
    retryList() {}, retryProviders() {}, busy: false,
    error: { message: 'Your sign-in may have ended.', signInRequired: true }, handoff: null,
    toggle: async () => {}, remove: async () => {}, clear: async () => {}, sendToCart: async () => {},
  } });
  const signInLink = nodes(expiredList.render(expiredList.app.ListPanelView, { shopping: expiredList.state.shopping })).find(
    node => node.props?.href === '/sign-in?redirect_url=%2Flist' && text(node) === 'Sign in again',
  );
  assert.equal(signInLink.props.href, '/sign-in?redirect_url=%2Flist');
});

test('mobile meal picker honors both injected motion preferences', () => {
  for (const reducedMotion of [false, true]) {
    const f = fixture({ reducedMotion });
    const tree = f.render(f.app.MobilePlanScreen, { initialWeek: "2026-11-02", client: {} });
    const modal = nodes(tree).find(node => node.type === 'Modal');
    assert.ok(modal, 'The actual planner renders its meal picker modal');
    assert.equal(modal.props.animationType, reducedMotion ? 'none' : 'slide');
    assert.equal(f.state.calls.length, 0);
  }
});
