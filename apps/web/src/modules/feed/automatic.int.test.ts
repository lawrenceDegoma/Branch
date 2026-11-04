import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { createPlan } from "@/modules/plans/service";
import { setCompletion } from "@/modules/progress/service";
import { setShareSolves } from "@/modules/profile/service";
import {
  createPublishedRoadmap,
  createTestGroup,
  createTestUser,
  testRoadmapDefinition,
} from "@/test/factories";
import { createPost, deletePost, editPost, hidePost, listFeed } from "./service";

// Tuesday 2026-11-03 in New York: week 1 of plans starting Monday 2026-11-02.
const NOW = new Date("2026-11-03T20:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const twoAWeek = { mode: "PER_WEEK" as const, problemsPerWeek: 2 };

async function onboarded(name: string) {
  const user = await createTestUser({ name });
  await prisma.profile.create({
    data: { userId: user.id, username: name.toLowerCase(), timezone: "UTC" },
  });
  return user;
}

/**
 * Grace belongs to Study (plan: week 1 two-sum and valid-anagram, week 2 valid-parentheses),
 * Idle (no plan), and Stacks (a plan without two-sum). Ada admins Study; Olu is in none.
 */
async function setup() {
  const [ada, grace, olu] = await Promise.all([
    onboarded("Ada"),
    onboarded("Grace"),
    onboarded("Olu"),
  ]);
  const study = await createTestGroup(
    [
      { userId: ada.id, role: "ADMIN" },
      { userId: grace.id, role: "MEMBER" },
    ],
    { name: "Study" },
  );
  const idle = await createTestGroup([{ userId: grace.id, role: "ADMIN" }], { name: "Idle" });
  const stacks = await createTestGroup([{ userId: grace.id, role: "ADMIN" }], { name: "Stacks" });
  const version = await createPublishedRoadmap();
  const stackVersion = await createPublishedRoadmap(
    testRoadmapDefinition({
      slug: "stacks",
      title: "Stacks",
      sections: [{ title: "Stack", problems: ["min-stack"] }],
    }),
  );
  const plan = { startDate: "2026-11-02", pacing: twoAWeek };
  await createPlan(ada.id, study.id, { roadmapVersionId: version.id, ...plan }, NOW);
  await createPlan(grace.id, stacks.id, { roadmapVersionId: stackVersion.id, ...plan }, NOW);
  const id = async (slug: string) =>
    (await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: slug } })).id;
  const ids = {
    twoSum: await id("two-sum"),
    validAnagram: await id("valid-anagram"),
    validParentheses: await id("valid-parentheses"),
  };
  return { ada, grace, olu, study, idle, stacks, ids };
}

// Posts made by one action share a timestamp, so their relative order isn't meaningful.
const sorted = (labels: (string | null)[]) => [...labels].sort();

/** What someone sees in their feed, as short labels. */
async function seenBy(userId: string) {
  const { items } = await listFeed(userId);
  return items.map((item) =>
    item.kind === "SOLVE"
      ? `${item.author.name} solved ${item.problem?.title}`
      : item.kind === "WEEK_DONE"
        ? `${item.author.name} finished week ${item.weekNumber} of ${item.roadmap?.title}`
        : item.kind === "PLAN_DONE"
          ? `${item.author.name} finished ${item.roadmap?.title}`
          : item.body,
  );
}

