// Imports a problem catalog and curated roadmap definitions. Safe in any environment: it creates
// no accounts and is idempotent (changed roadmap content becomes a new published version).
//
//   pnpm db:import-curated -- --catalog <catalog.json> <roadmap.json>... [--allow-draft]
//
// Files under curated-drafts/ are refused without --allow-draft, so drafts are never imported by
// accident.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { catalogSchema, roadmapDefinitionSchema } from "@branch/shared/catalog";
import { importCuratedRoadmap, syncCatalog } from "../src/catalog-import";
import { createPrismaClient } from "../src/index";

// `pnpm <script> -- <args>` forwards the "--" separator; drop it so the flags are parsed.
const argv = process.argv.slice(2);
const { values, positionals } = parseArgs({
  args: argv[0] === "--" ? argv.slice(1) : argv,
  allowPositionals: true,
  options: { catalog: { type: "string" }, "allow-draft": { type: "boolean", default: false } },
});

const files = [values.catalog, ...positionals].filter((f): f is string => Boolean(f));
if (files.length === 0) {
  console.error(
    "Usage: pnpm db:import-curated -- --catalog <catalog.json> <roadmap.json>... [--allow-draft]",
  );
  process.exit(1);
}
if (
  !values["allow-draft"] &&
  files.some((f) => path.resolve(f).includes(`${path.sep}curated-drafts${path.sep}`))
) {
  console.error(
    "Refusing to import files from curated-drafts/ without --allow-draft (they need owner review).",
  );
  process.exit(1);
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));

async function main() {
  const prisma = createPrismaClient();
  try {
    if (values.catalog) {
      const catalog = catalogSchema.parse(readJson(values.catalog));
      const synced = await syncCatalog(prisma, catalog, "CURATED");
      console.log(`Catalog: ${synced.problems} problems, ${synced.tags} tags`);
    }
    for (const file of positionals) {
      const definition = roadmapDefinitionSchema.parse(readJson(file));
      const result = await importCuratedRoadmap(prisma, definition);
      console.log(
        `Roadmap ${definition.slug}: version ${result.versionNumber}${result.created ? " (new)" : " (unchanged)"}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
