import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptSecret, encryptSecret, isEncrypted } from "../src/secret-box.js";

// A fixed key for the round-trip tests. Any string works; secret-box stretches
// it with scrypt. NODE_ENV is set on each env so the prod-guard branch is only
// exercised where a test means to.
const keyed = { GROCERY_TOKEN_KEY: "unit-test-key-abc123", NODE_ENV: "test" } as NodeJS.ProcessEnv;
const AAD = "grocery:kroger:user-1:access";

describe("secret-box", () => {
  it("round-trips a value through encrypt/decrypt", () => {
    const ciphertext = encryptSecret("kr_access_token", AAD, keyed);
    assert.equal(isEncrypted(ciphertext), true);
    assert.notEqual(ciphertext, "kr_access_token");
    assert.equal(decryptSecret(ciphertext, AAD, keyed), "kr_access_token");
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same", AAD, keyed);
    const b = encryptSecret("same", AAD, keyed);
    assert.notEqual(a, b);
    assert.equal(decryptSecret(a, AAD, keyed), "same");
    assert.equal(decryptSecret(b, AAD, keyed), "same");
  });

  it("rejects decryption under a different key", () => {
    const ciphertext = encryptSecret("secret", AAD, keyed);
    const otherKey = { GROCERY_TOKEN_KEY: "a-totally-different-key", NODE_ENV: "test" } as NodeJS.ProcessEnv;
    assert.throws(() => decryptSecret(ciphertext, AAD, otherKey));
  });

  it("rejects decryption under a mismatched AAD (row identity)", () => {
    const ciphertext = encryptSecret("secret", "grocery:kroger:user-1:access", keyed);
    assert.throws(() => decryptSecret(ciphertext, "grocery:kroger:user-2:access", keyed));
  });

  it("passes legacy plaintext through unchanged on read", () => {
    // A row written before encryption existed has no prefix.
    assert.equal(isEncrypted("legacy_plaintext_token"), false);
    assert.equal(decryptSecret("legacy_plaintext_token", AAD, keyed), "legacy_plaintext_token");
  });

  it("throws when asked to read a ciphertext with no key configured", () => {
    const ciphertext = encryptSecret("secret", AAD, keyed);
    const noKey = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
    assert.throws(() => decryptSecret(ciphertext, AAD, noKey));
  });

  it("stores plaintext when no key is set outside production (dev convenience)", () => {
    const noKey = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
    assert.equal(encryptSecret("token", AAD, noKey), "token");
  });

  it("refuses to store a token with no key in production", () => {
    const prodNoKey = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
    assert.throws(() => encryptSecret("token", AAD, prodNoKey), /GROCERY_TOKEN_KEY/);
  });
});
