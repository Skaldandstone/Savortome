// Packaging requires UTF-8 even when a local TypeScript reader tolerates bad bytes.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml", ".css", ".sql"]);
const decoder = new TextDecoder("utf-8", { fatal: true });
const names = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(name => extensions.has(extname(name)));
const failed = [];
for (const name of names) {
  try { decoder.decode(readFileSync(name)); } catch { failed.push(name); }
}
if (failed.length) throw new Error("Source files must be valid UTF-8: " + failed.join(", "));
console.log("Validated UTF-8 for " + names.length + " tracked source/configuration files.");
