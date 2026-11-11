// Runs the acceptance suite: exactly the browser tests docs/ACCEPTANCE.md maps to a scenario.
// `pnpm test:acceptance` (extra arguments go to Playwright, e.g. --project=desktop).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The `e2e/<file>` › "<title>" entries in the map, without duplicates. */
export function acceptanceTests(markdown) {
  const seen = new Map();
  for (const [, file, title] of markdown.matchAll(/`(e2e\/[\w-]+\.spec\.ts)` › "([^"]+)"/g)) {
    seen.set(`${file}\u0000${title}`, { file, title });
  }
  return [...seen.values()];
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const web = path.resolve(import.meta.dirname, "..");
  const map = readFileSync(path.resolve(web, "../../docs/ACCEPTANCE.md"), "utf8");
  const tests = acceptanceTests(map);
  const files = [...new Set(tests.map((t) => t.file))];
  const grep = tests.map((t) => escape(t.title)).join("|");
  console.log(`Acceptance suite: ${tests.length} tests in ${files.length} files.`);
  const result = spawnSync(
    "pnpm",
    ["exec", "playwright", "test", ...files, "--grep", grep, ...process.argv.slice(2)],
    { cwd: web, stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
