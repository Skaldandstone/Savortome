/** Deliberately exact: query overrides must never redirect destructive checks. */
export function requireBetaDatabaseUrl(url: string | undefined): string {
  if (url !== 'postgresql://sb_beta@127.0.0.1:55494/seconds_beta') {
    throw new Error('Only the documented disposable local beta database is permitted.');
  }
  return url;
}
