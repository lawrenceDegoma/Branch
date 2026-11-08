import { prisma } from "@branch/database";
import { syncCatalog } from "@branch/database/catalog-import";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { ingestSubmission, pasteSolution } from "@/modules/integrations/submissions";
import { setCompletion } from "@/modules/progress/service";
import { createTestUser, testCatalog } from "@/test/factories";
import { AnalyzerUnavailableError, type Analyzer, type AnalyzerAnswer } from "./analyzer";
import {
  codeHash,
  DAILY_ANALYSES_PER_USER,
  deleteUnusedResults,
  MAX_ATTEMPTS,
  runAnalysisJobs,
} from "./service";

const NOW = new Date("2026-11-07T12:00:00Z");
const CODE = "class Solution:\n    def twoSum(self, nums, target):\n        return []";

const answer: AnalyzerAnswer = {
  analyzerVersion: "test-1",
  status: "ok",
  time: "O(n)",
  space: "O(1)",
  confidence: "high",
  reasons: ["A loop goes over the input once."],
  limitations: ["Estimated by reading the code, without running it."],
};

/** An analyzer that counts calls and can be made to fail. */
function fakeAnalyzer(
  overrides: Partial<{ version: () => Promise<string>; answer: AnalyzerAnswer }> = {},
) {
  const calls: { language: string; code: string }[] = [];
  const analyzer: Analyzer = {
    version: overrides.version ?? (async () => "test-1"),
    async analyze(input) {
      calls.push(input);
      return overrides.answer ?? answer;
    },
  };
  return { analyzer, calls };
}

beforeEach(async () => {
  await syncCatalog(prisma, testCatalog, "SEED");
});

let counter = 0;
async function synced(userId: string, code = CODE, slug = "two-sum") {
  counter += 1;
  await ingestSubmission(
    userId,
    {
      source: "LEETCODE",
      verdict: "ACCEPTED",
      submissionId: String(1000 + counter),
      problemSlug: slug,
      language: "python3",
      code,
      submittedAt: Math.floor(NOW.getTime() / 1000) - 60,
    },
    NOW,
  );
}

const jobs = (userId: string) =>
  prisma.analysisJob.findMany({ where: { userId }, include: { result: true } });

