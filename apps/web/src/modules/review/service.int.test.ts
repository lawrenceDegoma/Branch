import { prisma } from "@branch/database";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";
import { getHome, setCompletion } from "@/modules/progress/service";
import { syncCatalog } from "@branch/database/catalog-import";
import { createTestUser, testCatalog } from "@/test/factories";
import { countDueReviews, getReviewQueue, listReviewHistory, recordReview } from "./service";

const TZ = "America/New_York";
// Tuesday 2026-11-03, 15:00 in New York. A problem solved now first comes back on Friday 11-06.
const NOW = new Date("2026-11-03T20:00:00Z");
const FRIDAY = new Date("2026-11-06T20:00:00Z");
const SATURDAY = new Date("2026-11-07T20:00:00Z");

beforeEach(async () => {
  await syncCatalog(prisma, testCatalog, "SEED");
});

async function problemId(slug: string) {
  return (await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: slug } })).id;
}

async function solver() {
  const user = await createTestUser();
  await prisma.profile.create({
    data: { userId: user.id, username: `u${user.id.slice(0, 8)}`, timezone: TZ },
  });
  return user;
}

const schedule = (userId: string, problemId: string) =>
  prisma.reviewSchedule.findUnique({ where: { userId_problemId: { userId, problemId } } });

describe("the review schedule", () => {
  it("starts when a problem is solved, a few days out, and survives a repeated solve", async () => {
    const user = await solver();
    const twoSum = await problemId("two-sum");
    await setCompletion(user.id, twoSum, true, NOW);
    expect(await schedule(user.id, twoSum)).toMatchObject({
      dueOn: new Date("2026-11-06"),
      intervalDays: 3,
      ease: 250,
      reviewCount: 0,
    });
    await prisma.reviewSchedule.update({
      where: { userId_problemId: { userId: user.id, problemId: twoSum } },
      data: { reviewCount: 2 },
    });
    await setCompletion(user.id, twoSum, true, SATURDAY);
    expect((await schedule(user.id, twoSum))?.reviewCount).toBe(2);
  });

  it("is deleted with the completion, but past reviews stay in the history", async () => {
    const user = await solver();
    const twoSum = await problemId("two-sum");
    await setCompletion(user.id, twoSum, true, NOW);
    await recordReview(user.id, twoSum, "GOOD", TZ, FRIDAY);
    await setCompletion(user.id, twoSum, false, SATURDAY);
    expect(await schedule(user.id, twoSum)).toBeNull();
    expect((await listReviewHistory(user.id)).items).toHaveLength(1);
  });
});

