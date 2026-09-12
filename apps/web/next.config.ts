import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

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
    // Recipe photos use browser <img> URLs; woodland art uses public files.
    // Neither needs the server optimizer. Close its request endpoint rather
    // than accepting arbitrary HTTPS images. Keep static metadata/icon support.
    // This reduces exposure; it does not patch Next's bundled image parser.
    unoptimized: true,
    remotePatterns: [],
  },
};

/**
 * withSentryConfig adds the SDK's build-time wiring: the server, edge and
 * client instrumentation entry points, and tree-shaking of its debug code.
 *
 * Source-map upload is off. It would need a SENTRY_AUTH_TOKEN inside the
 * fail-closed image build, and that build has to stay reproducible from the
 * reviewed snapshot without holding any credential. Stack traces arrive
 * minified; the exception type, message and route are intact, which is what
 * the scrubbing in lib/sentry-shared.ts leaves us anyway.
 */
export default withSentryConfig(config, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: false,
  },
});