describe("running analyses", () => {
  it("does nothing without an analyzer", async () => {
    const user = await createTestUser();
    await synced(user.id);
    expect(await runAnalysisJobs({ analyzer: null, now: NOW })).toBeNull();
    expect(await jobs(user.id)).toEqual([]);
  });

  it("gives each solution a job, analyzes it, and stores the estimate", async () => {
    const user = await createTestUser();
    await synced(user.id);
    const { analyzer, calls } = fakeAnalyzer();
    expect(await runAnalysisJobs({ analyzer, now: NOW })).toEqual({
      analyzed: 1,
      cached: 0,
      failed: 0,
      outdated: 0,
    });
    expect(calls).toEqual([{ language: "python3", code: CODE }]);
    const [job] = await jobs(user.id);
    expect(job).toMatchObject({ status: "DONE", attempts: 1, finishedAt: NOW });
    expect(job!.result).toMatchObject({
      outcome: "OK",
      time: "O(n)",
      space: "O(1)",
      confidence: "HIGH",
      analyzerVersion: "test-1",
      codeHash: codeHash(CODE),
      problemSlug: "two-sum",
    });
    // Running again finds nothing to do.
    expect(await runAnalysisJobs({ analyzer, now: NOW })).toEqual({
      analyzed: 0,
      cached: 0,
      failed: 0,
      outdated: 0,
    });
  });

  it("analyzes identical code once, however its lines end", async () => {
    const [ada, grace] = await Promise.all([createTestUser(), createTestUser()]);
    await synced(ada.id, CODE);
    await synced(grace.id, CODE.replaceAll("\n", "\r\n") + "   \n");
    const { analyzer, calls } = fakeAnalyzer();
    expect(await runAnalysisJobs({ analyzer, now: NOW })).toMatchObject({ analyzed: 1, cached: 1 });
    expect(calls).toHaveLength(1);
    expect(await prisma.analysisResult.count()).toBe(1);
  });

  it("waits, without using up attempts, while the analyzer is down", async () => {
    const user = await createTestUser();
    await synced(user.id);
    const down = fakeAnalyzer({
      version: async () => {
        throw new AnalyzerUnavailableError("The analyzer couldn't be reached.");
      },
    });
    for (let run = 0; run < 5; run++) {
      expect(await runAnalysisJobs({ analyzer: down.analyzer, now: NOW })).toMatchObject({
        unavailable: true,
      });
    }
    // Nothing was claimed or failed; the solution simply waits.
    expect((await jobs(user.id)).filter((j) => j.attempts > 0 || j.status === "FAILED")).toEqual(
      [],
    );
    const up = fakeAnalyzer();
    await runAnalysisJobs({ analyzer: up.analyzer, now: NOW });
    expect(up.calls).toHaveLength(1);
  });

  it("retries a solution the analyzer fails on, and gives up after the last attempt", async () => {
    const user = await createTestUser();
    await synced(user.id);
    const failing: Analyzer = {
      version: async () => "test-1",
      analyze: async () => {
        throw new AnalyzerUnavailableError("The analyzer answered 500.");
      },
    };
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      expect(await runAnalysisJobs({ analyzer: failing, now: NOW })).toMatchObject({ failed: 1 });
    }
    expect(await jobs(user.id)).toMatchObject([
      { status: "FAILED", attempts: MAX_ATTEMPTS, lastError: "The analyzer answered 500." },
    ]);
    // A failed job isn't picked up again.
    const up = fakeAnalyzer();
    await runAnalysisJobs({ analyzer: up.analyzer, now: NOW });
    expect(up.calls).toHaveLength(0);
  });

  it("redoes estimates made by an older analyzer version", async () => {
    const user = await createTestUser();
    await synced(user.id);
    await runAnalysisJobs({ analyzer: fakeAnalyzer().analyzer, now: NOW });
    const newer = fakeAnalyzer({
      version: async () => "test-2",
      answer: { ...answer, analyzerVersion: "test-2", time: "O(n log n)" },
    });
    expect(await runAnalysisJobs({ analyzer: newer.analyzer, now: NOW })).toMatchObject({
      outdated: 1,
      analyzed: 1,
    });
    expect((await jobs(user.id))[0]!.result).toMatchObject({
      analyzerVersion: "test-2",
      time: "O(n log n)",
    });
    // The old estimate is now unused, and the daily cleanup removes it.
    expect(await deleteUnusedResults()).toBe(1);
    // Nothing more to redo.
    expect(await runAnalysisJobs({ analyzer: newer.analyzer, now: NOW })).toMatchObject({
      outdated: 0,
      analyzed: 0,
    });
  });

  it("refuses an incomplete estimate rather than storing it", async () => {
    const user = await createTestUser();
    await synced(user.id);
    const { analyzer } = fakeAnalyzer({ answer: { ...answer, time: null } });
    expect(await runAnalysisJobs({ analyzer, now: NOW })).toMatchObject({ failed: 1 });
    expect(await jobs(user.id)).toMatchObject([{ status: "QUEUED", attempts: 1 }]);
    expect(await prisma.analysisResult.count()).toBe(0);
  });

  it("stores the analyzer's other answers too", async () => {
    const user = await createTestUser();
    await synced(user.id);
    const unsupported = fakeAnalyzer({
      answer: {
        analyzerVersion: "test-1",
        status: "unsupported",
        reasons: [],
        limitations: [],
        message: "Only Python solutions are analyzed so far.",
      },
    });
    await runAnalysisJobs({ analyzer: unsupported.analyzer, now: NOW });
    expect((await jobs(user.id))[0]!.result).toMatchObject({
      outcome: "UNSUPPORTED",
      time: null,
      message: "Only Python solutions are analyzed so far.",
    });
  });

  it("never analyzes a solution twice when runs overlap", async () => {
    const user = await createTestUser();
    for (let i = 0; i < 6; i++) await synced(user.id, `${CODE}\n# ${i}`);
    const { analyzer, calls } = fakeAnalyzer();
    await Promise.all([
      runAnalysisJobs({ analyzer, now: NOW }),
      runAnalysisJobs({ analyzer, now: NOW }),
      runAnalysisJobs({ analyzer, now: NOW }),
    ]);
    expect(calls).toHaveLength(6);
    expect((await jobs(user.id)).every((j) => j.status === "DONE")).toBe(true);
  });

  it("retries a job a run abandoned", async () => {
    const user = await createTestUser();
    await synced(user.id);
    await runAnalysisJobs({ analyzer: fakeAnalyzer().analyzer, limit: 0, now: NOW });
    await prisma.analysisJob.updateMany({
      data: { status: "RUNNING", attempts: 1, lockedAt: new Date(NOW.getTime() - 60 * 60_000) },
    });
    const { analyzer, calls } = fakeAnalyzer();
    await runAnalysisJobs({ analyzer, now: NOW });
    expect(calls).toHaveLength(1);
    expect(await jobs(user.id)).toMatchObject([{ status: "DONE", attempts: 2 }]);
  });

  it("caps analyses per person per day, and only runs the given person's", async () => {
    const [ada, grace] = await Promise.all([createTestUser(), createTestUser()]);
    await synced(ada.id, `${CODE}\n# ada`);
    await synced(grace.id, `${CODE}\n# grace`);
    // Grace has used her day's analyses already.
    const result = await prisma.analysisResult.create({
      data: {
        codeHash: "0".repeat(64),
        language: "python3",
        problemSlug: "two-sum",
        analyzerVersion: "test-1",
        outcome: "OK",
        time: "O(1)",
        space: "O(1)",
        confidence: "HIGH",
      },
    });
    const earlier = Array.from({ length: DAILY_ANALYSES_PER_USER }, () => crypto.randomUUID());
    await prisma.submission.createMany({
      data: earlier.map((id, i) => ({
        id,
        userId: grace.id,
        source: "PASTED" as const,
        problemSlug: "two-sum",
        language: "python3",
        code: `y = ${i}`,
        submittedAt: NOW,
      })),
    });
    await prisma.analysisJob.createMany({
      data: earlier.map((submissionId) => ({
        submissionId,
        userId: grace.id,
        status: "DONE" as const,
        resultId: result.id,
        finishedAt: new Date(NOW.getTime() - 60_000),
      })),
    });

    const onlyAda = fakeAnalyzer();
    await runAnalysisJobs({ analyzer: onlyAda.analyzer, userId: ada.id, now: NOW });
    expect(onlyAda.calls.map((c) => c.code)).toEqual([`${CODE}\n# ada`]);

    const everyone = fakeAnalyzer();
    await runAnalysisJobs({ analyzer: everyone.analyzer, now: NOW });
    expect(everyone.calls).toHaveLength(0); // Grace is at her cap until tomorrow
    const tomorrow = fakeAnalyzer();
    await runAnalysisJobs({
      analyzer: tomorrow.analyzer,
      now: new Date(NOW.getTime() + 25 * 60 * 60_000),
    });
    expect(tomorrow.calls.map((c) => c.code)).toEqual([`${CODE}\n# grace`]);
  });

  it("deletes estimates once no solution uses them", async () => {
    const user = await createTestUser();
    await synced(user.id);
    await runAnalysisJobs({ analyzer: fakeAnalyzer().analyzer, now: NOW });
    expect(await deleteUnusedResults()).toBe(0);
    await prisma.submission.deleteMany({ where: { userId: user.id } });
    expect(await prisma.analysisJob.count()).toBe(0);
    expect(await deleteUnusedResults()).toBe(1);
  });
});

