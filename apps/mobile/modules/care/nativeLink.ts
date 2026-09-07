import { parseCareLink } from '@seconds/core/format';

/** Drop unknown or duplicate care fields before they enter navigation state. */
export function normalizeCareIntent(path: string): string {
  if (!path.startsWith('seconds://care') && path.split(/[?#]/)[0] !== '/care') return path;
  try {
    const url = new URL(path, 'seconds://local');
    const careRoute = url.protocol === 'seconds:' &&
      ((url.hostname === 'care' && (url.pathname === '' || url.pathname === '/')) ||
        (url.hostname === 'local' && url.pathname === '/care'));
    if (!careRoute || url.username || url.password || url.port) return '/care';
    const input: Record<string, string | string[]> = {};
    for (const key of new Set(url.searchParams.keys())) {
      const values = url.searchParams.getAll(key);
      input[key] = values.length === 1 ? values[0]! : values;
    }
    const query = new URLSearchParams(parseCareLink(input) as Record<string, string>).toString();
    return query ? `/care?${query}` : '/care';
  } catch {
    return '/care';
  }
}
