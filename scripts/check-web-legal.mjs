import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const footer = read('apps/web/ui/LegalFooter.tsx');
const layout = read('apps/web/app/layout.tsx');
const globalCss = read('apps/web/app/globals.css');

for (const route of ['privacy', 'terms', 'accessibility']) {
  const page = read(`apps/web/app/${route}/page.tsx`);
  assert.match(page, /export const metadata/);
  assert.match(page, /<h1>/);
  assert.match(page, /james@skaldandstone\.com|PrivacyPage/);
  assert.match(footer, new RegExp(`href="/${route}"`));
}

assert.match(footer, /© 2026 Skald and Stone LLC/);
assert.match(footer, /Imported recipes, source media, and user content belong to their respective owners/);
assert.match(layout, /href="#main-content"/);
assert.equal((layout.match(/id="main-content"/g) ?? []).length, 3);
assert.match(globalCss, /\.cl-footerItem p/);
assert.match(globalCss, /:focus-visible/);

console.log('10 web legal, ownership, focus, and Clerk contrast contracts passed.');
