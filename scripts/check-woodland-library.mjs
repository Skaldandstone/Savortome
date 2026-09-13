// Actual server/components compiled to JSX object trees, with external boundaries
// replaced. No browser, HTTP server, database, screenshots or visual assertions.
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const libraryExports = `export {LibraryList,LibraryNotice} from 'actual-list';
export const LibraryExport=()=>null, LibrarySearch=()=>null, LibrarySort=()=>null, ShelfFilter=()=>null;`;
const stubs = {
  'react/jsx-runtime': 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx; export const Fragment="fragment";',
  'next/link': 'export default function Link(){}',
  '@/lib/beta': 'export const canUseBeta=async()=>state.allowed;',
  '@/lib/library': 'export const loadLibrary=async()=>state.library;',
  '@/modules/import': 'export const ImportPanel=()=>null;',
  '@/modules/shelves': 'export const ShelfBadge=()=>null;',
  '@/modules/woodland/Woodland': 'export const KitchenWelcome=()=>null, RecipeImportLink=()=>null;',
  '@/modules/woodland/KitchenIcon': 'export function KitchenIcon(){}',
  '@/modules/woodland/FoodIllustration': 'export function FoodIllustration(){}',
  '@/modules/library': libraryExports,
  'library-index': libraryExports,
  'new-shelf': 'export function NewShelf(){}',
};
const result = await build({
  absWorkingDir: root, stdin: { resolveDir: root, contents: `
    export {default as Home} from './apps/web/app/page.tsx';
    export {WoodlandLibrary} from './apps/web/modules/library/WoodlandLibrary.tsx';
    export {LibraryList} from './apps/web/modules/library/LibraryList.tsx';
    export {LibraryItem} from './apps/web/modules/library/LibraryItem.tsx';` },
  bundle: true, write: false, platform: 'node', format: 'iife', globalName: 'tested', jsx: 'automatic',
  plugins: [{ name: 'library-boundaries', setup(api) {
    api.onResolve({ filter: /.*/ }, args => {
      if (Object.hasOwn(stubs, args.path)) return { path: args.path, namespace: 'fixture' };
      if (args.path === 'actual-list') return { path: root + 'apps/web/modules/library/LibraryList.tsx' };
      if (args.path === '@/modules/library/WoodlandLibrary') return { path: root + 'apps/web/modules/library/WoodlandLibrary.tsx' };
      if (args.path === './index' && args.importer.endsWith('WoodlandLibrary.tsx')) return { path: 'library-index', namespace: 'fixture' };
      if (args.path === './NewShelf') return { path: 'new-shelf', namespace: 'fixture' };
      if (args.path.endsWith('.css')) return { path: args.path, namespace: 'css-fixture' };
    });
    api.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: stubs[args.path], loader: 'js' }));
    api.onLoad({ filter: /.*/, namespace: 'css-fixture' }, () => ({ contents: 'export default new Proxy({}, {get:(_,key)=>key});', loader: 'js' }));
  } }],
});
const entry = { id: 'fixture-recipe', title: 'Fixture', imageUrl: null, totalMinutes: 2, ingredientCount: 1, attribution: 'test', status: null, stars: null, timesCooked: 0 };
function fixture(allowed) {
  // React's development entrypoint reads NODE_ENV during module evaluation.
  // Keep the VM fixture explicit so dependency patches cannot make these
  // component-contract checks depend on the parent process globals.
  const sandbox = {
    process: { env: { NODE_ENV: 'test' } },
    state: { allowed, library: { kind: 'ok', entries: [entry], shelves: [], total: 1 } },
    URLSearchParams,
  };
  runInNewContext(result.outputFiles[0].text, sandbox);
  return sandbox.tested;
}
function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
test('server-selected legacy home cannot opt into woodland through query flags', async () => {
  const app = fixture(false);
  const page = await app.Home({ searchParams: Promise.resolve({ woodland: 'true', SB_BETA_ENABLED: 'true' }) });
  assert.equal(page.type, 'main');
  assert.equal(nodes(page).some(n => n.type === app.WoodlandLibrary), false);
  const legacy = nodes(page).find(n => n.type?.name === 'Library');
  const content = await legacy.type(legacy.props);
  const list = nodes(content).find(n => n.type === app.LibraryList);
  assert.equal(list.props.woodland, undefined);
});
test('server-selected woodland home passes the real entries to the illustrated list', async () => {
  const app = fixture(true);
  const page = await app.Home({ searchParams: Promise.resolve({}) });
  assert.equal(page.type, app.WoodlandLibrary);
  const content = await app.WoodlandLibrary(page.props);
  const list = nodes(content).find(n => n.type === app.LibraryList);
  assert.equal(list.props.woodland, true);
  assert.equal(list.props.entries[0].id, entry.id);
});
test('legacy library keeps its empty copy and missing-image placeholder without atlas art', () => {
  const app = fixture(false);
  assert.equal(app.LibraryList({ entries: [] }).props.children, 'Nothing here yet. Import something above.');
  const list = app.LibraryList({ entries: [entry] });
  const itemProps = nodes(list).find(n => n.type === app.LibraryItem).props;
  assert.equal(itemProps.woodland, false);
  const item = nodes(app.LibraryItem(itemProps));
  assert.equal(item.some(n => n.type?.name === 'FoodIllustration'), false);
  assert.equal(item.some(n => n.type?.name === 'KitchenIcon'), false);
  assert.ok(item.some(n => n.type === 'img' && n.props.src === undefined));
});
test('illustrated library alone receives the journal fallback and arrow', () => {
  const app = fixture(true);
  const list = app.LibraryList({ entries: [entry], woodland: true });
  const itemProps = nodes(list).find(n => n.type === app.LibraryItem).props;
  const item = nodes(app.LibraryItem(itemProps));
  assert.ok(item.some(n => n.type?.name === 'FoodIllustration' && n.props.foodId === 'journal'));
  assert.ok(item.some(n => n.type?.name === 'KitchenIcon' && n.props.name === 'arrow'));
});
