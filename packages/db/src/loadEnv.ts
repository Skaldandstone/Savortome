import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads every KEY=value line from .env.local into process.env, for a
 * standalone script run outside Next.js — which loads .env.local on its
 * own, so nothing here ever runs for the app itself.
 *
 * Every check/utility script under packages/db/scripts used to hand-extract
 * just DATABASE_URL via its own copy-pasted regex, so any script that also
 * needed a different variable (GROCERY_TOKEN_ENCRYPTION_KEY, say) silently
 * never got it — not because the key was missing from .env.local, but
 * because nothing ever read the rest of the file. This loads the whole
 * thing once, so any script can just read process.env normally.
 *
 * Only sets a key if it isn't already set, so an explicit shell export
 * still wins over the file.
 */
export function loadEnvLocal(): void {
  for (const candidate of [".env", "../../apps/web/.env.local", "../../.env.local"]) {
    let contents: string;
    try {
      contents = readFileSync(resolve(process.cwd(), candidate), "utf8");
    } catch {
      continue; // Not there; try the next location.
    }
    for (const line of contents.split("\n")) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match as unknown as [string, string, string];
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
    return;
  }
}
