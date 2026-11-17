import { readFileSync } from "node:fs";
import path from "node:path";
import {
  companyId,
  companyListSchema,
  schoolAliasesSchema,
  schoolId,
  schoolListSchema,
  type CompanyList,
  type SchoolAliases,
  type SchoolList,
} from "@branch/shared/organizations";
import type { PrismaClient } from "./generated/prisma/client";

const listDir = path.join(import.meta.dirname, "../prisma/data/organizations");
const readJson = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(listDir, file), "utf8"));

/** The three list files, validated. Read by the loader, the seed, and the E2E setup. */
export function readOrganizationLists() {
  return {
    schools: schoolListSchema.parse(readJson("schools.json")),
    aliases: schoolAliasesSchema.parse(readJson("school-aliases.json")),
    companies: companyListSchema.parse(readJson("companies.json")),
  };
}

type Row = { id: string; name: string; country: string | null; aliases: string[] };

// Ten thousand schools in one round trip per thousand, so loading is quick against Neon too.
const CHUNK = 1000;

/**
 * Upserts every school and company by ID. Idempotent, and never deletes: a profile may point at
 * an organization a later list dropped, and the ID stays valid. Returns how many rows changed.
 */
export async function syncOrganizations(
  prisma: PrismaClient,
  lists: { schools: SchoolList; aliases: SchoolAliases; companies: CompanyList },
): Promise<{ schools: number; companies: number; changed: number }> {
  const known = new Set(lists.schools.schools.map(([domain]) => domain));
  const unknown = Object.keys(lists.aliases).filter((domain) => !known.has(domain));
  if (unknown.length > 0) {
    throw new Error(`Aliases name schools that aren't in the list: ${unknown.join(", ")}`);
  }

  const schools: Row[] = lists.schools.schools.map(([domain, name, country]) => ({
    id: schoolId(domain),
    name,
    country,
    aliases: lists.aliases[domain] ?? [],
  }));
  const companies: Row[] = lists.companies.map((c) => ({
    id: companyId(c.slug),
    name: c.name,
    country: null,
    aliases: c.aliases,
  }));

  let changed = 0;
  for (const [kind, rows] of [
    ["SCHOOL", schools],
    ["COMPANY", companies],
  ] as const) {
    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk = rows.slice(start, start + CHUNK);
      // Aliases travel as JSON text: unnest() would flatten a two-dimensional array.
      changed += await prisma.$executeRaw`
        INSERT INTO "organization" ("id", "kind", "name", "country", "aliases", "updatedAt")
        SELECT r."id", ${kind}::"OrganizationKind", r."name", r."country",
               ARRAY(SELECT jsonb_array_elements_text(r."aliases"::jsonb)), now()
        FROM unnest(
          ${chunk.map((r) => r.id)}::text[],
          ${chunk.map((r) => r.name)}::text[],
          ${chunk.map((r) => r.country)}::text[],
          ${chunk.map((r) => JSON.stringify(r.aliases))}::text[]
        ) AS r("id", "name", "country", "aliases")
        ON CONFLICT ("id") DO UPDATE
          SET "name" = EXCLUDED."name", "country" = EXCLUDED."country",
              "aliases" = EXCLUDED."aliases", "updatedAt" = now()
          WHERE ("organization"."name", "organization"."country", "organization"."aliases")
                IS DISTINCT FROM (EXCLUDED."name", EXCLUDED."country", EXCLUDED."aliases")`;
    }
  }
  return { schools: schools.length, companies: companies.length, changed };
}
