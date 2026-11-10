// Keeps the client JavaScript of the main pages from growing unnoticed. Runs after `next build`
// (postbuild): the shared chunks every page loads (build-manifest rootMainFiles) and all static
// chunks together, against budgets set a little above the measured sizes. Raise a budget on
// purpose, in the same commit as the feature that needs it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const next = path.join(root, ".next");
const BUDGET_KB = { shared: 480, total: 1400 };

const manifest = JSON.parse(readFileSync(path.join(next, "build-manifest.json"), "utf8"));
const kb = (bytes) => Math.round(bytes / 1024);
const shared = manifest.rootMainFiles.reduce(
  (sum, file) => sum + statSync(path.join(next, file)).size,
  0,
);
const chunks = path.join(next, "static", "chunks");
const total = readdirSync(chunks)
  .filter((f) => f.endsWith(".js"))
  .reduce((sum, f) => sum + statSync(path.join(chunks, f)).size, 0);

const rows = [
  ["shared JavaScript on every page", kb(shared), BUDGET_KB.shared],
  ["all client chunks", kb(total), BUDGET_KB.total],
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
