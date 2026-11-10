import "server-only";
import { prisma, type Difficulty } from "@branch/database";
import { dateInTimeZone } from "@branch/shared/calendar";
import { getPractice } from "@/modules/review/practice";
import { REVIEW_OUTCOMES, type ReviewOutcome } from "@/modules/review/schedule";
import { fillWeeks, lastWeeks, WEEKS_SHOWN } from "./weeks";

// Personal statistics (owner decision, 2026-11-09): private, derived on every read, nothing
// stored. Every query is the viewer's own rows, counted or summed in SQL, so a long history never
// loads row by row. No streaks, no rankings, no comparison with anyone.

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
const REVIEW_DAYS = 30;
const SESSIONS_SHOWN = 20;

/** "2026-11-09" from Postgres's date type, whichever way the driver returns it. */
const isoDate = (value: Date | string) =>
  typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);

export async function getStats(userId: string, timeZone: string, now = new Date()) {
  const today = dateInTimeZone(now, timeZone);
  const weeks = lastWeeks(today);
  const firstWeek = weeks[0]!;
  const reviewsSince = new Date(now.getTime() - REVIEW_DAYS * 24 * 60 * 60 * 1000);

  const [byDifficulty, solvesByWeek, reviews, studyByWeek, times, sessions, practice] =
    await Promise.all([
      prisma.$queryRaw<{ difficulty: Difficulty; count: bigint }[]>`
        SELECT p."difficulty", count(*) AS "count"
        FROM "problem_completion" c JOIN "problem" p ON p."id" = c."problemId"
        WHERE c."userId" = ${userId}
        GROUP BY p."difficulty"`,
      prisma.$queryRaw<{ week: Date | string; count: bigint }[]>`
        SELECT date_trunc('week', (c."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date AS "week",
               count(*) AS "count"
        FROM "problem_completion" c
        WHERE c."userId" = ${userId}
          AND ((c."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date >= ${firstWeek}::date
        GROUP BY 1`,
      prisma.reviewAttempt.groupBy({
        by: ["outcome"],
        where: { userId, reviewedAt: { gte: reviewsSince } },
        _count: { _all: true },
      }),
      prisma.$queryRaw<{ week: Date | string; seconds: number }[]>`
        SELECT date_trunc('week', (s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date AS "week",
               sum(extract(epoch FROM s."endedAt" - s."startedAt"))::float8 AS "seconds"
        FROM "study_session" s
        WHERE s."userId" = ${userId} AND s."endedAt" IS NOT NULL
          AND ((s."startedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone})::date >= ${firstWeek}::date
        GROUP BY 1`,
      prisma.$queryRaw<{ difficulty: Difficulty; median: number; count: bigint }[]>`
        SELECT p."difficulty",
               percentile_cont(0.5) WITHIN GROUP (ORDER BY s."timeSpentSeconds")::float8 AS "median",
               count(*) AS "count"
        FROM "submission" s JOIN "problem" p ON p."id" = s."problemId"
        WHERE s."userId" = ${userId} AND s."timeSpentSeconds" IS NOT NULL
        GROUP BY p."difficulty"`,
      prisma.studySession.findMany({
        where: { userId, endedAt: { not: null } },
        orderBy: { startedAt: "desc" },
        take: SESSIONS_SHOWN,
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          autoStopped: true,
          _count: { select: { posts: true } },
        },
      }),
      getPractice(userId, now),
    ]);

  const solved = new Map(byDifficulty.map((row) => [row.difficulty, Number(row.count)]));
  const reviewCount = new Map(reviews.map((row) => [row.outcome, row._count._all]));
  const timeBy = new Map(times.map((row) => [row.difficulty, row]));

  return {
    today,
    solved: {
      total: [...solved.values()].reduce((a, b) => a + b, 0),
      byDifficulty: DIFFICULTIES.map((difficulty) => ({
        difficulty,
        count: solved.get(difficulty) ?? 0,
      })),
      byWeek: fillWeeks(
        weeks,
        solvesByWeek.map((row) => ({ week: isoDate(row.week), value: Number(row.count) })),
      ),
    },
    topics: practice.standings.filter((standing) => standing.solved > 0 || standing.reviews > 0),
    reviews: {
      days: REVIEW_DAYS,
      total: [...reviewCount.values()].reduce((a, b) => a + b, 0),
      byOutcome: REVIEW_OUTCOMES.map((outcome: ReviewOutcome) => ({
        outcome,
        count: reviewCount.get(outcome) ?? 0,
      })),
    },
    study: {
      /** Minutes per week. */
      byWeek: fillWeeks(
        weeks,
        studyByWeek.map((row) => ({
          week: isoDate(row.week),
          value: Math.floor(row.seconds / 60),
        })),
      ),
      sessions: sessions.map(({ _count, ...session }) => ({
        ...session,
        endedAt: session.endedAt!,
        shared: _count.posts,
      })),
      sessionsShown: SESSIONS_SHOWN,
    },
    times: DIFFICULTIES.flatMap((difficulty) => {
      const row = timeBy.get(difficulty);
      return row ? [{ difficulty, medianSeconds: row.median, count: Number(row.count) }] : [];
    }),
    weeksShown: WEEKS_SHOWN,
  };
}

export type Stats = Awaited<ReturnType<typeof getStats>>;
