import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { setCompletion } from "@/modules/progress/service";
import { createTestUser } from "@/test/factories";
import {
  authenticateExtension,
  createConnection,
  listConnections,
  revokeConnection,
} from "./connections";
import type { SubmissionPayload } from "./schemas";
import {
  deleteAllSubmissions,
  deleteSubmission,
  ingestSubmission,
  listSubmissions,
  matchWaitingSubmissions,
  purgeExpiredSubmissions,
} from "./submissions";

const NOW = new Date("2026-11-05T12:00:00Z");
const daysLater = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
const bearer = (token: string) => `Bearer ${token}`;

const problem = (slug = "contains-duplicate", title = "Contains Duplicate") =>
  prisma.problem.create({
    data: { leetcodeSlug: slug, title, difficulty: "EASY", source: "SEED" },
  });

const payload = (overrides: Partial<SubmissionPayload> = {}): SubmissionPayload => ({
  source: "LEETCODE",
  verdict: "ACCEPTED",
  submissionId: "2189874571",
  problemSlug: "contains-duplicate",
  language: "python3",
  code: "class Solution:\n    def containsDuplicate(self, nums):\n        return len(set(nums)) < len(nums)",
  submittedAt: Math.floor(NOW.getTime() / 1000) - 5,
  ...overrides,
});