describe("pasting a solution", () => {
  async function solver() {
    const user = await createTestUser();
    const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
    await setCompletion(user.id, twoSum.id, true, NOW);
    return { user, twoSum };
  }

  it("saves it for a solved problem without touching the completion, then analyzes it", async () => {
    const { user, twoSum } = await solver();
    await pasteSolution(user.id, { problemId: twoSum.id, language: "python3", code: CODE }, NOW);
    expect(await prisma.submission.findMany({ where: { userId: user.id } })).toMatchObject([
      { source: "PASTED", externalId: null, problemSlug: "two-sum", problemId: twoSum.id },
    ]);
    expect(await prisma.problemCompletion.count({ where: { userId: user.id } })).toBe(1);
    const { analyzer, calls } = fakeAnalyzer();
    await runAnalysisJobs({ analyzer, userId: user.id, now: NOW });
    expect(calls).toHaveLength(1);
  });

  it("only for problems the person has solved", async () => {
    const user = await createTestUser();
    const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
    await expect(
      pasteSolution(user.id, { problemId: twoSum.id, language: "python3", code: CODE }, NOW),
    ).rejects.toMatchObject({ code: "NOT_SOLVED", field: "problemId" });
  });

  it("validates the language and code", async () => {
    const { user, twoSum } = await solver();
    const paste = (input: Record<string, string>) =>
      pasteSolution(
        user.id,
        { problemId: twoSum.id, language: "python3", code: CODE, ...input },
        NOW,
      );
    await expect(paste({ code: "   \n" })).rejects.toMatchObject({ field: "code" });
    await expect(paste({ language: "brainfuck" })).rejects.toMatchObject({ field: "language" });
    await expect(paste({ code: "x".repeat(100_001) })).rejects.toBeInstanceOf(DomainError);
    await expect(paste({ problemId: "not-a-uuid" })).rejects.toMatchObject({ field: "problemId" });
  });
});

