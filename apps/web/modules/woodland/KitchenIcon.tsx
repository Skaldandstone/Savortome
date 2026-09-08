import type { SVGProps } from 'react';

export type KitchenIconName = 'book' | 'pot' | 'sprig' | 'plan' | 'person' | 'more' | 'plus' | 'clock' | 'arrow' | 'basket';

/** Native line icons remain crisp at enlarged text sizes; all links keep labels. */
export function KitchenIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: KitchenIconName }) {
  const paths: Record<KitchenIconName, React.ReactNode> = {
    book: <><path d="M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Z" /><path d="M12 6v15M5 7l4 1M5 10l4 1M15 8l4-1M15 11l4-1" /></>,
    pot: <><path d="M5 9h14v9c0 3-14 3-14 0V9ZM3 7h18M7 4h10M10 4V2h4v2M2 11h3m14 0h3" /></>,
    sprig: <><path d="M7 22c5-6 9-12 10-20M13 12C6 13 4 8 6 5c5 1 8 3 7 7ZM10 18C4 20 2 16 3 13c4 0 7 1 7 5ZM16 8c5 0 7-2 6-5-4 0-6 2-6 5ZM13 15c5 1 8-2 8-5-4 0-7 1-8 5Z" /></>,
    plan: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M7 2v5m10-5v5M3 10h18M7 14h3m4 0h3M7 17h3" /></>,
    person: <><circle cx="12" cy="7" r="4" /><path d="M3 22c0-10 18-10 18 0Z" /></>,
    more: <><circle cx="4" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="20" cy="12" r="1" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    clock: <><circle cx="12" cy="13" r="9" /><path d="M12 7v6l4 2M9 1h6M12 1v3" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    basket: <><path d="M3 10h18l-2 11H5L3 10ZM6 10l6-8 6 8M9 14v4m6-4v4" /></>,
  };
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
