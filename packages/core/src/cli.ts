/**
 * Import a recipe from the terminal — the fastest way to sanity-check the
 * pipeline against a real link before the UI is involved.
 *
 *   pnpm ingest -- "https://www.youtube.com/watch?v=..."
 *   pnpm ingest -- "https://someblog.com/best-chili" --force-model --json
 */
import { ingestUrl } from "./ingest.js";
import type { Recipe } from "./recipe.js";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const asJson = args.includes("--json");
const forceModel = args.includes("--force-model");

if (!url) {
  console.error("usage: pnpm ingest -- <url> [--json] [--force-model]");
  process.exit(1);
}

const fmtAmount = (i: Recipe["ingredients"][number]) => {
  const q =
    i.quantity === null
      ? ""
      : i.quantityMax !== null
        ? `${i.quantity}-${i.quantityMax}`
        : String(i.quantity);
  return [q, i.unit ?? ""].filter(Boolean).join(" ");
};

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

try {
  const started = Date.now();
  const { recipe, trace, freeExtraction } = await ingestUrl(url, { forceModel });

  if (asJson) {
    console.log(JSON.stringify(recipe, null, 2));
  } else {
    console.log(`\n${recipe.title}`);
    console.log("=".repeat(recipe.title.length));
    if (recipe.description) console.log(`\n${recipe.description}`);

    const meta = [
      recipe.servingsNote ?? (recipe.servings ? `serves ${recipe.servings}` : null),
      recipe.totalMinutes ? `${recipe.totalMinutes} min total` : null,
      recipe.cuisine,
      recipe.difficulty,
    ].filter(Boolean);
    if (meta.length) console.log(`\n${meta.join("  ·  ")}`);
    if (recipe.tags.length) console.log(recipe.tags.map((t) => `#${t}`).join(" "));

    console.log("\nINGREDIENTS");
    let group: string | null = null;
    for (const i of recipe.ingredients) {
      if (i.group !== group) {
        group = i.group;
        if (group) console.log(`\n  ${group}`);
      }
      const amount = fmtAmount(i);
      console.log(
        `  ${amount ? amount.padEnd(10) : "".padEnd(10)} ${i.item}` +
          `${i.notes ? `, ${i.notes}` : ""}${i.optional ? "  (optional)" : ""}`,
      );
    }

    console.log("\nSTEPS");
    for (const s of recipe.steps) {
      const stamp = s.sourceTimestamp !== null ? ` [${mmss(s.sourceTimestamp)}]` : "";
      const timer = s.timerSeconds
        ? `  (timer ${s.timerSeconds < 90 ? `${s.timerSeconds}s` : `${Math.round(s.timerSeconds / 60)}m`})`
        : "";
      console.log(`  ${s.n}.${stamp} ${s.text}${timer}`);
    }

    if (recipe.equipment.length) console.log(`\nEQUIPMENT: ${recipe.equipment.join(", ")}`);
    console.log(`\nCONFIDENCE: ${recipe.confidence.toFixed(2)}`);
    if (recipe.extractionNotes.length) {
      console.log("NOTES:");
      for (const n of recipe.extractionNotes) console.log(`  - ${n}`);
    }
  }

  console.error(
    `\n--- pipeline (${((Date.now() - started) / 1000).toFixed(1)}s` +
      `${freeExtraction ? ", no model call" : ""}) ---`,
  );
  for (const t of trace) console.error(`  ${t}`);
} catch (err) {
  const e = err as Error & { trace?: string[] };
  console.error(`\nImport failed: ${e.message}`);
  if (e.trace) for (const t of e.trace) console.error(`  ${t}`);
  process.exit(1);
}
