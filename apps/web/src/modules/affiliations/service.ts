import "server-only";
import { Prisma, prisma, type OrganizationKind } from "@branch/database";
import { DomainError } from "@/lib/errors";
import { takeToken } from "@/lib/limits";
import { organizationOption, searchTerms, type OrganizationOption } from "./organizations";
import type { AffiliationInput } from "./schemas";

// Schools and companies (M32, owner decisions 2026-11-17). A person's choice is private: it
// counts them toward that organization's totals on Rankings without their name, and their groups
// see it only with `showAffiliation` on. Removing it deletes it.

const RESULTS = 20;
const CHANGES_PER_DAY = 10;

/**
 * Up to 20 schools or companies matching every word of the query, in the name, an alias, or the
 * start of the school's web address. Exact abbreviations and addresses come first, then names
 * that start with the query, then the shortest names.
 */
export async function searchOrganizations(
  kind: OrganizationKind,
  query: string,
): Promise<OrganizationOption[]> {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  const whole = terms.join(" ");
  const matches = terms.map(
    (term) => Prisma.sql`(
      lower(o."name") LIKE '%' || ${term} || '%'
      OR split_part(o."id", ':', 2) LIKE ${term} || '%'
      OR EXISTS (SELECT 1 FROM unnest(o."aliases") a WHERE lower(a) LIKE ${term} || '%')
    )`,
  );
  const rows = await prisma.$queryRaw<
    { id: string; name: string; kind: OrganizationKind; country: string | null }[]
  >`
    SELECT o."id", o."name", o."kind", o."country"
    FROM "organization" o
    WHERE o."kind" = ${kind}::"OrganizationKind" AND ${Prisma.join(matches, " AND ")}
    ORDER BY
      CASE
        WHEN lower(o."name") = ${whole}
          OR EXISTS (SELECT 1 FROM unnest(o."aliases") a WHERE lower(a) = ${whole})
          OR split_part(o."id", ':', 2) = ${whole}
          OR split_part(o."id", ':', 2) LIKE ${whole} || '.%' THEN 0
        WHEN lower(o."name") LIKE ${whole} || '%' THEN 1
        ELSE 2
      END,
      char_length(o."name"), o."name"
    LIMIT ${RESULTS}`;
  return rows.map(organizationOption);
}

/** The viewer's own choices, for Settings. */
export async function getAffiliation(userId: string) {
  const profile = await prisma.profile.findUniqueOrThrow({
    where: { userId },
    select: {
      showAffiliation: true,
      school: { select: { id: true, name: true, kind: true, country: true } },
      company: { select: { id: true, name: true, kind: true, country: true } },
    },
  });
  return {
    school: profile.school ? organizationOption(profile.school) : null,
    company: profile.company ? organizationOption(profile.company) : null,
    showAffiliation: profile.showAffiliation,
  };
}

/**
 * Saves the person's school, company, and whether their groups see them. Changing the school or
 * company is limited to 10 a day, so nobody hops between organizations; the switch alone isn't.
 */
export async function setAffiliation(userId: string, input: AffiliationInput, now = new Date()) {
  const current = await prisma.profile.findUniqueOrThrow({
    where: { userId },
    select: { schoolId: true, companyId: true },
  });
  const ids = [input.schoolId, input.companyId].filter((id): id is string => id !== null);
  const found = new Set(
    (await prisma.organization.findMany({ where: { id: { in: ids } }, select: { id: true } })).map(
      (o) => o.id,
    ),
  );
  if (input.schoolId && !found.has(input.schoolId)) {
    throw new DomainError("UNKNOWN_SCHOOL", "Choose a school from the list.", "schoolId");
  }
  if (input.companyId && !found.has(input.companyId)) {
    throw new DomainError("UNKNOWN_COMPANY", "Choose a company from the list.", "companyId");
  }
  if (current.schoolId !== input.schoolId || current.companyId !== input.companyId) {
    await takeToken(
      {
        key: `affiliation:${userId}`,
        limit: CHANGES_PER_DAY,
        windowSeconds: 24 * 60 * 60,
        message: "You've changed your school or company a lot today. Try again tomorrow.",
      },
      now,
    );
  }
  return prisma.profile.update({
    where: { userId },
    data: {
      schoolId: input.schoolId,
      companyId: input.companyId,
      showAffiliation: input.showAffiliation,
    },
    select: { schoolId: true, companyId: true, showAffiliation: true },
  });
}
