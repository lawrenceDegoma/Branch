import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { createPublishedRoadmap, createTestUser } from "@/test/factories";
import { getStats } from "./service";

// Wednesday 2026-11-11, 15:00 in New York.
const NOW = new Date("2026-11-11T20:00:00Z");
const ZONE = "America/New_York";

async function person(name: string) {
  const user = await createTestUser({ name });
  await prisma.profile.create({
    data: { userId: user.id, username: name.toLowerCase(), timezone: ZONE },
  });
  return user;
}

describe("personal stats", () => {
  it("counts only the person's own solves, reviews, study, and times", async () => {
    await createPublishedRoadmap();
    const [ada, grace] = await Promise.all([person("Ada"), person("Grace")]);
    const problems = await prisma.problem.findMany({ orderBy: { leetcodeSlug: "asc" } });
    const bySlug = (slug: string) => problems.find((p) => p.leetcodeSlug === slug)!;

    await prisma.problemCompletion.createMany({
      data: [
        // This week, by New York's calendar (Monday 2026-11-09 local, late evening).
        {
          userId: ada.id,
          problemId: bySlug("two-sum").id,
          source: "MANUAL",
          completedAt: new Date("2026-11-10T03:00:00Z"),
        },
        // Sunday night in New York, so last week, though it's Monday in UTC.
        {
          userId: ada.id,
          problemId: bySlug("valid-anagram").id,
          source: "MANUAL",
          completedAt: new Date("2026-11-09T03:00:00Z"),
        },
        // Long ago: counted in the total, not in the weeks shown.
        {
          userId: ada.id,
          problemId: bySlug("min-stack").id,
          source: "MANUAL",
          completedAt: new Date("2026-01-05T12:00:00Z"),
        },
        { userId: grace.id, problemId: bySlug("two-sum").id, source: "MANUAL", completedAt: NOW },
      ],
    });
    await prisma.reviewAttempt.createMany({
      data: [
        {
          userId: ada.id,
          problemId: bySlug("two-sum").id,
          outcome: "HARD",
          reviewedAt: NOW,
          intervalDays: 2,
        },
        {
          userId: ada.id,
          problemId: bySlug("two-sum").id,
          outcome: "AGAIN",
          reviewedAt: new Date("2026-09-01T00:00:00Z"),
          intervalDays: 1,
        },
        {
          userId: grace.id,
          problemId: bySlug("two-sum").id,
          outcome: "EASY",
          reviewedAt: NOW,
          intervalDays: 9,
        },
      ],
    });
    await prisma.studySession.createMany({
      data: [
        {
          userId: ada.id,
          startedAt: new Date("2026-11-10T14:00:00Z"),
          endedAt: new Date("2026-11-10T14:45:00Z"),
        },
        {
          userId: ada.id,
          startedAt: new Date("2026-11-11T14:00:00Z"),
          endedAt: new Date("2026-11-11T14:30:30Z"),
        },
        // Still running: not counted.
        { userId: ada.id, startedAt: new Date("2026-11-11T19:00:00Z") },
        {
          userId: grace.id,
          startedAt: new Date("2026-11-10T14:00:00Z"),
          endedAt: new Date("2026-11-10T16:00:00Z"),
        },
      ],
    });
    const timed = (userId: string, slug: string, id: string, seconds: number) => ({
      userId,
      source: "LEETCODE" as const,
      externalId: id,
      problemSlug: slug,
      problemId: bySlug(slug).id,
      language: "python3",
      code: "pass",
      submittedAt: NOW,
      timeSpentSeconds: seconds,
    });
    await prisma.submission.createMany({
      data: [
        timed(ada.id, "two-sum", "1", 600),
        timed(ada.id, "valid-anagram", "2", 1200),
        timed(ada.id, "two-sum", "3", 1800),
        timed(grace.id, "two-sum", "4", 60),
      ],
    });

    const stats = await getStats(ada.id, ZONE, NOW);
    expect(stats.solved.total).toBe(3);
    expect(stats.solved.byWeek).toHaveLength(12);
    expect(stats.solved.byWeek.at(-1)).toEqual({ week: "2026-11-09", value: 1 });
    expect(stats.solved.byWeek.at(-2)).toEqual({ week: "2026-11-02", value: 1 });
    expect(stats.solved.byWeek.reduce((sum, w) => sum + w.value, 0)).toBe(2);

    // Only the last 30 days of reviews.
    expect(stats.reviews.total).toBe(1);
    expect(stats.reviews.byOutcome).toContainEqual({ outcome: "HARD", count: 1 });

    expect(stats.study.byWeek.at(-1)).toEqual({ week: "2026-11-09", value: 75 });
    expect(stats.study.sessions).toHaveLength(2);

    // Three timed solves, all Easy: the median of 10, 20, and 30 minutes.
    expect(stats.times).toEqual([{ difficulty: "EASY", medianSeconds: 1200, count: 3 }]);

    // Topics come from Review's own rule.
    expect(stats.topics.map((t) => t.topic.name)).toContain("Arrays & Hashing");
  });

  it("is empty for someone who hasn't done anything yet", async () => {
    await createPublishedRoadmap();
    const ada = await person("Ada");
    const stats = await getStats(ada.id, ZONE, NOW);
    expect(stats.solved.total).toBe(0);
    expect(stats.solved.byWeek.every((w) => w.value === 0)).toBe(true);
    expect(stats.reviews.total).toBe(0);
    expect(stats.study.sessions).toEqual([]);
    expect(stats.times).toEqual([]);
    expect(stats.topics).toEqual([]);
  });
});
