import type { PantryIntakeInput } from "@seconds/core/format";
export type PantryRecoveryRecord = { input: PantryIntakeInput; savedAt: number };
export type PantryRecoveryRead = { status: "empty" | "expired" | "invalid" } | { status: "review"; record: PantryRecoveryRecord };
type Session = { accountId: string; sessionId: string };
type Storage = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; remove: (key: string) => Promise<void> };
type Options = { accountId: string; sessionId: string; environment: string; currentSession: () => Session | null; digest: (text: string) => Promise<string>; storage: Storage; now?: () => number };
const lifetime = 24 * 60 * 60 * 1000;
// Serialize across store instances, so an old pending write cannot overtake a
// later discard. Different account/environment keys never share data or queues.
const queues = new Map<string, Promise<unknown>>();
const closing = new Map<string, Set<symbol>>();
const failure = () => new Error("Local recovery could not be confirmed. An earlier local operation may still finish. Review your account and try again; nothing retries automatically.");
// One submitted barcode review only. Never copy arbitrary provider or form objects.
function normalize(value: unknown): PantryIntakeInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw failure();
  const input = value as PantryIntakeInput;
  if (input.source !== "barcode" || typeof input.externalReference !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.externalReference) || !Array.isArray(input.items) || input.items.length !== 1) throw failure();
  const item = input.items[0];
  const safeText = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  if (!item || !safeText(item.displayName, 120) || !item.displayName.trim() || item.displayName !== item.displayName.trim()) throw failure();
  if (item.quantity !== null && (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 10000)) throw failure();
  if (item.unit !== null && (!safeText(item.unit, 40) || !item.unit.trim() || item.unit !== item.unit.trim())) throw failure();
  if (item.quantity === null && item.unit !== null) throw failure();
  if (input.sourceLabel !== "Product entered for review" || input.acquiredAt !== null) throw failure();
  return { source: "barcode", externalReference: input.externalReference, sourceLabel: "Product entered for review", acquiredAt: null,
    items: [{ displayName: item.displayName, quantity: item.quantity, unit: item.unit }] };
}
function byteLength(text: string) {
  let bytes = 0;
  for (const character of text) { const code = character.codePointAt(0)!; bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4; }
  return bytes;
}

/** Separate native pantry policy: explicit per-review keep, no unsent drafts,
 * no API calls, 24-hour eligibility and purge on next access, never a timer promise. */
