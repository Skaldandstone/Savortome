import type { CareFood } from '@seconds/core/format';

export type CareSaveResult =
  | { status: 'saved'; message: string }
  | { status: 'sign-in'; message: string }
  | { status: 'unconfirmed'; message: string }
  | { status: 'superseded' };

/** No queued writes or automatic retry. An ambiguous network result is never called saved. */
export async function saveCareIdea(
  food: Pick<CareFood, 'shoppingItem'>,
  context: {
    accountId: string | null;
    currentAccount: () => string | null;
    write: (items: { canonicalItem: string; displayName: string }[]) => Promise<unknown>;
    timeoutMs?: number;
  },
): Promise<CareSaveResult> {
  const { accountId } = context;
  if (!accountId) return { status: 'sign-in', message: 'Sign in to save this idea. Your choice is still here; nothing has been added.' };
  if (context.currentAccount() !== accountId) return { status: 'superseded' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      context.write([{ canonicalItem: food.shoppingItem, displayName: food.shoppingItem }]),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('List update timed out')), context.timeoutMs ?? 12000); }),
    ]);
    if (context.currentAccount() !== accountId) return { status: 'superseded' };
    return { status: 'saved', message: `${food.shoppingItem} added to your shopping list.` };
  } catch (error) {
    if (context.currentAccount() !== accountId) return { status: 'superseded' };
    const authError = (error as { status?: number })?.status === 401 || (error instanceof Error && /401|sign in/i.test(error.message));
    return authError
      ? { status: 'sign-in', message: 'Sign in again to save this idea. Your selection is still here; nothing has been added.' }
      : { status: 'unconfirmed', message: 'We could not confirm the list update. Reconnect and check your list before trying again.' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
