import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { ingestSubmission } from "@/modules/integrations/submissions";
import { createPlan } from "@/modules/plans/service";
import { setCompletion } from "@/modules/progress/service";
import { setShareSolves } from "@/modules/profile/service";
import { createPublishedRoadmap, createTestGroup, createTestUser } from "@/test/factories";
import { listFeed } from "./service";

// Tuesday 2026-11-03: week 1 of a plan starting Monday 2026-11-02.
const NOW = new Date("2026-11-03T20:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

let nextId = 5000;
function accepted(slug: string, at: Date) {
  nextId += 1;
  return {
    source: "LEETCODE" as const,
    verdict: "ACCEPTED" as const,
    submissionId: String(nextId),
    problemSlug: slug,
    language: "python3",
    code: "class Solution: pass",
    submittedAt: Math.floor(at.getTime() / 1000) - 5,
  };
}

/** Grace (sharing on) is in a group whose plan has two-sum; Ada admins it. */
async function setup() {
  const [ada, grace] = await Promise.all([
    createTestUser({ name: "Ada" }),
    createTestUser({ name: "Grace" }),
  ]);
  await prisma.profile.createMany({
    data: [ada, grace].map((u) => ({
      userId: u.id,
      username: u.name.toLowerCase(),
      timezone: "UTC",
    })),
  });
  const group = await createTestGroup([
    { userId: ada.id, role: "ADMIN" },
    { userId: grace.id, role: "MEMBER" },
  ]);
  const version = await createPublishedRoadmap();
  await createPlan(
    ada.id,
    group.id,
    {
      roadmapVersionId: version.id,
      startDate: "2026-11-02",
      pacing: { mode: "PER_WEEK", problemsPerWeek: 2 },
    },
    NOW,
  );
  await setShareSolves(grace.id, true);
  return { ada, grace, group };
}

const posts = (authorId: string) =>
  prisma.post.findMany({
    where: { authorId },
    orderBy: { createdAt: "asc" },
    select: { kind: true, withdrawnAt: true },
  });

describe("re-solve posts", () => {
  it("post when an already solved problem is accepted again, but not for the first solve or a retry", async () => {
    const { ada, grace, group } = await setup();
    const first = accepted("two-sum", NOW);
    await ingestSubmission(grace.id, first, NOW);
    expect((await posts(grace.id)).map((p) => p.kind)).toEqual(["SOLVE"]);

    // The same submission again (an extension retry) is not a re-solve.
    await ingestSubmission(grace.id, first, days(8));
    expect(await posts(grace.id)).toHaveLength(1);

    await ingestSubmission(grace.id, accepted("two-sum", days(8)), days(8));
    expect((await posts(grace.id)).map((p) => p.kind)).toEqual(["SOLVE", "RESOLVE"]);
    const feed = await listFeed(ada.id, { groupId: group.id });
    expect(feed.items.map((p) => p.kind)).toContain("RESOLVE");
  });

  it("post at most once a week per problem, counting the first solve", async () => {
    const { grace } = await setup();
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    await ingestSubmission(grace.id, accepted("two-sum", days(2)), days(2));
    expect((await posts(grace.id)).map((p) => p.kind)).toEqual(["SOLVE"]);
    await ingestSubmission(grace.id, accepted("two-sum", days(8)), days(8));
    await ingestSubmission(grace.id, accepted("two-sum", days(9)), days(9));
    expect((await posts(grace.id)).map((p) => p.kind)).toEqual(["SOLVE", "RESOLVE"]);
  });

  it("post once when two re-solves sync at the same moment", async () => {
    const { grace } = await setup();
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    await Promise.all([
      ingestSubmission(grace.id, accepted("two-sum", days(8)), days(8)),
      ingestSubmission(grace.id, accepted("two-sum", days(8)), days(8)),
    ]);
    expect((await posts(grace.id)).filter((p) => p.kind === "RESOLVE")).toHaveLength(1);
  });

  it("need sharing on and a plan that assigns the problem, and count manual solves as the first", async () => {
    const { grace } = await setup();
    const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
    await setShareSolves(grace.id, false);
    await setCompletion(grace.id, twoSum.id, true, NOW);
    await ingestSubmission(grace.id, accepted("two-sum", days(8)), days(8));
    expect(await posts(grace.id)).toEqual([]);

    await setShareSolves(grace.id, true);
    await ingestSubmission(grace.id, accepted("two-sum", days(9)), days(9));
    expect((await posts(grace.id)).map((p) => p.kind)).toEqual(["RESOLVE"]);
    // min-stack isn't in the plan: no post either way.
    await ingestSubmission(grace.id, accepted("min-stack", days(9)), days(9));
    await ingestSubmission(grace.id, accepted("min-stack", days(20)), days(20));
    expect(await posts(grace.id)).toHaveLength(1);
  });

  it("are withdrawn when the problem is marked unsolved", async () => {
    const { grace } = await setup();
    const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    await ingestSubmission(grace.id, accepted("two-sum", days(8)), days(8));
    await setCompletion(grace.id, twoSum.id, false, days(9));
    expect((await posts(grace.id)).every((p) => p.withdrawnAt !== null)).toBe(true);
  });

  it("can't carry a plan, a body, or a spoiler", async () => {
    const { grace, group } = await setup();
    await expect(
      prisma.post.create({ data: { groupId: group.id, authorId: grace.id, kind: "RESOLVE" } }),
    ).rejects.toThrow();
    const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
    await expect(
      prisma.post.create({
        data: {
          groupId: group.id,
          authorId: grace.id,
          kind: "RESOLVE",
          problemId: twoSum.id,
          spoiler: true,
        },
      }),
    ).rejects.toThrow();
  });
});
