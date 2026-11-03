// Every catalog and roadmap file in the repository must satisfy the shared contracts, and every
// roadmap must reference only problems its catalog defines.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { catalogSchema, roadmapDefinitionSchema, type Catalog } from "@branch/shared/catalog";
import { describe, expect, it } from "vitest";

const dataDir = path.resolve(import.meta.dirname, "../../../../packages/database/prisma/data");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));

function checkRoadmaps(catalog: Catalog, dir: string, exclude: string[] = []) {
  const known = new Set(catalog.problems.map((p) => p.slug));
  const files = readdirSync(dir).filter((f) => f.endsWith(".json") && !exclude.includes(f));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const roadmap = roadmapDefinitionSchema.parse(readJson(path.join(dir, file)));
    const missing = roadmap.sections.flatMap((s) => s.problems).filter((slug) => !known.has(slug));
    expect(missing, `${file} references problems missing from its catalog`).toEqual([]);
  }
}

describe("seed data", () => {
  it("is valid and self-consistent", () => {
    const catalog = catalogSchema.parse(readJson(path.join(dataDir, "catalog.json")));
    checkRoadmaps(catalog, path.join(dataDir, "roadmaps"));
  });
});

describe("curated drafts", () => {
  const dir = path.join(dataDir, "curated-drafts");
  const catalog = catalogSchema.parse(readJson(path.join(dir, "catalog.json")));

  it("are valid and self-consistent", () => {
    checkRoadmaps(catalog, dir, ["catalog.json"]);
  });

  it("have the expected sizes and cite their source", () => {
    const nc150 = roadmapDefinitionSchema.parse(readJson(path.join(dir, "neetcode-150.json")));
    const blind75 = roadmapDefinitionSchema.parse(readJson(path.join(dir, "blind-75.json")));
    expect(nc150.sections.flatMap((s) => s.problems)).toHaveLength(150);
    expect(blind75.sections.flatMap((s) => s.problems)).toHaveLength(75);
    for (const roadmap of [nc150, blind75]) {
      expect(roadmap.sourceUrl).toMatch(
        /^https:\/\/github\.com\/neetcode-gh\/leetcode\/blob\/[0-9a-f]{40}\//,
      );
    }
  });
});
