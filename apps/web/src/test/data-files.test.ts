// Every catalog, roadmap, and organization file in the repository must satisfy the shared
// contracts, and every roadmap must reference only problems its catalog defines.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { catalogSchema, roadmapDefinitionSchema, type Catalog } from "@branch/shared/catalog";
import {
  companyListSchema,
  organizationKind,
  schoolAliasesSchema,
  schoolListSchema,
} from "@branch/shared/organizations";
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

describe("catalog and roadmaps", () => {
  const catalog = catalogSchema.parse(readJson(path.join(dataDir, "catalog.json")));
  const roadmap = (file: string) =>
    roadmapDefinitionSchema.parse(readJson(path.join(dataDir, "roadmaps", file)));

  it("are valid and self-consistent", () => {
    checkRoadmaps(catalog, path.join(dataDir, "roadmaps"));
  });

  it("include the curated lists at their expected sizes, citing their pinned source", () => {
    const patterns = roadmap("patterns-150.json");
    const essentials = roadmap("essentials-75.json");
    expect(patterns.sections.flatMap((s) => s.problems)).toHaveLength(150);
    expect(essentials.sections.flatMap((s) => s.problems)).toHaveLength(75);
    // Essentials 75's description says every problem is also in Patterns 150.
    const inPatterns = new Set(patterns.sections.flatMap((s) => s.problems));
    expect(
      essentials.sections.flatMap((s) => s.problems).filter((p) => !inPatterns.has(p)),
    ).toEqual([]);
    for (const list of [patterns, essentials]) {
      expect(list.sourceUrl).toMatch(
        /^https:\/\/github\.com\/neetcode-gh\/leetcode\/blob\/[0-9a-f]{40}\//,
      );
    }
  });

  it("don't use other parties' list names", () => {
    for (const file of readdirSync(path.join(dataDir, "roadmaps"))) {
      const { title, description = "" } = roadmap(file);
      expect(`${title} ${description}`).not.toMatch(/neetcode|blind|grind/i);
    }
  });

  it("mark Premium problems and give each a free alternative", () => {
    const premium = catalog.problems.filter((p) => p.premium);
    expect(premium.map((p) => p.slug).sort()).toEqual([
      "alien-dictionary",
      "encode-and-decode-strings",
      "graph-valid-tree",
      "meeting-rooms",
      "meeting-rooms-ii",
      "number-of-connected-components-in-an-undirected-graph",
      "walls-and-gates",
    ]);
    for (const problem of premium)
      expect(problem.freeUrl).toMatch(/^https:\/\/www\.lintcode\.com\//);
  });
});

describe("school and company lists", () => {
  const dir = path.join(dataDir, "organizations");
  const schools = schoolListSchema.parse(readJson(path.join(dir, "schools.json")));
  const aliases = schoolAliasesSchema.parse(readJson(path.join(dir, "school-aliases.json")));
  const companies = companyListSchema.parse(readJson(path.join(dir, "companies.json")));

  it("are valid, cite their pinned source, and alias only listed schools", () => {
    expect(schools.schools.length).toBeGreaterThan(10_000);
    expect(schools.source.url).toBe("https://github.com/Hipo/university-domains-list");
    const domains = new Set(schools.schools.map(([domain]) => domain));
    expect(Object.keys(aliases).filter((domain) => !domains.has(domain))).toEqual([]);
    expect(companies.length).toBeGreaterThan(100);
  });

  it("make every ID a valid organization ID of its kind", () => {
    for (const [domain] of schools.schools) {
      expect(organizationKind(`school:${domain}`), domain).toBe("SCHOOL");
    }
    for (const { slug } of companies)
      expect(organizationKind(`company:${slug}`), slug).toBe("COMPANY");
  });

  it("keep the corrected names and the schools people asked about", () => {
    const name = (domain: string) => schools.schools.find(([d]) => d === domain)?.[1];
    expect(name("csulb.edu")).toBe("California State University, Long Beach");
    expect(name("fullerton.edu")).toBe("California State University, Fullerton");
    expect(name("stanford.edu")).toBe("Stanford University");
    expect(name("csueastbay.edu")).toBe("California State University, East Bay");
  });
});
