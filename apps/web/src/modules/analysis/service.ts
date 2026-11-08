import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@branch/database";
import { isUniqueViolation } from "@/lib/db-errors";
import { errorContext, logger } from "@/lib/logger";
import {
  AnalyzerUnavailableError,
  configuredAnalyzer,
  type Analyzer,
  type AnalyzerAnswer,
} from "./analyzer";

// Background analysis of solutions. Progress never waits for it: a solution is saved and counted
// first, and its analysis runs afterwards (right after it arrives, and again from the daily job
// for anything missed). Jobs are rows in Postgres, claimed with SKIP LOCKED so overlapping runs
// never analyze the same solution twice. Answers are cached by code, language, problem, and
// analyzer version, so identical code is analyzed once. Bounded: a few attempts per job, a daily
// cap per person, and a batch size per run.

export const MAX_ATTEMPTS = 3;
/** Analyses per person per rolling day; the rest wait for the next run. */
export const DAILY_ANALYSES_PER_USER = 100;
/** A job claimed longer ago than this was abandoned (the run timed out) and is retried. */
const STALE_MS = 10 * 60_000;
/** Solutions given a job per run when they don't have one yet. */
const BACKFILL_BATCH = 200;

/** The code as hashed for the cache: same code, different line endings or trailing spaces. */
export function normalizeCode(code: string): string {
  return code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trimEnd();
}

export const codeHash = (code: string) =>
  createHash("sha256").update(normalizeCode(code)).digest("hex");

export type RunSummary = {
  analyzed: number;
  cached: number;
  failed: number;
  /** Estimates from an older analyzer version, queued to be redone. */
  outdated: number;
  /** The analyzer didn't answer; nothing was claimed, so no attempt was used up. */
  unavailable?: true;
};

/**
 * Gives solutions without one a job, requeues estimates made by an older analyzer version, then
 * claims and runs up to `limit` queued jobs (only the user's, when `userId` is given). Returns null
 * when no analyzer is configured.
 */
export async function runAnalysisJobs({
  analyzer = configuredAnalyzer(),
  limit = 25,
  userId,
  now = new Date(),
}: {
  analyzer?: Analyzer | null;
  limit?: number;
  userId?: string;
  now?: Date;
} = {}): Promise<RunSummary | null> {
  if (!analyzer) return null;
  const summary: RunSummary = { analyzed: 0, cached: 0, failed: 0, outdated: 0 };

  // Asked first: when the analyzer is down, jobs wait without using up their attempts.
  let version: string;
  try {
    version = await analyzer.version();
  } catch (error) {
    logger.warn("analyzer unavailable", errorContext(error));
    return { ...summary, unavailable: true };
  }

  const missing = await prisma.submission.findMany({
    where: { analysis: null, ...(userId ? { userId } : {}) },
    orderBy: { receivedAt: "asc" },
    take: BACKFILL_BATCH,
    select: { id: true, userId: true },
  });
  if (missing.length > 0) {
    await prisma.analysisJob.createMany({
      data: missing.map((s) => ({ submissionId: s.id, userId: s.userId, createdAt: now })),
      skipDuplicates: true,
    });
  }

  // Rules changed: redo estimates from older versions (a batch per run, oldest first).
  const outdated = await prisma.analysisJob.findMany({
    where: {
      status: "DONE",
      result: { analyzerVersion: { not: version } },
      ...(userId ? { userId } : {}),
    },
    orderBy: { finishedAt: "asc" },
    take: BACKFILL_BATCH,
    select: { id: true },
  });
  if (outdated.length > 0) {
    const { count } = await prisma.analysisJob.updateMany({
      where: { id: { in: outdated.map((j) => j.id) }, status: "DONE" },
      data: { status: "QUEUED", resultId: null, attempts: 0, finishedAt: null, lastError: null },
    });
    summary.outdated = count;
  }

  const staleBefore = new Date(now.getTime() - STALE_MS);
  await prisma.analysisJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: staleBefore }, attempts: { lt: MAX_ATTEMPTS } },
    data: { status: "QUEUED", lockedAt: null, lastError: "The previous run didn't finish." },
  });
  await prisma.analysisJob.updateMany({
    where: { status: "RUNNING", lockedAt: { lt: staleBefore }, attempts: { gte: MAX_ATTEMPTS } },
    data: { status: "FAILED", lockedAt: null, finishedAt: now },
  });

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const claimed = await prisma.$queryRaw<{ id: string; submissionId: string; attempts: number }[]>`
    UPDATE "analysis_job"
    SET "status" = 'RUNNING', "lockedAt" = ${now}, "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT j."id" FROM "analysis_job" j
      WHERE j."status" = 'QUEUED'
        AND j."attempts" < ${MAX_ATTEMPTS}
        AND (${userId ?? null}::text IS NULL OR j."userId" = ${userId ?? null})
        AND (
          SELECT count(*) FROM "analysis_job" d
          WHERE d."userId" = j."userId" AND d."finishedAt" > ${dayAgo}
        ) < ${DAILY_ANALYSES_PER_USER}
      ORDER BY j."createdAt", j."id"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "submissionId", "attempts"`;
  for (const job of claimed) {
    try {
      const outcome = await analyzeJob(analyzer, version, job, now);
      if (outcome) summary[outcome] += 1;
    } catch (error) {
      await release(job, error, now);
      summary.failed += 1;
    }
  }
  return summary;
}

