import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import {
  deleteAllSubmissions,
  deleteSubmission,
  ingestSubmission,
  matchWaitingSubmissions,
} from "@/modules/integrations/submissions";
import { createPlan } from "@/modules/plans/service";
import { setCompletion } from "@/modules/progress/service";
import { setSharing } from "@/modules/profile/service";
import { createPublishedRoadmap, createTestGroup, createTestUser } from "@/test/factories";
import { getPost, listFeed } from "./service";

// "Add my code to my solve posts": a synced solve's post carries its code, only with the
// author's setting on, only their own code, and only while the setting stays on.

// Tuesday 2026-11-03: week 1 of a plan starting Monday 2026-11-02.
const NOW = new Date("2026-11-03T20:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const CODE = "class Solution:\n    def twoSum(self, nums, target):\n        return []";

let nextId = 7000;
function accepted(slug: string, at: Date, code = CODE) {
  nextId += 1;
  return {
    source: "LEETCODE" as const,
    verdict: "ACCEPTED" as const,
    submissionId: String(nextId),
    problemSlug: slug,
    language: "python3",
    code,
    submittedAt: Math.floor(at.getTime() / 1000) - 5,
  };
}

/** Grace shares her solves, with her code if `attach`; Ada admins the group and reads the feed. */
async function setup({ attach = true } = {}) {
  const [ada, grace, outsider] = await Promise.all([
    createTestUser({ name: "Ada" }),
    createTestUser({ name: "Grace" }),
    createTestUser({ name: "Outsider" }),
  ]);
  await prisma.profile.createMany({
    data: [ada, grace, outsider].map((u) => ({
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
  await setSharing(grace.id, { shareSolves: true, attachSolutions: attach });
  return { ada, grace, outsider, group };
}

const solvePost = (authorId: string, kind: "SOLVE" | "RESOLVE" = "SOLVE") =>
  prisma.post.findFirstOrThrow({ where: { authorId, kind } });

describe("code on solve posts", () => {
  it("is off by default: a synced solve posts without its code", async () => {
    const { ada, grace } = await setup({ attach: false });
    expect(
      (await prisma.profile.findUniqueOrThrow({ where: { userId: ada.id } })).attachSolutions,
    ).toBe(false);
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    expect((await solvePost(grace.id)).submissionId).toBeNull();
    const [item] = (await listFeed(ada.id)).items;
    expect(item).toMatchObject({ kind: "SOLVE", solution: null });
  });

  it("puts the synced code on the solve post, and the new code on a re-solve", async () => {
    const { ada, grace } = await setup();
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    const post = await solvePost(grace.id);
    const first = await prisma.submission.findFirstOrThrow({ where: { userId: grace.id } });
    expect(post.submissionId).toBe(first.id);

    const item = await getPost(ada.id, post.id);
    expect(item.solution).toEqual({
      language: "Python 3",
      markdown: `\`\`\`python\n${CODE}\n\`\`\``,
    });

    const again = "class Solution:\n    pass";
    await ingestSubmission(grace.id, accepted("two-sum", days(8), again), days(8));
    const resolve = await solvePost(grace.id, "RESOLVE");
    expect((await getPost(ada.id, resolve.id)).solution?.markdown).toContain(again);
  });

  it("attaches code to a waiting submission's post once its problem is matched", async () => {
    const { grace } = await setup();
    // As if it arrived before Branch's catalog had the problem.
    const waiting = await prisma.submission.create({
      data: {
        userId: grace.id,
        source: "LEETCODE",
        externalId: "6999",
        problemSlug: "two-sum",
        language: "python3",
        code: CODE,
        submittedAt: NOW,
        receivedAt: NOW,
      },
    });
    expect(await matchWaitingSubmissions({ userId: grace.id }, NOW)).toBe(1);
    expect((await solvePost(grace.id)).submissionId).toBe(waiting.id);
  });

  it("attaches nothing to a manual solve, or code too long for a post", async () => {
    const { grace } = await setup();
    const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
    await setCompletion(grace.id, twoSum.id, true, NOW);
    expect((await solvePost(grace.id)).submissionId).toBeNull();

    await ingestSubmission(grace.id, accepted("valid-anagram", NOW, "x".repeat(5001)), NOW);
    const anagram = await prisma.post.findFirstOrThrow({
      where: { authorId: grace.id, problem: { leetcodeSlug: "valid-anagram" } },
    });
    expect(anagram.submissionId).toBeNull();
  });

  it("disappears from every post when the setting goes off, and turning sharing off turns it off", async () => {
    const { ada, grace } = await setup();
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    const post = await solvePost(grace.id);

    await setSharing(grace.id, { shareSolves: true, attachSolutions: false });
    expect((await getPost(ada.id, post.id)).solution).toBeNull();
    // Turning it back on shows it again: the setting is read when the post is shown.
    await setSharing(grace.id, { shareSolves: true, attachSolutions: true });
    expect((await getPost(ada.id, post.id)).solution).not.toBeNull();

    expect(await setSharing(grace.id, { shareSolves: false, attachSolutions: true })).toEqual({
      shareSolves: false,
      attachSolutions: false,
    });
    expect((await getPost(ada.id, post.id)).solution).toBeNull();
  });

  it("comes off the post when the solution is deleted, one or all", async () => {
    const { ada, grace } = await setup();
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    await ingestSubmission(grace.id, accepted("valid-anagram", NOW), NOW);
    const [one, two] = await prisma.post.findMany({
      where: { authorId: grace.id, kind: "SOLVE" },
      orderBy: { id: "asc" },
    });

    await deleteSubmission(grace.id, one!.submissionId!);
    expect((await getPost(ada.id, one!.id)).solution).toBeNull();
    expect(await deleteAllSubmissions(grace.id)).toBe(1);
    expect((await getPost(ada.id, two!.id)).solution).toBeNull();
    // The posts themselves stay.
    expect(await prisma.post.count({ where: { authorId: grace.id, kind: "SOLVE" } })).toBe(2);
  });

  it("is never shown outside the group", async () => {
    const { grace, outsider } = await setup();
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    const post = await solvePost(grace.id);
    await expect(getPost(outsider.id, post.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listFeed(outsider.id)).items).toHaveLength(0);
  });

  it("can't be someone else's code, or sit on a post that isn't a solve (database)", async () => {
    const { ada, grace, group } = await setup();
    await ingestSubmission(ada.id, accepted("two-sum", NOW), NOW);
    const adas = await prisma.submission.findFirstOrThrow({ where: { userId: ada.id } });
    await setCompletion(grace.id, adas.problemId!, true, NOW);
    const post = await solvePost(grace.id);
    await expect(
      prisma.post.update({ where: { id: post.id }, data: { submissionId: adas.id } }),
    ).rejects.toThrow(/post_submissionId_authorId_fkey/);

    const text = await prisma.post.create({
      data: { groupId: group.id, authorId: ada.id, kind: "TEXT", body: "Hello" },
    });
    await expect(
      prisma.post.update({ where: { id: text.id }, data: { submissionId: adas.id } }),
    ).rejects.toThrow(/post_submission_kind/);

    await expect(
      prisma.profile.update({
        where: { userId: ada.id },
        data: { shareSolves: false, attachSolutions: true },
      }),
    ).rejects.toThrow(/profile_attach_solutions/);
  });

  it("doesn't stop an account with linked code from being deleted", async () => {
    const { grace } = await setup();
    await ingestSubmission(grace.id, accepted("two-sum", NOW), NOW);
    await prisma.user.delete({ where: { id: grace.id } });
    expect(await prisma.post.count({ where: { authorId: grace.id } })).toBe(0);
  });
});
