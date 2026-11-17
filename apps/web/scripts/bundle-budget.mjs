// Keeps the client JavaScript of the main pages from growing unnoticed, against budgets set a
// little above the measured sizes: the shared chunks every page loads (build-manifest
// rootMainFiles), all static chunks together (without the polyfills, which only very old browsers
// download), and Home as people download it (Brotli-compressed, as Vercel serves it). Raise a budget on purpose, in the same commit as the feature
// that needs it. The repository's `pnpm build` runs it after the app's build. Never hook it into
// the app's own `build` (npm's postbuild): Vercel runs that, lays its output out differently, and
// a measurement must never block a deploy.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const next = path.join(root, ".next");
const BUDGET_KB = { shared: 480, total: 1200, home: 230 };

const chunks = path.join(next, "static", "chunks");
if (!existsSync(path.join(next, "build-manifest.json")) || !existsSync(chunks)) {
  console.error("No local Next build to measure in apps/web/.next. Run `pnpm build` first.");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(path.join(next, "build-manifest.json"), "utf8"));
const kb = (bytes) => Math.round(bytes / 1024);
const shared = manifest.rootMainFiles.reduce(
  (sum, file) => sum + statSync(path.join(next, file)).size,
  0,
);
const polyfills = new Set(manifest.polyfillFiles.map((file) => path.basename(file)));
const total = readdirSync(chunks)
  .filter((f) => f.endsWith(".js") && !polyfills.has(f))
  .reduce((sum, f) => sum + statSync(path.join(chunks, f)).size, 0);

// Home: the shared chunks plus those its client components need (from its client reference
// manifest), compressed as a visitor receives them.
const homeManifest = path.join(next, "server/app/(app)/home/page_client-reference-manifest.js");
if (!existsSync(homeManifest)) {
  console.error("Home's client reference manifest is missing; the build layout has changed.");
  process.exit(1);
}
const homeFiles = new Set([
  ...manifest.rootMainFiles,
  ...(readFileSync(homeManifest, "utf8").match(/static\/chunks\/[\w-]+\.js/g) ?? []),
]);
const home = [...homeFiles].reduce(
  (sum, file) => sum + brotliCompressSync(readFileSync(path.join(next, file))).length,
  0,
);

const rows = [
  ["shared JavaScript on every page (raw)", kb(shared), BUDGET_KB.shared],
  ["all client chunks (raw, without polyfills)", kb(total), BUDGET_KB.total],
  ["Home as downloaded (Brotli)", kb(home), BUDGET_KB.home],
];
let failed = false;
for (const [label, used, budget] of rows) {
  const over = used > budget;
  failed ||= over;
  console.log(`${over ? "OVER " : "ok   "} ${label}: ${used} KB (budget ${budget} KB)`);
}
if (failed) {
  console.error("Client JavaScript is over budget: see apps/web/scripts/bundle-budget.mjs.");
  process.exit(1);
}
