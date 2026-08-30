import type { NextConfig } from "next";

const config: NextConfig = {
  async headers() {
    return [
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/care', headers: [{ key: 'Cache-Control', value: 'private, no-store' }, { key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
  /**
   * `next build` and `next dev` both write to `.next` by default, so building
   * while the dev server is running leaves it serving production chunks it
   * can't hydrate — a page that renders and then does nothing. Giving the
   * build its own directory makes that impossible.
   */
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",

  // The workspace packages ship TypeScript source rather than a build step.
  transpilePackages: ["@seconds/core", "@seconds/db"],
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