describe("automatic posts", () => {
  it("posts nothing while sharing is off, which is the default", async () => {
    const { ada, grace, ids } = await setup();
    expect(await setCompletion(grace.id, ids.twoSum, true, NOW)).toEqual({ changed: true });
    expect(await prisma.post.count()).toBe(0);
    expect(await seenBy(ada.id)).toEqual([]);
    // Progress still counts.
    expect(await prisma.problemCompletion.count({ where: { userId: grace.id } })).toBe(1);
  });

  it("posts a solve only to groups whose plan assigns the problem", async () => {
    const { ada, grace, olu, study, ids } = await setup();
    await setShareSolves(grace.id, true);
    await setCompletion(grace.id, ids.twoSum, true, NOW);
    const posts = await prisma.post.findMany();
    expect(posts).toMatchObject([
      { kind: "SOLVE", groupId: study.id, problemId: ids.twoSum, body: null },
    ]);
    expect(await seenBy(ada.id)).toEqual(["Grace solved Two Sum"]);
    expect(await seenBy(olu.id)).toEqual([]);
  });

  it("never posts the same solve twice, even when requests race", async () => {
    const { grace, ids } = await setup();
    await setShareSolves(grace.id, true);
    await Promise.all(
      Array.from({ length: 5 }, () => setCompletion(grace.id, ids.twoSum, true, NOW)),
    );
    await setCompletion(grace.id, ids.twoSum, true, later(5));
    expect(await prisma.post.count({ where: { kind: "SOLVE" } })).toBe(1);
  });

  it("withdraws a post when the solve is undone and restores the same post when redone", async () => {
    const { ada, grace, ids } = await setup();
    await setShareSolves(grace.id, true);
    await setCompletion(grace.id, ids.twoSum, true, NOW);
    const [original] = await prisma.post.findMany();

    await setCompletion(grace.id, ids.twoSum, false, later(1));
    expect(await seenBy(ada.id)).toEqual([]);
    await setCompletion(grace.id, ids.twoSum, true, later(2));
    const posts = await prisma.post.findMany();
    expect(posts).toHaveLength(1);
    // The same post in its original place, not a second celebration.
    expect(posts[0]).toMatchObject({ id: original!.id, createdAt: NOW, withdrawnAt: null });
    expect(await seenBy(ada.id)).toEqual(["Grace solved Two Sum"]);
  });

  it("stops new posts when sharing is turned off, and keeps earlier ones", async () => {
    const { ada, grace, ids } = await setup();
    await setShareSolves(grace.id, true);
    await setCompletion(grace.id, ids.twoSum, true, NOW);
    await setCompletion(grace.id, ids.validParentheses, true, NOW);
    await setShareSolves(grace.id, false);
    // Valid Anagram would finish week 1 and the plan; with sharing off, nothing is posted.
    await setCompletion(grace.id, ids.validAnagram, true, later(1));
    expect(sorted(await seenBy(ada.id))).toEqual([
      "Grace finished week 2 of Test roadmap",
      "Grace solved Two Sum",
      "Grace solved Valid Parentheses",
    ]);
    // An undo still takes its post down, and a redo with sharing off doesn't bring it back.
    await setCompletion(grace.id, ids.twoSum, false, later(2));
    await setCompletion(grace.id, ids.twoSum, true, later(3));
    expect(sorted(await seenBy(ada.id))).toEqual([
      "Grace finished week 2 of Test roadmap",
      "Grace solved Valid Parentheses",
    ]);
  });

  it("keeps a hidden post hidden through undo and redo", async () => {
    const { ada, grace, ids } = await setup();
    await setShareSolves(grace.id, true);
    await setCompletion(grace.id, ids.twoSum, true, NOW);
    const [post] = await prisma.post.findMany();
    await hidePost(grace.id, post!.id, later(1));
    await hidePost(grace.id, post!.id, later(2)); // harmless
    await setCompletion(grace.id, ids.twoSum, false, later(3));
    await setCompletion(grace.id, ids.twoSum, true, later(4));
    expect(await prisma.post.count()).toBe(1);
    expect(await prisma.post.findUnique({ where: { id: post!.id } })).toMatchObject({
      hiddenAt: later(1),
    });
    expect(await seenBy(ada.id)).toEqual([]);
    expect(await seenBy(grace.id)).toEqual([]);
  });

  it("celebrates a finished week, then the finished plan instead of its last week", async () => {
    const { ada, grace, ids } = await setup();
    await setShareSolves(grace.id, true);
    await setCompletion(grace.id, ids.twoSum, true, NOW);
    await setCompletion(grace.id, ids.validAnagram, true, later(1));
    await setCompletion(grace.id, ids.validParentheses, true, later(2));
    expect(sorted(await seenBy(ada.id))).toEqual([
      "Grace finished Test roadmap",
      "Grace finished week 1 of Test roadmap",
      "Grace solved Two Sum",
      "Grace solved Valid Anagram",
      "Grace solved Valid Parentheses",
    ]);
    expect(await prisma.post.count({ where: { kind: "WEEK_DONE", weekNumber: 2 } })).toBe(0);

    // Undoing a week-1 problem: the week and the plan are no longer finished.
    await setCompletion(grace.id, ids.validAnagram, false, later(3));
    expect(sorted(await seenBy(ada.id))).toEqual([
      "Grace solved Two Sum",
      "Grace solved Valid Parentheses",
    ]);
    await setCompletion(grace.id, ids.validAnagram, true, later(4));
    expect(await seenBy(ada.id)).toHaveLength(5);
    expect(await prisma.post.count()).toBe(5);
  });

  it("lets only the author hide an automatic post, and nobody edit or delete one", async () => {
    const { ada, grace, olu, study, ids } = await setup();
    await setShareSolves(grace.id, true);
    await setCompletion(grace.id, ids.twoSum, true, NOW);
    const [solve] = await prisma.post.findMany();

    await expect(hidePost(ada.id, solve!.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(hidePost(olu.id, solve!.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      editPost(grace.id, solve!.id, { body: "edited", spoiler: false }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deletePost(ada.id, solve!.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deletePost(grace.id, solve!.id)).rejects.toBeInstanceOf(ForbiddenError);

    const text = await createPost(
      grace.id,
      { groupId: study.id, body: "hello", problemId: null, spoiler: false },
      later(1),
    );
    await expect(hidePost(grace.id, text.id)).rejects.toBeInstanceOf(ForbiddenError);

    const { items } = await listFeed(grace.id);
    expect(items.map((i) => [i.kind, i.canEdit, i.canDelete, i.canHide])).toEqual([
      ["TEXT", true, true, false],
      ["SOLVE", false, false, true],
    ]);
    const adminView = await listFeed(ada.id);
    expect(adminView.items.map((i) => [i.kind, i.canDelete, i.canHide])).toEqual([
      ["TEXT", true, false],
      ["SOLVE", false, false],
    ]);
  });
});
