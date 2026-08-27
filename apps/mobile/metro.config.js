const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Metro has to see the workspace packages and the root node_modules.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Hierarchical lookup stays ON: React Native resolves some of its own internals
// by walking up from wherever it happens to live, and pnpm's layout puts that
// somewhere Metro won't find with the lookup disabled.

/**
 * @seconds/core ships TypeScript source that uses ESM-style ".js" import
 * specifiers ("./units.js" for units.ts). Metro has no extensionAlias option,
 * so relative ".js" specifiers that don't exist on disk get retried as ".ts".
 */
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    const asTypeScript = moduleName.replace(/\.js$/, ".ts");
    try {
      return context.resolveRequest(context, asTypeScript, platform);
    } catch {
      // Genuinely a .js file — fall through to the normal resolver.
    }
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
