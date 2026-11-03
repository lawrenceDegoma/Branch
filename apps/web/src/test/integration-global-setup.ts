import { execFileSync } from "node:child_process";
import path from "node:path";

// Brings the test database schema up to date once per run.
export default function setup() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: path.resolve(import.meta.dirname, "../../../../packages/database"),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
}
