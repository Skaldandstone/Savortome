type AccountSession = { id: string; user: { id: string }; getToken: () => Promise<string | null> };

/** Pin a write to the account that initiated it, including asynchronous token refresh. */
export async function getAccountToken(accountId: string, currentSession: () => AccountSession | null | undefined) {
  const session = currentSession();
  if (!session || session.user.id !== accountId) throw new Error('Sign in again before saving.');
  const token = await session.getToken();
  const active = currentSession();
  if (!token || active?.id !== session.id || active.user.id !== accountId) throw new Error('Sign in again before saving.');
  return token;
}