describe("database rules", () => {
  it("keeps site IDs for synced solutions only, and a job with its solution's owner", async () => {
    const [ada, grace] = await Promise.all([createTestUser(), createTestUser()]);
    const base = {
      userId: ada.id,
      problemSlug: "two-sum",
      language: "python3",
      code: "x",
      submittedAt: NOW,
    };
    await expect(
      prisma.submission.create({ data: { ...base, source: "PASTED", externalId: "1" } }),
    ).rejects.toThrow();
    await expect(
      prisma.submission.create({ data: { ...base, source: "LEETCODE", externalId: null } }),
    ).rejects.toThrow();
    const pasted = await prisma.submission.create({ data: { ...base, source: "PASTED" } });
    await expect(
      prisma.analysisJob.create({ data: { submissionId: pasted.id, userId: grace.id } }),
    ).rejects.toThrow();
    // DONE exactly when there's a result.
    await expect(
      prisma.analysisJob.create({
        data: { submissionId: pasted.id, userId: ada.id, status: "DONE" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.analysisJob.create({ data: { submissionId: pasted.id, userId: ada.id, attempts: 4 } }),
    ).rejects.toThrow();
  });

  it("stores an estimate only with all its parts, and no other outcome with one", async () => {
    const base = {
      codeHash: "a".repeat(64),
      language: "python3",
      problemSlug: "two-sum",
      analyzerVersion: "v",
    };
    await expect(
      prisma.analysisResult.create({ data: { ...base, outcome: "OK", time: "O(n)" } }),
    ).rejects.toThrow();
    await expect(
      prisma.analysisResult.create({
        data: { ...base, outcome: "UNSUPPORTED", time: "O(n)", space: "O(1)", confidence: "LOW" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.analysisResult.create({
        data: { ...base, codeHash: "not-a-hash", outcome: "UNSUPPORTED" },
      }),
    ).rejects.toThrow();
  });
});
