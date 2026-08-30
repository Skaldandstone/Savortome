'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export function DecorationControl() {
  const [reduced, setReduced] = useState(false);
  const [theme, setTheme] = useState('system');
  const [textSize, setTextSize] = useState('100');
  useEffect(() => {
    try {
      const value = localStorage.getItem('seconds-decoration') === 'reduced';
      const storedTheme = localStorage.getItem('seconds-theme');
      const savedTheme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : 'system';
      const storedSize = localStorage.getItem('seconds-text-size') ?? '100';
      const size = ['100', '125', '150', '200'].includes(storedSize) ? storedSize : '100';
      setTextSize(size); document.documentElement.dataset.textSize = size;
      setReduced(value); setTheme(savedTheme);
      document.documentElement.dataset.decoration = value ? 'reduced' : 'full';
      document.documentElement.dataset.theme = savedTheme;
    } catch {}
  }, []);
  return <details className="woodland-settings"><summary>Display options</summary><div className="woodland-preferences">
    <label>Appearance <select value={theme} onChange={e => { const next=e.target.value; setTheme(next); document.documentElement.dataset.theme=next; try { localStorage.setItem('seconds-theme',next); } catch {} }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
    <label>Text size <select value={textSize} onChange={e => { const next = e.target.value; setTextSize(next); document.documentElement.dataset.textSize = next; try { localStorage.setItem('seconds-text-size', next); } catch {} }}><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select></label>
    <button className="woodland-decoration" aria-pressed={reduced} onClick={() => { const next=!reduced; setReduced(next); document.documentElement.dataset.decoration=next?'reduced':'full'; try { localStorage.setItem('seconds-decoration',next?'reduced':'full'); } catch {} }}>{reduced?'Show illustrations':'Reduce decoration'}</button>
  </div></details>;
}
export function WoodlandNavigation() {
  const pathname = usePathname();
  const links = [['/', 'Library'], ['/care', 'Feed me gently'], ['/cook', 'Cook'], ['/plan', 'Plan'], ['/list', 'Shopping list'], ['/friends', 'Friends'], ['/discover', 'Discover'], ['/profile', 'Dietary profile'], ['/plans', 'Plans']] as const;
  return <nav className="woodland-nav" aria-label="Main navigation" data-print="hide">{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav>;
}
export function KitchenWelcome() {
  return <section className="woodland-welcome" aria-labelledby="kitchen-title">
    <img src="/woodland/hearth.png" alt="" />
    <div><p>Your woodland kitchen</p><h2 id="kitchen-title">A place for every recipe.<br />And whatever feels possible.</h2><p>Gather the food you love. Make a little room for easy.</p><Link href="/care">Feed me gently <span aria-hidden="true">↗</span></Link></div>
  </section>;
}
export function CareEntry() { return <aside className="woodland-care-entry"><div><h2>Cooking can wait a little.</h2><p>Find something easy with what feels manageable today.</p></div><Link href="/care">Feed me gently <span aria-hidden="true">↗</span></Link></aside>; }
