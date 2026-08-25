const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Metro has to see the workspace packages and the hoisted pnpm store.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

/**
 * @nomnom/core ships TypeScript source that uses ESM-style ".js" import
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
