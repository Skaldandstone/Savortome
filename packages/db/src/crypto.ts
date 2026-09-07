import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Application-level encryption for secret columns.
 *
 * Some columns hold live credentials — a shopper's Kroger OAuth tokens, say —
 * where "encrypted at rest by the database" isn't enough: a leaked backup, a
 * read-replica, or a stray `SELECT` would hand over working keys to someone
 * else's grocery account. So we encrypt those values with a key the database
 * never sees, kept in the environment instead.
 *
 * The scheme is AES-256-GCM: authenticated, so a tampered ciphertext is
 * rejected rather than silently mis-decrypted, with a fresh random IV per
 * value. Encrypted values are self-describing — a `enc:v1:` tag — which lets
 * decryption pass plaintext through untouched during a rollout (old rows still
 * read) and lets the backfill tell "already done" from "still in the clear" so
 * it can be re-run safely.
 *
 * The row's identity is bound in as additional authenticated data (AAD), so a
 * ciphertext copied from one row into another (a botched migration, an admin
 * tool bug) fails to decrypt instead of silently handing back someone else's
 * still-valid token.
 */

const PREFIX = "enc:v1:";
const IV_BYTES = 12; // 96-bit nonce, the standard size for GCM.
const TAG_BYTES = 16;

/**
 * Where the key comes from. Only read when we actually encrypt or decrypt a
 * ciphertext, so an app that never touches grocery tokens needs no key set.
 */
const KEY_ENV = "GROCERY_TOKEN_ENCRYPTION_KEY";

/**
 * Fixed salt for deriving a 32-byte key from a passphrase. A constant salt is
 * fine here: GCM's security rests on the per-value random IV, not on the key
 * derivation, and a constant keeps the same passphrase mapping to the same key
 * without anywhere extra to store a salt. Only used when the env value isn't
 * already raw 32-byte key material (see `resolveKey`).
 */
const KEY_SALT = "seconds/grocery-token/v1";

let cachedKey: Buffer | undefined;

/**
 * Turn the configured secret into 32 bytes of key.
 *
 * Accepts a real key given as 64 hex chars or 32-byte base64 (use one of these
 * in production — generate with `openssl rand -base64 32`), and falls back to
 * stretching an arbitrary passphrase with scrypt so a human-typed secret still
 * works in development.
 */
function resolveKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env[KEY_ENV];
  if (!raw || raw.trim() === "") {
    throw new Error(
      `${KEY_ENV} is not set. It is required to read or write encrypted grocery ` +
        `tokens. Generate one with \`openssl rand -base64 32\`.`,
    );
  }
  const secret = raw.trim();

  const hex = /^[0-9a-fA-F]{64}$/.test(secret) ? Buffer.from(secret, "hex") : null;
  const b64 = tryBase64(secret);

  if (hex && hex.length === 32) cachedKey = hex;
  else if (b64 && b64.length === 32) cachedKey = b64;
  else cachedKey = scryptSync(secret, KEY_SALT, 32);

  return cachedKey;
}

function tryBase64(value: string): Buffer | null {
  try {
    const buf = Buffer.from(value, "base64");
    // Reject strings that merely *look* base64-ish but round-trip to something
    // else — we only want to treat a genuine 32-byte encoding as raw key bytes.
    return buf.toString("base64").replace(/=+$/, "") === value.replace(/=+$/, "") ? buf : null;
  } catch {
    return null;
  }
}

/** True if a stored value is one of our ciphertexts rather than legacy plaintext. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypt a secret for storage. `aad` should identify the row and column this
 * value belongs to (e.g. `${userId}:${provider}:accessToken`) — it's bound
 * into the authentication tag so the ciphertext only decrypts back out under
 * that same identity. Already-encrypted input is returned unchanged, so
 * callers and the backfill never double-wrap.
 */
export function encryptSecret(plaintext: string, aad: string): string {
  if (isEncrypted(plaintext)) return plaintext;

  const key = resolveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decrypt a stored secret. `aad` must be the same row/column identity passed
 * to `encryptSecret` — a mismatch (the ciphertext came from a different row)
 * fails authentication just like a wrong key would. A value without our tag
 * is assumed to be legacy plaintext and returned as-is, so reads keep working
 * before the backfill has run.
 */
export function decryptSecret(stored: string, aad: string): string {
  if (!isEncrypted(stored)) return stored;

  const key = resolveKey();
  const blob = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = blob.subarray(0, IV_BYTES);
  const tag = blob.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error(
      `Failed to decrypt a grocery token. The value is either corrupt, was ` +
        `encrypted with a different ${KEY_ENV}, or belongs to a different row.`,
    );
  }
}

/**
 * Nullable convenience wrappers — the refresh token column is optional, and
 * threading `null` through every call site is noise.
 */
export const encryptNullable = (v: string | null, aad: string): string | null =>
  v === null ? null : encryptSecret(v, aad);
export const decryptNullable = (v: string | null, aad: string): string | null =>
  v === null ? null : decryptSecret(v, aad);
