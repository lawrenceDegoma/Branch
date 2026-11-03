import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(import.meta.dirname, "../../../../packages/database/prisma/data");
const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(dataDir, file), "utf8"));

// Migrates and empties the test database once before the run, then loads the seed catalog and
// the sample curated roadmap (no accounts).
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
  const { importCuratedRoadmap, syncCatalog } = await import("@branch/database/catalog-import");
  const { catalogSchema, roadmapDefinitionSchema } = await import("@branch/shared/catalog");
  await syncCatalog(prisma, catalogSchema.parse(readJson("catalog.json")), "SEED");
  await importCuratedRoadmap(
    prisma,
    roadmapDefinitionSchema.parse(readJson("roadmaps/starter-sample.json")),
  );
  await prisma.$disconnect();
}
