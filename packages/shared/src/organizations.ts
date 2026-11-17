import { z } from "zod";

// Contracts for the school and company lists (M32). Used by the list builder and loader, the
// data-file tests, and the web app. An organization's ID is permanent: `school:<web domain>` or
// `company:<slug>`, so the kind can be checked from the ID alone (a CHECK in the database too).

export type OrganizationKind = "SCHOOL" | "COMPANY";

const domainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const schoolDomainSchema = z.string().max(120).regex(domainPattern);
const nameSchema = z.string().trim().min(1).max(200);
const aliasSchema = z.string().trim().min(2).max(60);
const countrySchema = z.string().regex(/^[A-Z]{2}$/, "Use an ISO 3166 two-letter code.");

export const schoolId = (domain: string) => `school:${domain}`;
export const companyId = (slug: string) => `company:${slug}`;

/** The kind an ID belongs to, or null for anything that isn't an organization ID. */
export function organizationKind(id: string): OrganizationKind | null {
  const [prefix, key = ""] = id.split(/:(.*)/s, 2);
  if (prefix === "school" && domainPattern.test(key) && key.length <= 120) return "SCHOOL";
  if (prefix === "company" && slugPattern.test(key) && key.length <= 60) return "COMPANY";
  return null;
}

function noDuplicates<T>(items: T[], key: (item: T) => string, ctx: z.RefinementCtx, what: string) {
  const seen = new Set<string>();
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) ctx.addIssue({ code: "custom", message: `Duplicate ${what} "${k}"` });
    seen.add(k);
  }
}

/** `schools.json`: built from Hipo's list by `build-schools.ts`; one row per web domain. */
export const schoolListSchema = z
  .object({
    source: z.object({ url: z.url({ protocol: /^https$/ }), commit: z.string().length(40) }),
    schools: z.array(z.tuple([schoolDomainSchema, nameSchema, countrySchema])),
  })
  .superRefine((list, ctx) => noDuplicates(list.schools, ([domain]) => domain, ctx, "school"));
export type SchoolList = z.infer<typeof schoolListSchema>;

/** `school-aliases.json`: abbreviations people search for, by the school's domain. */
export const schoolAliasesSchema = z.record(schoolDomainSchema, z.array(aliasSchema).min(1));
export type SchoolAliases = z.infer<typeof schoolAliasesSchema>;

/** `companies.json`: the fixed list of companies (owner decision: big names only). */
export const companyListSchema = z
  .array(
    z.object({
      slug: z.string().max(60).regex(slugPattern),
      name: nameSchema,
      aliases: z.array(aliasSchema).default([]),
    }),
  )
  .superRefine((list, ctx) => {
    noDuplicates(list, (c) => c.slug, ctx, "company");
    noDuplicates(list, (c) => c.name.toLowerCase(), ctx, "company name");
  });
export type CompanyList = z.infer<typeof companyListSchema>;
