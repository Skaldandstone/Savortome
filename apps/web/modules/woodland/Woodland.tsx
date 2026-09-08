'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { KitchenIcon, type KitchenIconName } from './KitchenIcon';

export function DecorationControl() {
  const [reduced, setReduced] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [textSize, setTextSize] = useState('100');
  useEffect(() => {
    try {
      const value = localStorage.getItem('seconds-decoration') === 'reduced';
      const storedTheme = localStorage.getItem('seconds-theme');
      const savedTheme = storedTheme === 'system' || storedTheme === 'light' ? storedTheme : 'dark';
      const storedSize = localStorage.getItem('seconds-text-size') ?? '100';
      const size = ['100', '125', '150', '200'].includes(storedSize) ? storedSize : '100';
      setTextSize(size); document.documentElement.dataset.textSize = size;
      setReduced(value); setTheme(savedTheme);
      document.documentElement.dataset.decoration = value ? 'reduced' : 'full';
      document.documentElement.dataset.theme = savedTheme;
    } catch {}
  }, []);
  return <details className="woodland-settings" onKeyDown={dismissDisclosure}><summary>Display options</summary><div className="woodland-preferences">
    <label>Appearance <select value={theme} onChange={e => { const next=e.target.value; setTheme(next); document.documentElement.dataset.theme=next; try { localStorage.setItem('seconds-theme',next); } catch {} }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    <label>Text size <select value={textSize} onChange={e => { const next = e.target.value; setTextSize(next); document.documentElement.dataset.textSize = next; try { localStorage.setItem('seconds-text-size', next); } catch {} }}><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select></label>
    <button className="woodland-decoration" aria-pressed={reduced} onClick={() => { const next=!reduced; setReduced(next); document.documentElement.dataset.decoration=next?'reduced':'full'; try { localStorage.setItem('seconds-decoration',next?'reduced':'full'); } catch {} }}>{reduced?'Show illustrations':'Reduce decoration'}</button>
  </div></details>;
}
export function WoodlandNavigation() {
  const pathname = usePathname();
  // Cooking is a focused, full-screen task. The fixed mobile dock otherwise
  // covers the large step card and competes with its Back/Done controls.
  if (/^\/recipe\/[^/]+\/cook\/?$/.test(pathname)) return null;
  const links: [string, string, KitchenIconName][] = [['/', 'Library', 'book'], ['/cook', 'Cook', 'pot'], ['/care', 'Feed me gently', 'sprig'], ['/plan', 'Plan', 'plan'], ['/profile', 'Profile', 'person']];
  const more = [['/list', 'Shopping list'], ['/templates', 'Saved meals'], ['/friends', 'Friends'], ['/discover', 'Discover'], ['/plans', 'Plans & account']] as const;
  return <nav className="woodland-nav" aria-label="Main navigation" data-print="hide">
    {links.map(([href, label, icon]) => <Link key={href} href={href} aria-label={href === '/profile' ? 'Dietary profile' : undefined} aria-current={pathname === href || (href === '/cook' && pathname.endsWith('/cook')) ? 'page' : undefined}><KitchenIcon name={icon} /><span>{label}</span></Link>)}
    <details className="woodland-more" onKeyDown={dismissDisclosure}><summary data-active={more.some(([href]) => pathname === href)}><KitchenIcon name="more" /><span>More</span></summary><div>{more.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} onClick={e => e.currentTarget.closest('details')?.removeAttribute('open')}>{label}</Link>)}</div></details>
  </nav>;
}
function dismissDisclosure(event: KeyboardEvent<HTMLDetailsElement>) {
  if (event.key !== 'Escape' || !event.currentTarget.open) return;
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.open = false;
  event.currentTarget.querySelector('summary')?.focus();
}
export function KitchenWelcome() {
  return <section className="woodland-welcome" aria-labelledby="kitchen-title">
    <img src="/woodland/kitchen-scene.webp" alt="" />
    <div className="woodland-welcome-copy"><h1 id="kitchen-title">Your woodland kitchen</h1><p>Simple food. Thoughtful moments.</p></div>
    <Link className="woodland-care-invitation" href="/care">Feed me gently <KitchenIcon name="sprig" /></Link>
  </section>;
}
export function RecipeImportLink({ className }: { className?: string }) {
  return <a href="#recipe-import" className={className} onClick={() => { const panel = document.getElementById('recipe-import'); if (panel instanceof HTMLDetailsElement) panel.open = true; }}><KitchenIcon name="plus" />Import recipe</a>;
}
export function CareEntry() { return <aside className="woodland-care-entry"><div><h2>Cooking can wait a little.</h2><p>Find something easy with what feels manageable today.</p></div><Link href="/care">Feed me gently <span aria-hidden="true">↗</span></Link></aside>; }
