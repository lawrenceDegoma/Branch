import "server-only";
import { prisma } from "@branch/database";
import { DomainError, NotFoundError } from "@/lib/errors";
import { announceResolve } from "@/modules/feed/automatic";
import { setCompletion } from "@/modules/progress/service";
import { pastedSolutionSchema, submissionIdSchema, type SubmissionPayload } from "./schemas";

// Submissions the extension synced. Private to their author. A submission counts as a completion
// once its problem is in Branch's catalog; until then it waits, and a waiting submission is
// deleted 30 days after it arrived (owner decision). Completions never depend on a submission
// staying: deleting one leaves the problem solved.

const SUBMISSIONS_PER_MINUTE = 20;
export const WAITING_DAYS = 30;
const PAGE_SIZE = 25;
/** How far ahead of the server clock LeetCode's timestamp may be (clock skew). */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

const DAY_MS = 24 * 60 * 60 * 1000;
const waitingCutoff = (now: Date) => new Date(now.getTime() - WAITING_DAYS * DAY_MS);

/** When a waiting submission received at `receivedAt` is deleted. */
export const waitingExpiresAt = (receivedAt: Date) =>
  new Date(receivedAt.getTime() + WAITING_DAYS * DAY_MS);

export type IngestResult = { stored: "new" | "duplicate"; counted: boolean };

/**
 * Stores an accepted submission once (keyed by its site and the site's ID for it, so retries and
 * repeats are no-ops) and, when its problem is in the catalog, marks the problem solved. Marking solved is
 * idempotent too, and runs for duplicates as well, so a retry repairs a half-finished first try.
 */
export async function ingestSubmission(
  userId: string,
  payload: SubmissionPayload,
  now = new Date(),
): Promise<IngestResult> {
  const submittedAt = new Date(payload.submittedAt * 1000);
  if (submittedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new DomainError("INVALID_TIMESTAMP", "The submission time is in the future.");
  }
  const recent = await prisma.submission.count({
    where: { userId, receivedAt: { gt: new Date(now.getTime() - 60_000) } },
  });
  if (recent >= SUBMISSIONS_PER_MINUTE) {
    throw new DomainError("RATE_LIMITED", "Too many submissions at once. Try again in a minute.");
  }
  const problem = await prisma.problem.findUnique({
    where: { leetcodeSlug: payload.problemSlug },
    select: { id: true },
  });
  const { count } = await prisma.submission.createMany({
    data: [
      {
        userId,
        source: payload.source,
        externalId: payload.submissionId,
        problemSlug: payload.problemSlug,
        problemId: problem?.id ?? null,
        language: payload.language,
        code: payload.code,
        submittedAt,
        receivedAt: now,
      },
    ],
    skipDuplicates: true,
  });
  if (problem) {
    const { changed } = await setCompletion(userId, problem.id, true, now, {
      source: "EXTENSION",
      language: payload.language,
    });
    // Already solved, and this is a new accepted submission: a re-solve.
    if (!changed && count > 0) {
      await prisma.$transaction((tx) => announceResolve(tx, userId, problem.id, now));
    }
  }
  return { stored: count > 0 ? "new" : "duplicate", counted: problem !== null };
}

/**
 * Matches waiting submissions whose problem has since been added to the catalog, and counts
 * them. Scoped to one person or one slug, or everyone (the daily job). Safe to run repeatedly.
 */
export async function matchWaitingSubmissions(
  scope: { userId?: string; slug?: string } = {},
  now = new Date(),
): Promise<number> {
  const waiting = await prisma.submission.findMany({
    where: {
      problemId: null,
      receivedAt: { gte: waitingCutoff(now) },
      ...(scope.userId ? { userId: scope.userId } : {}),
      ...(scope.slug ? { problemSlug: scope.slug } : {}),
    },
    select: { id: true, userId: true, problemSlug: true, language: true },
    take: 1000,
  });
  if (waiting.length === 0) return 0;
  const problems = await prisma.problem.findMany({
    where: { leetcodeSlug: { in: [...new Set(waiting.map((s) => s.problemSlug))] } },
    select: { id: true, leetcodeSlug: true },
  });
  const idBySlug = new Map(problems.map((p) => [p.leetcodeSlug, p.id]));
  let matched = 0;
  for (const submission of waiting) {
    const problemId = idBySlug.get(submission.problemSlug);
    if (!problemId) continue;
    const { count } = await prisma.submission.updateMany({
      where: { id: submission.id, problemId: null },
      data: { problemId },
    });
    if (count === 0) continue;
    await setCompletion(submission.userId, problemId, true, now, {
      source: "EXTENSION",
      language: submission.language,
    });
    matched++;
  }
  return matched;
}

