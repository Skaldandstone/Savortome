import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const webRoot = fileURLToPath(new URL("../apps/web/", import.meta.url));
const wrapperFiles = new Set([
  "apps/web/ui/Button.tsx",
  "apps/web/ui/Field.tsx",
]);

function tagName(node) {
  return node.tagName?.getText();
}

function attributes(node) {
  const result = new Map();
  for (const property of node.attributes?.properties ?? []) {
    if (ts.isJsxAttribute(property)) result.set(property.name.getText(), property.initializer);
  }
  return result;
}

function hasLabellingAncestor(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isJsxElement(parent)) continue;
    const tag = tagName(parent.openingElement);
    if (tag === "label" || tag === "Labelled") return true;
  }
  return false;
}

function hasButtonContent(node) {
  if (!ts.isJsxOpeningElement(node) || !ts.isJsxElement(node.parent)) return false;
  return node.parent.children.some((child) =>
    (ts.isJsxText(child) && Boolean(child.text.trim())) ||
    (ts.isJsxExpression(child) && Boolean(child.expression)) ||
    ts.isJsxElement(child),
  );
}

function inspectSource(source, file) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const issues = [];
  const report = (node, rule) => issues.push({
    file,
    line: parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    rule,
  });

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      const attrs = attributes(node);

      if (["input", "select", "textarea"].includes(tag)) {
        const type = attrs.get("type")?.getText() ?? "";
        const named = type.includes("hidden") || hasLabellingAncestor(node) ||
          attrs.has("aria-label") || attrs.has("aria-labelledby");
        if (!named) report(node, `${tag}-requires-name`);
      }

      if (tag === "button" && !attrs.has("aria-label") &&
          !attrs.has("aria-labelledby") && !hasButtonContent(node)) {
        report(node, "button-requires-name");
      }

      if (tag === "img" && !attrs.has("alt")) report(node, "image-requires-alt");
      if (tag === "iframe" && !attrs.has("title")) report(node, "iframe-requires-title");
      if (tag === "dialog" && !attrs.has("aria-label") && !attrs.has("aria-labelledby")) {
        report(node, "dialog-requires-name");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return issues;
}

assert.deepEqual(inspectSource("const x=<label>Name<input /></label>", "fixture.tsx"), []);
assert.deepEqual(inspectSource("const x=<input aria-label='Name' />", "fixture.tsx"), []);
assert.deepEqual(inspectSource("const x=<input type='hidden' />", "fixture.tsx"), []);
assert.equal(inspectSource("const x=<input />", "fixture.tsx")[0]?.rule, "input-requires-name");
assert.equal(inspectSource("const x=<img />", "fixture.tsx")[0]?.rule, "image-requires-alt");
assert.equal(inspectSource("const x=<button />", "fixture.tsx")[0]?.rule, "button-requires-name");

const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    if ([".next", ".next-build", "node_modules"].includes(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".tsx")) files.push(path);
  }
}
walk(webRoot);

const issues = files.flatMap((path) => {
  const file = relative(root, path).replaceAll("\\", "/");
  if (wrapperFiles.has(file)) return [];
  return inspectSource(readFileSync(path, "utf8"), file);
});

if (issues.length) {
  for (const issue of issues) console.error(`${issue.file}:${issue.line} ${issue.rule}`);
  throw new Error(`${issues.length} unnamed native accessibility control(s) found.`);
}

console.log(`Accessibility source audit passed for ${files.length} TSX files.`);