describe("recording a review", () => {
  it("records the outcome and moves the next review out", async () => {
    const user = await solver();
    const twoSum = await problemId("two-sum");
    await setCompletion(user.id, twoSum, true, NOW);
    expect(await recordReview(user.id, twoSum, "GOOD", TZ, FRIDAY)).toEqual({
      title: "Two Sum",
      dueOn: "2026-11-14",
      days: 8,
    });
    expect(await schedule(user.id, twoSum)).toMatchObject({
      dueOn: new Date("2026-11-14"),
      intervalDays: 8,
      reviewCount: 1,
      lastReviewedAt: FRIDAY,
    });
    const attempts = await prisma.reviewAttempt.findMany({ where: { userId: user.id } });
    expect(attempts).toEqual([
      expect.objectContaining({ problemId: twoSum, outcome: "GOOD", intervalDays: 8 }),
    ]);
  });

  it("refuses a review that isn't due yet", async () => {
    const user = await solver();
    const twoSum = await problemId("two-sum");
    await setCompletion(user.id, twoSum, true, NOW);
    await expect(recordReview(user.id, twoSum, "EASY", TZ, NOW)).rejects.toMatchObject({
      code: "ALREADY_REVIEWED",
      message: "You've already reviewed this. It comes back on Nov 6.",
    });
  });

  it("records one review when the same rating is sent twice at once", async () => {
    const user = await solver();
    const twoSum = await problemId("two-sum");
    await setCompletion(user.id, twoSum, true, NOW);
    const results = await Promise.allSettled([
      recordReview(user.id, twoSum, "HARD", TZ, FRIDAY),
      recordReview(user.id, twoSum, "HARD", TZ, FRIDAY),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(DomainError);
    expect(await prisma.reviewAttempt.count({ where: { userId: user.id } })).toBe(1);
    expect((await schedule(user.id, twoSum))?.reviewCount).toBe(1);
  });

  it("uses the user's own calendar day", async () => {
    const user = await solver();
    const twoSum = await problemId("two-sum");
    await setCompletion(user.id, twoSum, true, NOW);
    // 23:00 on Thursday in New York is already Friday in UTC: not due yet for this user.
    const thursdayNight = new Date("2026-11-06T04:00:00Z");
    expect(await countDueReviews(user.id, TZ, thursdayNight)).toBe(0);
    await expect(recordReview(user.id, twoSum, "GOOD", TZ, thursdayNight)).rejects.toBeInstanceOf(
      DomainError,
    );
    expect(await countDueReviews(user.id, TZ, FRIDAY)).toBe(1);
  });

  it("can't touch another person's reviews", async () => {
    const [owner, other] = await Promise.all([solver(), solver()]);
    const twoSum = await problemId("two-sum");
    await setCompletion(owner.id, twoSum, true, NOW);
    await expect(recordReview(other.id, twoSum, "AGAIN", TZ, FRIDAY)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect((await getReviewQueue(other.id, TZ, FRIDAY)).dueCount).toBe(0);
    expect((await listReviewHistory(other.id)).items).toHaveLength(0);
  });
});

describe("the queue", () => {
  it("lists due reviews oldest first, with each outcome's gap, and what comes up next", async () => {
    const user = await solver();
    const [twoSum, anagram, parens] = await Promise.all([
      problemId("two-sum"),
      problemId("valid-anagram"),
      problemId("valid-parentheses"),
    ]);
    await setCompletion(user.id, twoSum, true, new Date("2026-11-01T20:00:00Z"));
    await setCompletion(user.id, anagram, true, NOW);
    await setCompletion(user.id, parens, true, FRIDAY);
    await recordReview(user.id, twoSum, "AGAIN", TZ, new Date("2026-11-04T20:00:00Z"));

    const queue = await getReviewQueue(user.id, TZ, FRIDAY);
    expect(queue.dueCount).toBe(2);
    expect(queue.due.map((d) => d.problem.title)).toEqual(["Two Sum", "Valid Anagram"]);
    expect(queue.due[0]).toMatchObject({ dueOn: "2026-11-05", lastOutcome: "AGAIN" });
    expect(queue.due[0]!.choices.map((c) => c.days)).toEqual([1, 2, 2, 3]);
    expect(queue.due[1]).toMatchObject({ lastOutcome: null, reviewCount: 0 });
    expect(queue.upcoming.map((u) => [u.problem.title, u.dueOn])).toEqual([
      ["Valid Parentheses", "2026-11-09"],
    ]);

    const home = await getHome(user.id, TZ, FRIDAY);
    expect(home.summary.reviewsDue).toBe(2);
  });

  it("pages the history newest first", async () => {
    const user = await solver();
    const twoSum = await problemId("two-sum");
    await setCompletion(user.id, twoSum, true, NOW);
    let day = FRIDAY;
    for (let i = 0; i < 21; i++) {
      await recordReview(user.id, twoSum, "AGAIN", TZ, day);
      day = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    }
    const first = await listReviewHistory(user.id);
    expect(first.items).toHaveLength(20);
    expect(first.items[0]!.reviewedAt.getTime()).toBeGreaterThan(
      first.items[1]!.reviewedAt.getTime(),
    );
    const second = await listReviewHistory(user.id, { before: first.nextCursor! });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });
});

describe("database constraints", () => {
  it("rejects out-of-range gaps and ease, and a schedule for an unsolved problem", async () => {
    const user = await solver();
    const twoSum = await problemId("two-sum");
    const anagram = await problemId("valid-anagram");
    await setCompletion(user.id, twoSum, true, NOW);
    const where = { userId_problemId: { userId: user.id, problemId: twoSum } };
    await expect(
      prisma.reviewSchedule.update({ where, data: { intervalDays: 0 } }),
    ).rejects.toThrow();
    await expect(prisma.reviewSchedule.update({ where, data: { ease: 500 } })).rejects.toThrow();
    await expect(
      prisma.reviewSchedule.create({
        data: {
          userId: user.id,
          problemId: anagram,
          dueOn: new Date(),
          intervalDays: 3,
          ease: 250,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`INSERT INTO review_attempt (id, "userId", "problemId", outcome, "reviewedAt", "intervalDays") VALUES (gen_random_uuid(), ${user.id}, ${twoSum}::uuid, 'GOOD', now(), NULL)`,
    ).rejects.toThrow();
  });
});