export function createPantryRecoveryStore(options: Options) {
  const now = options.now ?? Date.now;
  const sessionKey = JSON.stringify([options.environment, options.accountId, options.sessionId]);
  const hold = () => {
    const token = Symbol(); const holders = closing.get(sessionKey) ?? new Set<symbol>();
    holders.add(token); closing.set(sessionKey, holders);
    return () => { holders.delete(token); if (!holders.size && closing.get(sessionKey) === holders) closing.delete(sessionKey); };
  };
  const active = () => {
    try {
      const session = options.currentSession();
      if (!options.accountId || !options.sessionId || !options.environment || session?.accountId !== options.accountId || session.sessionId !== options.sessionId) throw failure();
    } catch { throw failure(); } // An unavailable SDK lookup neither authorizes storage nor exposes its details.
  };
  // JSON framing avoids ambiguous concatenations between environments/accounts.
  let key: Promise<string> | undefined;
  const scoped = () => key ??= options.digest(JSON.stringify(["savortome-pantry-recovery-v1", options.environment, options.accountId])).then(hash => {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw failure();
    return `savortome_pantry_recovery_${hash}`;
  }).catch(() => { key = undefined; throw failure(); });
  async function run<T>(consent: boolean, operation: (key: string, guard: () => void) => Promise<T>, write = false, deleted = false): Promise<T> {
    if (consent !== true) throw failure();
    if (!deleted) active();
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(failure()); }, 12000);
    });
    const guard = () => {
      if (expired || (write && closing.has(sessionKey))) throw failure();
      if (!deleted) active();
    };
    const work = (async () => {
      const name = await scoped(); if (!deleted) active();
      if (expired) throw failure();
      const previous = queues.get(name) ?? Promise.resolve();
      const task = previous.catch(() => undefined).then(async () => {
        if (!deleted) active();
        if (write && closing.has(sessionKey)) throw failure();
        if (expired) throw failure(); // Never dispatch a timed-out queued task.
        const result = await operation(name, guard);
        guard(); // Never expose late old-session data/results to a new session.
        return result;
      });
      queues.set(name, task);
      // Keep serialization until the real operation settles, even if its
      // caller has timed out. SecureStore operations cannot be cancelled.
      try { return await task; }
      finally { if (queues.get(name) === task) queues.delete(name); }
    })();
    try { return await Promise.race([work, deadline]); }
    catch { throw failure(); }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }
  async function inspect(name: string, guard: () => void): Promise<PantryRecoveryRead> {
    const raw = await options.storage.get(name); guard();
    if (raw === null) return { status: "empty" };
    let envelope;
    try {
      if (byteLength(raw) > 1900) return { status: "invalid" };
      envelope = JSON.parse(raw);
      if (envelope?.version !== 1 || envelope.scope !== name || !Number.isSafeInteger(envelope.savedAt) || envelope.savedAt < 0) return { status: "invalid" };
      const time = now();
      if (!Number.isSafeInteger(time) || time < envelope.savedAt) return { status: "invalid" };
      if (time - envelope.savedAt < lifetime) return { status: "review", record: { input: normalize(envelope.input), savedAt: envelope.savedAt } };
    } catch { return { status: "invalid" }; }
    // Expiry purges only when the app next accesses this owner/environment key.
    // Do not report deletion if native removal fails.
    guard(); await options.storage.remove(name);
    return { status: "expired" };
  }
  return {
    async keep(value: PantryIntakeInput, consent: boolean): Promise<PantryRecoveryRecord> {
      const input = normalize(value); // Freeze/allowlist before asynchronous boundaries.
      return run(consent, async (name, guard) => {
        const prior = await inspect(name, guard);
        guard();
        if (closing.has(sessionKey)) throw failure();
        if (prior.status === "review") {
          if (JSON.stringify(prior.record.input) !== JSON.stringify(input)) throw failure();
          return prior.record; // Never extend the retention clock on retry.
        }
        if (prior.status !== "empty") throw failure(); // Review expiry/invalid state first.
        const savedAt = now();
        if (!Number.isSafeInteger(savedAt) || savedAt < 0) throw failure();
        const serialized = JSON.stringify({ version: 1, scope: name, savedAt, input });
        if (byteLength(serialized) > 1900) throw failure();
        guard(); await options.storage.set(name, serialized);
        return { input, savedAt };
      }, true);
    },
    read(consent: boolean): Promise<PantryRecoveryRead> { return run(consent, inspect); },
    discard(consent: boolean, expectedReference?: string): Promise<void> {
      return run(consent, async (name, guard) => {
        if (expectedReference) {
          const prior = await inspect(name, guard); guard();
          if (prior.status === "invalid") throw failure();
          if (prior.status === "empty" || prior.status === "expired") return;
          if (prior.status !== "review" || prior.record.input.externalReference !== expectedReference) throw failure();
        }
        guard(); await options.storage.remove(name);
      });
    },
    // Hold new keeps while sign-out is awaiting the SDK. Release on completion/failure;
    // old-session operations still fail the live SDK check after successful sign-out.
    holdSession() {
      active(); return hold();
    },
    // A deletion flow must acquire this capability BEFORE deleting its authenticated
    // account, invoke confirmDeleted ONLY after confirmed remote deletion, or cancel.
    // Never infer deletion from sign-out, network errors, or a missing SDK session.
    prepareAccountDeletion() {
      active(); const release = hold(); let cancelled = false, complete = false;
      let pending: Promise<void> | undefined;
      return {
        cancel() { if (!pending && !complete) { cancelled = true; release(); } },
        async confirmDeleted() {
          if (cancelled) throw failure();
          if (complete) return;
          // Fixed captured owner key only. Failures remain retryable; no reads of
          // another account, no inference of deletion from auth disappearance.
          pending ??= run(true, async (name, guard) => { guard(); await options.storage.remove(name); }, false, true)
            .then(() => { complete = true; release(); })
            .finally(() => { pending = undefined; });
          return pending;
        },
      };
    },
  };
}
