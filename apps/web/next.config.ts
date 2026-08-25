import type { NextConfig } from "next";

const config: NextConfig = {
  // The workspace packages ship TypeScript source rather than a build step.
  transpilePackages: ["@nomnom/core", "@nomnom/db"],
  // The workspace packages are TypeScript source using ESM-style ".js" import
  // specifiers, so the bundler has to map those back to the ".ts" files on disk.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  turbopack: {
    resolveExtensions: [".ts", ".tsx", ".mdx", ".js", ".jsx", ".mjs", ".json"],
  },
  images: {
    // Recipe thumbnails come from wherever the source lives.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default config;
