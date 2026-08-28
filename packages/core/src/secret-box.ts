import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Authenticated encryption for secrets we must store but never want readable
 * from the database alone -- specifically a shopper's Kroger OAuth tokens,
 * which are live bearer credentials against that person's real grocery account.
 *
 * Neon encrypts the disk at rest, but that only defends against someone walking
 * off with the physical storage. It does nothing if the database *contents*
 * leak -- a mislaid DATABASE_URL, an over-permissioned read replica, a backup
 * that lands in the wrong bucket, an injection. The key here lives outside the
 * database (GROCERY_TOKEN_KEY, an env secret), so a contents leak yields
 * ciphertext, not usable tokens. That is the whole point, and why it is worth
 * the one key it adds to manage.
 *
 * Format: `gcm.v1.<iv>.<tag>.<ciphertext>`, each part base64url. AES-256-GCM
 * with a random 12-byte IV, and the row's identity bound in as additional
 * authenticated data (AAD) so a ciphertext can't be lifted from one row into
 * another. Anything without the `gcm.v1.` prefix is treated as legacy plaintext
 * and returned unchanged, so existing rows keep working and upgrade to
 * ciphertext the next time they are written.
 */

const PREFIX = "gcm.v1.";
const KEY_SALT = "seconds.grocery-token.v1";

let cached: { source: string; key: Buffer } | undefined;

/**
 * The 32-byte key derived from GROCERY_TOKEN_KEY, or null when it is unset.
 * Any string works as the env value; it is stretched with scrypt, so operators
 * don't have to produce exactly 32 bytes by hand. Cached by source so repeated
 * token operations don't re-run the (deliberately slow) derivation.
 */
export function resolveTokenKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.GROCERY_TOKEN_KEY?.trim();
  if (!raw) return null;
  if (cached && cached.source === raw) return cached.key;
  const key = scryptSync(raw, KEY_SALT, 32);
  cached = { source: raw, key };
  return key;
}

/** Whether a stored value is one of our ciphertexts (vs. legacy plaintext). */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Encrypt a secret for storage, binding `aad` (the row identity) into the
 * authentication tag. With no key configured this returns the plaintext
 * unchanged in dev/test so the app runs without ceremony -- but throws in
 * production, where storing a grocery token in the clear is not acceptable.
 */
export function encryptSecret(
  plaintext: string,
  aad: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = resolveTokenKey(env);
  if (!key) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "GROCERY_TOKEN_KEY must be set in production before storing grocery tokens.",
      );
    }
    return plaintext;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

/**
 * Decrypt a stored secret. Legacy plaintext (no prefix) is returned unchanged.
 * A ciphertext decrypted with no key, the wrong key, a tampered body, or a
 * mismatched `aad` throws rather than handing back a corrupted token.
 */
export function decryptSecret(
  stored: string,
  aad: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!isEncrypted(stored)) return stored;
  const key = resolveTokenKey(env);
  if (!key) {
    throw new Error("GROCERY_TOKEN_KEY is not set, but a stored grocery token is encrypted.");
  }
  const parts = stored.slice(PREFIX.length).split(".");
  if (parts.length !== 3) throw new Error("Malformed encrypted secret.");
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64url")) as [
    Buffer,
    Buffer,
    Buffer,
  ];
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
