import { execFileSync } from "node:child_process";
import path from "node:path";

// Migrates and empties the test database once before the run.
export default async function globalSetup() {
  if (!process.env.DATABASE_URL?.includes("_test")) {
    throw new Error("E2E tests must run against a database whose name ends in _test.");
  }
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd: path.resolve(import.meta.dirname, "../../../../packages/database"),
    env: process.env,
    stdio: "pipe",
  });
  const { prisma } = await import("@branch/database");
  const { resetTestDatabase } = await import("@branch/database/testing");
  await resetTestDatabase(prisma);
  await prisma.$disconnect();
}