describe("extension connections", () => {
  it("authenticates by token until revoked, and keeps only the token's hash", async () => {
    const ada = await createTestUser();
    const { id, token } = await createConnection(ada.id);
    expect(token).toMatch(/^brx_/);
    const stored = await prisma.extensionConnection.findUniqueOrThrow({ where: { id } });
    expect(stored.tokenHash).not.toContain(token);

    expect(await authenticateExtension(bearer(token), NOW)).toEqual({
      connectionId: id,
      userId: ada.id,
    });
    expect((await listConnections(ada.id))[0]!.lastUsedAt).toEqual(NOW);

    for (const header of [null, "", token, "Bearer nope", bearer(`${token}x`), `Basic ${token}`]) {
      expect(await authenticateExtension(header)).toBeNull();
    }
    await revokeConnection(ada.id, id);
    expect(await authenticateExtension(bearer(token))).toBeNull();
    expect(await listConnections(ada.id)).toEqual([]);
  });

  it("lets only the owner disconnect, and caps connections at five", async () => {
    const [ada, grace] = await Promise.all([createTestUser(), createTestUser()]);
    const { id } = await createConnection(ada.id);
    await expect(revokeConnection(grace.id, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(revokeConnection(ada.id, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
    for (let i = 0; i < 4; i++) await createConnection(ada.id);
    await expect(createConnection(ada.id)).rejects.toMatchObject({ code: "TOO_MANY_CONNECTIONS" });
  });
});

describe("ingesting submissions", () => {
  it("stores an accepted submission once and marks its problem solved", async () => {
    const ada = await createTestUser();
    const known = await problem();
    expect(await ingestSubmission(ada.id, payload(), NOW)).toEqual({
      stored: "new",
      counted: true,
    });
    // The extension retrying, or LeetCode's page polling again, changes nothing.
    expect(await ingestSubmission(ada.id, payload(), NOW)).toEqual({
      stored: "duplicate",
      counted: true,
    });
    expect(await prisma.submission.count()).toBe(1);
    expect(await prisma.problemCompletion.findMany({ where: { userId: ada.id } })).toMatchObject([
      { problemId: known.id, source: "EXTENSION", language: "python3" },
    ]);

    // A resubmission is a new LeetCode ID: kept in history, still one completion.
    await ingestSubmission(ada.id, payload({ submissionId: "2189874999" }), NOW);
    expect(await prisma.submission.count()).toBe(2);
    expect(await prisma.problemCompletion.count()).toBe(1);
  });

  it("counts a neetcode.io submission toward the same problem, kept apart from LeetCode's", async () => {
    const ada = await createTestUser();
    const known = await problem();
    await ingestSubmission(ada.id, payload(), NOW);
    // neetcode.io's ID is its judging time; the same digits from LeetCode are another record.
    const fromNeetcode = payload({ source: "NEETCODE", submissionId: "2189874571" });
    expect(await ingestSubmission(ada.id, fromNeetcode, NOW)).toEqual({
      stored: "new",
      counted: true,
    });
    expect(await ingestSubmission(ada.id, fromNeetcode, NOW)).toMatchObject({
      stored: "duplicate",
    });
    const rows = await prisma.submission.findMany({ orderBy: { source: "asc" } });
    expect(rows.map((r) => [r.source, r.problemId])).toEqual([
      ["LEETCODE", known.id],
      ["NEETCODE", known.id],
    ]);
    expect(await prisma.problemCompletion.count()).toBe(1);
    expect((await listSubmissions(ada.id, {}, NOW)).items.map((s) => s.source).sort()).toEqual([
      "LEETCODE",
      "NEETCODE",
    ]);
  });

  it("keeps an earlier manual completion as it was", async () => {
    const ada = await createTestUser();
    const known = await problem();
    await setCompletion(ada.id, known.id, true, NOW);
    await ingestSubmission(ada.id, payload(), NOW);
    expect(await prisma.problemCompletion.findMany()).toMatchObject([{ source: "MANUAL" }]);
  });

  it("keeps each person's submissions separate", async () => {
    const [ada, grace] = await Promise.all([createTestUser(), createTestUser()]);
    await problem();
    await ingestSubmission(ada.id, payload(), NOW);
    // The same LeetCode ID under another account is that account's own record.
    expect((await ingestSubmission(grace.id, payload(), NOW)).stored).toBe("new");
    const [mine] = (await listSubmissions(ada.id, {}, NOW)).items;
    expect((await listSubmissions(grace.id, {}, NOW)).items.map((s) => s.id)).not.toContain(
      mine!.id,
    );
    await expect(deleteSubmission(grace.id, mine!.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a time in the future and limits bursts", async () => {
    const ada = await createTestUser();
    await expect(
      ingestSubmission(
        ada.id,
        payload({ submittedAt: Math.floor(NOW.getTime() / 1000) + 3600 }),
        NOW,
      ),
    ).rejects.toMatchObject({ code: "INVALID_TIMESTAMP" });
    for (let i = 0; i < 20; i++) {
      await ingestSubmission(ada.id, payload({ submissionId: String(1000 + i) }), NOW);
    }
    await expect(
      ingestSubmission(ada.id, payload({ submissionId: "9999" }), NOW),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("submissions for problems not in Branch", () => {
  it("wait uncounted, then count once the problem is added", async () => {
    const ada = await createTestUser();
    expect(await ingestSubmission(ada.id, payload(), NOW)).toEqual({
      stored: "new",
      counted: false,
    });
    expect(await prisma.problemCompletion.count()).toBe(0);
    const [waiting] = (await listSubmissions(ada.id, {}, NOW)).items;
    expect(waiting!.waitingUntil).toEqual(daysLater(30));

    const added = await problem();
    expect(await matchWaitingSubmissions({ slug: "contains-duplicate" }, daysLater(3))).toBe(1);
    expect(await matchWaitingSubmissions({ slug: "contains-duplicate" }, daysLater(3))).toBe(0);
    expect(await prisma.problemCompletion.findMany()).toMatchObject([
      { problemId: added.id, source: "EXTENSION" },
    ]);
    expect((await listSubmissions(ada.id, {}, NOW)).items[0]!.waitingUntil).toBeNull();
  });

  it("are deleted after 30 days if the problem never arrives", async () => {
    const ada = await createTestUser();
    await problem("two-sum", "Two Sum");
    await ingestSubmission(ada.id, payload(), NOW);
    await ingestSubmission(ada.id, payload({ submissionId: "2", problemSlug: "two-sum" }), NOW);

    expect(await purgeExpiredSubmissions(daysLater(29))).toBe(0);
    // Hidden as soon as it expires, even before the daily job runs.
    expect(
      (await listSubmissions(ada.id, {}, daysLater(31))).items.map((s) => s.problemSlug),
    ).toEqual(["two-sum"]);
    expect(await matchWaitingSubmissions({}, daysLater(31))).toBe(0);
    expect(await purgeExpiredSubmissions(daysLater(31))).toBe(1);
    expect(await purgeExpiredSubmissions(daysLater(31))).toBe(0);
    // Counted submissions are kept until their author deletes them.
    expect(await prisma.submission.findMany()).toMatchObject([{ problemSlug: "two-sum" }]);
  });
});

describe("deleting submissions", () => {
  it("deletes code but leaves the problem solved", async () => {
    const ada = await createTestUser();
    await problem();
    await ingestSubmission(ada.id, payload(), NOW);
    await ingestSubmission(ada.id, payload({ submissionId: "2" }), NOW);
    const [first] = (await listSubmissions(ada.id, {}, NOW)).items;
    await deleteSubmission(ada.id, first!.id);
    expect(await prisma.submission.count()).toBe(1);
    expect(await deleteAllSubmissions(ada.id)).toBe(1);
    expect(await prisma.problemCompletion.count()).toBe(1);
  });

  it("goes with the account", async () => {
    const ada = await createTestUser();
    await createConnection(ada.id);
    await ingestSubmission(ada.id, payload(), NOW);
    await prisma.user.delete({ where: { id: ada.id } });
    expect(await prisma.submission.count()).toBe(0);
    expect(await prisma.extensionConnection.count()).toBe(0);
  });
});
