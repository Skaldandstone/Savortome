import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const mobileRoot = fileURLToPath(new URL("../apps/mobile/", import.meta.url));
const wrapperFiles = new Set([
  "apps/mobile/ui/Button.tsx",
  "apps/mobile/ui/Field.tsx",
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

function isExplicitFalse(initializer) {
  return initializer?.getText() === "{false}";
}

function hasHiddenAncestor(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!ts.isJsxElement(parent)) continue;
    const attrs = attributes(parent.openingElement);
    if (isExplicitFalse(attrs.get("accessible")) || attrs.has("accessibilityElementsHidden")) return true;
  }
  return false;
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

      if ((tag === "Field" || tag === "TextInput" || tag === "Switch") && !attrs.has("accessibilityLabel")) {
        report(node, `${tag}-requires-name`);
      }

      if (tag === "Pressable" && !attrs.has("accessibilityRole")) {
        report(node, "Pressable-requires-role");
      }

      if (tag === "Image") {
        const hidden = isExplicitFalse(attrs.get("accessible")) || hasHiddenAncestor(node);
        if (!hidden && !attrs.has("accessibilityLabel")) report(node, "Image-requires-name-or-hidden-state");
      }

      if (tag === "ActivityIndicator" && !attrs.has("accessibilityLabel")) {
        report(node, "ActivityIndicator-requires-name");
      }

      if (tag === "Text" && attrs.has("onPress") && !attrs.has("accessibilityRole")) {
        report(node, "pressable-Text-requires-role");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return issues;
}

assert.deepEqual(inspectSource("const x=<Field accessibilityLabel='Recipe name' />", "fixture.tsx"), []);
assert.equal(inspectSource("const x=<Field />", "fixture.tsx")[0]?.rule, "Field-requires-name");
assert.deepEqual(inspectSource("const x=<Pressable accessibilityRole='button' />", "fixture.tsx"), []);
assert.equal(inspectSource("const x=<Pressable />", "fixture.tsx")[0]?.rule, "Pressable-requires-role");
assert.deepEqual(inspectSource("const x=<Image accessible={false} />", "fixture.tsx"), []);
assert.deepEqual(inspectSource("const x=<View accessible={false}><Image /></View>", "fixture.tsx"), []);
assert.deepEqual(inspectSource("const x=<Image accessibilityLabel='Recipe photo' />", "fixture.tsx"), []);
assert.equal(inspectSource("const x=<Image />", "fixture.tsx")[0]?.rule, "Image-requires-name-or-hidden-state");
assert.equal(inspectSource("const x=<ActivityIndicator />", "fixture.tsx")[0]?.rule, "ActivityIndicator-requires-name");
assert.equal(inspectSource("const x=<Text onPress={open}>Source</Text>", "fixture.tsx")[0]?.rule, "pressable-Text-requires-role");

const files = [];
function walk(directory) {
  for (const name of readdirSync(directory)) {
    if ([".expo", "android", "node_modules"].includes(name)) continue;
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".tsx")) files.push(path);
  }
}
walk(mobileRoot);

const issues = files.flatMap((path) => {
  const file = relative(root, path).replaceAll("\\", "/");
  if (wrapperFiles.has(file)) return [];
  return inspectSource(readFileSync(path, "utf8"), file);
});

if (issues.length) {
  for (const issue of issues) console.error(`${issue.file}:${issue.line} ${issue.rule}`);
  throw new Error(`${issues.length} mobile accessibility source issue(s) found.`);
}

console.log(`Mobile accessibility source audit passed for ${files.length} TSX files.`);