/** Deletes waiting submissions older than 30 days. Idempotent; the daily job runs it. */
export async function purgeExpiredSubmissions(now = new Date()): Promise<number> {
  const { count } = await prisma.submission.deleteMany({
    where: { problemId: null, receivedAt: { lt: waitingCutoff(now) } },
  });
  return count;
}

/** The viewer's own submissions, newest first, paged by ID. Expired waiting ones never show. */
export async function listSubmissions(
  userId: string,
  options: { before?: string; limit?: number } = {},
  now = new Date(),
) {
  const limit = options.limit ?? PAGE_SIZE;
  const rows = await prisma.submission.findMany({
    where: {
      userId,
      OR: [{ problemId: { not: null } }, { receivedAt: { gte: waitingCutoff(now) } }],
      ...(options.before ? { id: { lt: options.before } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit + 1,
    select: {
      id: true,
      source: true,
      problemSlug: true,
      language: true,
      code: true,
      submittedAt: true,
      receivedAt: true,
      problem: { select: { title: true, difficulty: true } },
      analysis: {
        select: {
          status: true,
          result: {
            select: {
              outcome: true,
              time: true,
              space: true,
              confidence: true,
              reasons: true,
              limitations: true,
              notation: true,
              bound: true,
              message: true,
            },
          },
        },
      },
    },
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((row) => ({
      ...row,
      waitingUntil: row.problem ? null : waitingExpiresAt(row.receivedAt),
    })),
    nextCursor: rows.length > limit ? page.at(-1)!.id : null,
  };
}
export type SubmissionItem = Awaited<ReturnType<typeof listSubmissions>>["items"][number];

/**
 * Saves a solution the person pastes for a problem they've solved, so it can be analyzed. It
 * doesn't change whether the problem counts as solved. Shares the extension's rate limit.
 */
export async function pasteSolution(userId: string, input: unknown, now = new Date()) {
  const parsed = pastedSolutionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new DomainError("INVALID", issue.message, String(issue.path[0] ?? "code"));
  }
  const { problemId, language, code } = parsed.data;
  const completion = await prisma.problemCompletion.findUnique({
    where: { userId_problemId: { userId, problemId } },
    select: { problem: { select: { leetcodeSlug: true } } },
  });
  if (!completion) {
    throw new DomainError("NOT_SOLVED", "Choose a problem you've solved.", "problemId");
  }
  const recent = await prisma.submission.count({
    where: { userId, receivedAt: { gt: new Date(now.getTime() - 60_000) } },
  });
  if (recent >= SUBMISSIONS_PER_MINUTE) {
    throw new DomainError("RATE_LIMITED", "Too many solutions at once. Try again in a minute.");
  }
  return prisma.submission.create({
    data: {
      userId,
      source: "PASTED",
      externalId: null,
      problemSlug: completion.problem.leetcodeSlug,
      problemId,
      language,
      code,
      submittedAt: now,
      receivedAt: now,
    },
    select: { id: true },
  });
}

/** Problems the person has solved, for choosing which one a pasted solution is for. */
export async function listSolvedProblems(userId: string) {
  const rows = await prisma.problemCompletion.findMany({
    where: { userId },
    select: { problem: { select: { id: true, title: true } } },
    orderBy: { problem: { title: "asc" } },
  });
  return rows.map((row) => row.problem);
}

/** Deletes one of the viewer's submissions and its code. The completion, if any, stays. */
export async function deleteSubmission(userId: string, submissionId: string) {
  if (!submissionIdSchema.safeParse(submissionId).success) throw submissionNotFound();
  const { count } = await prisma.submission.deleteMany({ where: { id: submissionId, userId } });
  if (count === 0) throw submissionNotFound();
}

export async function deleteAllSubmissions(userId: string) {
  const { count } = await prisma.submission.deleteMany({ where: { userId } });
  return count;
}

const submissionNotFound = () => new NotFoundError("We couldn't find that submission.");
