// Everything to verify before pushing a release, in one command: `pnpm release:check`.
//
//   1. Node matches .nvmrc (production runs what the tests ran).
//   2. pnpm check: typecheck, lint, format, unit, analyzer, and integration tests.
//   3. pnpm build: the production build and the client JavaScript budget.
//   4. The browser suite against a production build (E2E_SERVER=start), strict CSP included.
//   5. With PROD_DIRECT_URL set: which migrations production doesn't have yet (read-only; apply
//      them with `DATABASE_URL="$PROD_DIRECT_URL" pnpm db:deploy` before pushing).
//
// Needs the local database (`pnpm db:up`). Stops at the first failure. The manual items it can't
// check are printed at the end (docs/DEPLOY.md, "Before a release").
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function step(title, command, args, options = {}) {
  console.log(`\n=== ${title} ===`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", ...options });
  if (result.status !== 0) {
    console.error(`\n✘ ${title} failed. Nothing after it ran.`);
    process.exit(result.status ?? 1);
  }
  console.log(`✔ ${title}`);
}

// 1. Node.
const wanted = readFileSync(path.join(root, ".nvmrc"), "utf8").trim();
const running = process.versions.node.split(".")[0];
console.log(`=== Node ===\nRunning ${process.version}; .nvmrc says ${wanted}.`);
if (running !== wanted) {
  console.error(`✘ Run \`nvm use\` first: the release must be checked on Node ${wanted}.`);
  process.exit(1);
}
console.log("✔ Node");

const dirty = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).stdout;
if (dirty.trim()) {
  console.warn("\n! Uncommitted changes: this checks the working tree, not what you'll push.");
}

// 2–4.
step("pnpm check", "pnpm", ["check"]);
step("Production build and JavaScript budget", "pnpm", ["build"]);
step("Browser tests against a production build", "pnpm", ["test:e2e"], {
  env: { ...process.env, E2E_SERVER: "start" },
});

// 5. Production migrations, read-only.
console.log("\n=== Production migrations ===");
if (!process.env.PROD_DIRECT_URL) {
  console.log("Skipped: set PROD_DIRECT_URL (Neon's direct string) to compare with production.");
} else {
  const status = spawnSync("pnpm", ["exec", "prisma", "migrate", "status"], {
    cwd: path.join(root, "packages/database"),
    env: { ...process.env, DATABASE_URL: process.env.PROD_DIRECT_URL },
    encoding: "utf8",
  });
  const output = `${status.stdout}\n${status.stderr}`;
  if (/up to date/i.test(output)) {
    console.log("✔ Production has every migration.");
  } else if (/not yet been applied/i.test(output)) {
    const pending = output
      .split("\n")
      .filter((line) => /^\d{14}_/.test(line.trim()))
      .map((line) => `  ${line.trim()}`);
    console.log(`! Production is missing these migrations:\n${pending.join("\n")}`);
    console.log('  Apply them before pushing: DATABASE_URL="$PROD_DIRECT_URL" pnpm db:deploy');
  } else {
    console.error(`✘ Couldn't read production's migration status:\n${output.trim()}`);
    process.exit(1);
  }
}

console.log(`
=== Checked by hand (docs/DEPLOY.md, "Before a release") ===
- Vercel: Node.js version 26.x; CRON_SECRET set; never AUTH_RATE_LIMIT_OFF or PASSWORD_SIGN_UP.
- Google consent screen published (offline access lasts 7 days while it's in Testing).
- A pg_dump backup before a migration that changes or deletes data.
- An extension change: bump apps/extension's version and follow docs/CHROME-WEB-STORE.md.

✔ Release checks passed.`);
