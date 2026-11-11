import { existsSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.resolve(process.cwd(), "../..");

// The monorepo keeps a single .env at its root. Variables already in the environment win.
const rootEnvFile = path.join(repoRoot, ".env");
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Two years, subdomains too; Vercel serves HTTPS only. (The CSP is per request: src/proxy.ts.)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The local photo storage (development and tests only) joins a file name onto a folder at
  // runtime, which the file tracer can't follow, so it copies the whole app into every server
  // bundle that imports it. Nothing below is read at runtime: compiled code lives in .next, and the
  // photo storage reads only .photos, which never ships (production uses Vercel Blob).
  outputFileTracingExcludes: {
    "/*": [
      "./src/**",
      "./e2e/**",
      "./scripts/**",
      "./.photos/**",
      "./test-results/**",
      "./playwright-report/**",
      "./*.md",
      "./components.json",
      "./eslint.config.mjs",
      "./playwright.config.ts",
      "./vitest.config.ts",
    ],
  },
  transpilePackages: ["@branch/database", "@branch/shared"],
  outputFileTracingRoot: repoRoot,
  turbopack: {
    root: repoRoot,
    // That tracing warning, handled by outputFileTracingExcludes above; scoped to the one file and
    // the one warning, so any other still shows.
    ignoreIssue: [
      { path: "**/modules/profile/photo-storage.ts", title: /Dynamic filesystem access/ },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
