import "server-only";
import { prisma } from "@branch/database";
import { DomainError } from "./errors";

// One rate limiter for writes whose own rows can't be counted (a reaction toggled off leaves no
// row; a repeated solve is idempotent). Fixed windows: one row per key and window, incremented
// atomically in Postgres, so it holds across serverless instances. Older windows go with the
// daily job. Writes that leave rows (posts, comments, invites, reports, submissions) count those
// rows instead, as before.

export type Limit = { key: string; limit: number; windowSeconds: number; message: string };

/** The start of the fixed window `at` falls in. */
export function windowStart(at: Date, windowSeconds: number): Date {
  const size = windowSeconds * 1000;
  return new Date(Math.floor(at.getTime() / size) * size);
}

/** Counts one use of `key`; throws RATE_LIMITED once the window's limit is passed. */
export async function takeToken(
  { key, limit, windowSeconds, message }: Limit,
  now = new Date(),
): Promise<void> {
  const start = windowStart(now, windowSeconds);
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_bucket" ("key", "windowStart", "count")
    VALUES (${key}, ${start}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "rate_limit_bucket"."count" + 1
    RETURNING "count"`;
  if ((row?.count ?? 0) > limit) throw new DomainError("RATE_LIMITED", message);
}

/** Deletes windows that ended more than a day ago. Idempotent; the daily job runs it. */
export async function purgeRateLimits(now = new Date()): Promise<number> {
  const { count } = await prisma.rateLimitBucket.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
  });
  return count;
}
