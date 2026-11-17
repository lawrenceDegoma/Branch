import "server-only";
import { Prisma, prisma, type OrganizationKind } from "@branch/database";
import { MIN_MEMBERS, rankRows, type RankingRow } from "./standing";

// Rankings (owner decisions, 2026-11-17): schools and companies by the problems their members
// solved this month, with a per-member average. Each person's solves count in their own time
// zone's month. The rules (at least 5 members, ties) are in standing.ts. Derived on every read,
// never stored.

// Fixed column names, never from input.
const COLUMN = { SCHOOL: Prisma.raw(`"schoolId"`), COMPANY: Prisma.raw(`"companyId"`) };

/** Every organization of the kind with at least 5 members, ranked by solves this month. */
export async function getRankings(kind: OrganizationKind, now = new Date()): Promise<RankingRow[]> {
  const column = COLUMN[kind];
  const rows = await prisma.$queryRaw<
    { id: string; name: string; members: number; solved: number }[]
  >`
    SELECT o."id", o."name", m."members", m."solved"
    FROM (
      SELECT p.${column} AS "organizationId", count(*)::int AS "members",
             coalesce(sum(s."solved"), 0)::int AS "solved"
      FROM "profile" p
      CROSS JOIN LATERAL (
        SELECT count(*) AS "solved"
        FROM "problem_completion" c
        WHERE c."userId" = p."userId"
          AND date_trunc('month', (c."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE p."timezone")
            = date_trunc('month', ${now.toISOString()}::timestamptz AT TIME ZONE p."timezone")
      ) s
      WHERE p.${column} IS NOT NULL
      GROUP BY 1
      HAVING count(*) >= ${MIN_MEMBERS}
    ) m
    JOIN "organization" o ON o."id" = m."organizationId"
    ORDER BY m."solved" DESC, o."name" ASC`;
  return rankRows(rows);
}
