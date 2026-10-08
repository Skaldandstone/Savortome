import { foodLogId, parseFoodLogInput, type FoodLogInput } from "@seconds/core/format";

export type FoodNoteRecovery =
  | { kind: "draft" | "save-unconfirmed"; input: FoodLogInput; uncertainty: string }
  | { kind: "delete-unconfirmed"; id: string };
export type FoodNoteRecoveryRead =
  | { status: "empty" }
  | { status: "review"; recovery: FoodNoteRecovery }
  | { status: "expired" | "invalid" };
type Session = { accountId: string; sessionId: string };
type Storage = { get: (key: string) => Promise<string | null>; set: (key: string, value: string) => Promise<void>; remove: (key: string) => Promise<void> };
type Options = { accountId: string; sessionId: string; environment: string; currentSession: () => Session | null; digest: (text: string) => Promise<string>; storage: Storage; now?: () => number };
const lifetime = 24 * 60 * 60 * 1000;
// Serialize across store instances, so an old pending write cannot overtake a
// later discard. Different account/environment keys never share data or queues.
const queues = new Map<string, Promise<unknown>>();
const failure = () => new Error("Local recovery could not be confirmed. An earlier local operation may still finish. Review your account and try again; nothing retries automatically.");
function normalize(value: unknown): FoodNoteRecovery {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw failure();
  const item = value as Record<string, unknown>;
  if (item.kind === "delete-unconfirmed") return { kind: item.kind, id: foodLogId(item.id) };
  if (item.kind !== "draft" && item.kind !== "save-unconfirmed") throw failure();
  if (typeof item.uncertainty !== "string" || item.uncertainty.length > 300) throw failure();
  return { kind: item.kind, input: parseFoodLogInput(item.input), uncertainty: item.uncertainty };
}
function byteLength(text: string) {
  let bytes = 0;
  for (const character of text) { const code = character.codePointAt(0)!; bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4; }
  return bytes;
}

/** Storage primitive only. Callers must obtain explicit local-storage consent,
 * present recovered data for review, and never dispatch an API from a read.
 * Photo/audio files, tokens and pantry data are never part of this format. */
export function createFoodNoteRecoveryStore(options: Options) {
  const now = options.now ?? Date.now;
  const active = () => {
    try {
      const session = options.currentSession();
      if (!options.accountId || !options.sessionId || !options.environment || session?.accountId !== options.accountId || session.sessionId !== options.sessionId) throw failure();
    } catch { throw failure(); } // An unavailable SDK lookup neither authorizes storage nor exposes its details.
  };
  // JSON framing avoids ambiguous concatenations between environments/accounts.
  let key: Promise<string> | undefined;
  const scoped = () => key ??= options.digest(JSON.stringify(["savortome-food-recovery-v1", options.environment, options.accountId])).then(hash => {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw failure();
    return `savortome_food_recovery_${hash}`;
  }).catch(() => { key = undefined; throw failure(); });
  async function run<T>(consent: boolean, operation: (key: string) => Promise<T>): Promise<T> {
    if (consent !== true) throw failure();
    active();
    let expired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { expired = true; reject(failure()); }, 12000);
    });
    const work = (async () => {
      const name = await scoped(); active();
      if (expired) throw failure();
      const previous = queues.get(name) ?? Promise.resolve();
      const task = previous.catch(() => undefined).then(async () => {
        active();
        if (expired) throw failure(); // Never dispatch a timed-out queued task.
        const result = await operation(name);
        active(); // Never expose late old-session data/results to a new session.
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
  return {
    async keep(value: FoodNoteRecovery, consent: boolean): Promise<void> {
      // Freeze/allowlist before waiting on any asynchronous storage boundary.
      const recovery = normalize(value);
      return run(consent, async name => {
        const savedAt = now();
        if (!Number.isSafeInteger(savedAt) || savedAt < 0) throw failure();
        const serialized = JSON.stringify({ version: 1, scope: name, savedAt, recovery });
        // Stay below common secure-store payload limits, including UTF-8 text.
        if (byteLength(serialized) > 1900) throw failure();
        await options.storage.set(name, serialized);
      });
    },
    async read(consent: boolean): Promise<FoodNoteRecoveryRead> {
      return run(consent, async name => {
        const raw = await options.storage.get(name);
        if (raw === null) return { status: "empty" };
        try {
          if (byteLength(raw) > 1900) return { status: "invalid" };
          const envelope = JSON.parse(raw);
          if (envelope?.version !== 1 || envelope.scope !== name || !Number.isSafeInteger(envelope.savedAt) || envelope.savedAt < 0) return { status: "invalid" };
          const time = now();
          if (!Number.isSafeInteger(time) || time < envelope.savedAt || time - envelope.savedAt >= lifetime) return { status: "expired" };
          return { status: "review", recovery: normalize(envelope.recovery) };
        } catch { return { status: "invalid" }; }
        // Do not silently delete expired/invalid uncertainty. The UI must offer
        // deliberate local discard and a fresh server review, never a retry.
      });
    },
    discard(consent: boolean): Promise<void> {
      return run(consent, name => options.storage.remove(name));
    },
  };
}