async function analyzeJob(
  analyzer: Analyzer,
  version: string,
  job: { id: string; submissionId: string },
  now: Date,
): Promise<"analyzed" | "cached" | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: job.submissionId },
    select: { code: true, language: true, problemSlug: true },
  });
  if (!submission) return null; // deleted meanwhile; its job went with it
  const key = {
    codeHash: codeHash(submission.code),
    language: submission.language,
    problemSlug: submission.problemSlug,
  };
  let result = await prisma.analysisResult.findUnique({
    where: { codeHash_language_problemSlug_analyzerVersion: { ...key, analyzerVersion: version } },
    select: { id: true },
  });
  const cached = result !== null;
  if (!result) {
    const answer = await analyzer.analyze({ language: submission.language, code: submission.code });
    result = await storeResult({ ...key, analyzerVersion: answer.analyzerVersion }, answer);
  }
  await prisma.analysisJob.updateMany({
    where: { id: job.id, status: "RUNNING" },
    data: { status: "DONE", resultId: result.id, finishedAt: now, lockedAt: null, lastError: null },
  });
  return cached ? "cached" : "analyzed";
}

async function storeResult(
  key: { codeHash: string; language: string; problemSlug: string; analyzerVersion: string },
  answer: AnalyzerAnswer,
) {
  const estimate =
    answer.status === "ok"
      ? { time: answer.time, space: answer.space, confidence: answer.confidence }
      : null;
  if (estimate && (!estimate.time || !estimate.space || !estimate.confidence)) {
    throw new AnalyzerUnavailableError("The analyzer's estimate was incomplete.");
  }
  const data = {
    ...key,
    outcome: ({ ok: "OK", unparseable: "UNPARSEABLE", unsupported: "UNSUPPORTED" } as const)[
      answer.status
    ],
    time: estimate?.time ?? null,
    space: estimate?.space ?? null,
    confidence: estimate
      ? (({ low: "LOW", medium: "MEDIUM", high: "HIGH" } as const)[estimate.confidence!] ?? null)
      : null,
    reasons: answer.reasons,
    limitations: answer.limitations,
    message: answer.message ?? null,
  };
  const where = { codeHash_language_problemSlug_analyzerVersion: key };
  try {
    return await prisma.analysisResult.upsert({
      where,
      create: data,
      update: {},
      select: { id: true },
    });
  } catch (error) {
    // Two runs stored the same answer at once; use the one that won.
    if (!isUniqueViolation(error)) throw error;
    return prisma.analysisResult.findUniqueOrThrow({ where, select: { id: true } });
  }
}

/** Puts a job back in the queue after a failure, or gives up after the last attempt. */
async function release(job: { id: string; attempts: number }, error: unknown, now: Date) {
  const message =
    error instanceof AnalyzerUnavailableError ? error.message : "The analysis didn't complete.";
  if (!(error instanceof AnalyzerUnavailableError)) {
    logger.error("analysis job failed", { jobId: job.id, ...errorContext(error) });
  }
  const finalAttempt = job.attempts >= MAX_ATTEMPTS;
  await prisma.analysisJob.updateMany({
    where: { id: job.id, status: "RUNNING" },
    data: {
      status: finalAttempt ? "FAILED" : "QUEUED",
      lockedAt: null,
      lastError: message,
      finishedAt: finalAttempt ? now : null,
    },
  });
}

/**
 * Deletes estimates no solution uses any more (their solutions were deleted). They hold no code,
 * but their reasons can name the code's variables. Run daily.
 */
export async function deleteUnusedResults(): Promise<number> {
  const { count } = await prisma.analysisResult.deleteMany({ where: { jobs: { none: {} } } });
  return count;
}

/**
 * A summary of a person's analyses that changes whenever any of them does (one starts waiting,
 * finishes, or is redone), and how many are waiting. Your solutions compares it with the one it
 * was drawn with to know when to refresh, whoever did the work.
 */
export async function analysisState(
  userId: string,
): Promise<{ fingerprint: string; pending: number }> {
  const [row] = await prisma.$queryRaw<{ total: bigint; pending: bigint; latest: Date | null }[]>`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE "status" IN ('QUEUED', 'RUNNING')) AS pending,
           max("finishedAt") AS latest
    FROM "analysis_job" WHERE "userId" = ${userId}`;
  const pending = Number(row?.pending ?? 0);
  return {
    fingerprint: `${row?.total ?? 0}:${pending}:${row?.latest?.getTime() ?? 0}`,
    pending,
  };
}
