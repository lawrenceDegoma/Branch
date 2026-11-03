import { prisma } from "@branch/database";
import { syncCatalog } from "@branch/database/catalog-import";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createPublishedRoadmap,
  createTestGroup,
  createTestUser,
  testCatalog,
} from "@/test/factories";
import {
  createCustomRoadmap,
  deleteRoadmap,
  discardDraft,
  findOrAddLeetCodeProblem,
  getDraft,
  getRoadmapView,
  getSharedRoadmapView,
  listRoadmapsForViewer,
  publishDraft,
  saveDraft,
  searchProblems,
  setLinkSharing,
  startDraft,
  updateRoadmapDetails,
} from "./service";

let ids: Record<string, string>;
beforeEach(async () => {
  await syncCatalog(prisma, testCatalog, "SEED");
  ids = Object.fromEntries((await prisma.problem.findMany()).map((p) => [p.leetcodeSlug, p.id]));
});

const details = { title: "My plan", description: null };

async function publishedCustom(ownerId: string) {
  const { id } = await createCustomRoadmap(ownerId, details);
  await publishDraft(ownerId, id, {
    sections: [{ title: "Arrays", problemIds: [ids["two-sum"]!, ids["valid-anagram"]!] }],
  });
  return id;
}

describe("visibility", () => {
  it("shows curated roadmaps to everyone", async () => {
    const version = await createPublishedRoadmap();
    const user = await createTestUser();
    const view = await getRoadmapView(user.id, version.roadmapId);
    expect(view.roadmap.kind).toBe("CURATED");
    expect(view.isOwner).toBe(false);
    expect(view.sections.map((s) => s.title)).toEqual(["Arrays", "Stack"]);
  });

  it("hides a custom roadmap from other people", async () => {
    const [owner, stranger] = await Promise.all([createTestUser(), createTestUser()]);
    const id = await publishedCustom(owner.id);
    await expect(getRoadmapView(stranger.id, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getRoadmapView(stranger.id, "not-a-uuid")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await listRoadmapsForViewer(stranger.id)).mine).toEqual([]);
  });

  it("shows a custom roadmap to members of a group whose plan uses it", async () => {
    const [owner, member, outsider] = await Promise.all([
      createTestUser(),
      createTestUser(),
      createTestUser(),
    ]);
    const id = await publishedCustom(owner.id);
    const group = await createTestGroup([
      { userId: owner.id, role: "ADMIN" },
      { userId: member.id, role: "MEMBER" },
    ]);
    const version = await prisma.roadmapVersion.findFirstOrThrow({ where: { roadmapId: id } });
    await prisma.groupRoadmapPlan.create({
      data: { groupId: group.id, roadmapVersionId: version.id, startDate: new Date("2026-11-02") },
    });

    expect((await getRoadmapView(member.id, id)).roadmap.title).toBe("My plan");
    expect((await listRoadmapsForViewer(member.id)).fromGroups.map((r) => r.id)).toEqual([id]);
    await expect(getRoadmapView(outsider.id, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateRoadmapDetails(member.id, id, details)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("never shows drafts to anyone but the owner", async () => {
    const owner = await createTestUser();
    const { id } = await createCustomRoadmap(owner.id, details);
    await saveDraft(owner.id, id, { sections: [{ title: "WIP", problemIds: [ids["two-sum"]!] }] });
    const view = await getRoadmapView(owner.id, id);
    expect(view.selectedVersion).toBeNull();
    expect(view.sections).toEqual([]);
    expect(view.hasDraft).toBe(true);
  });
});

describe("drafts and versions", () => {
  it("publishes a draft as version 1, then edits into version 2 without touching version 1", async () => {
    const owner = await createTestUser();
    const id = await publishedCustom(owner.id);
    expect((await getDraft(owner.id, id)).draft).toBeNull();

    await startDraft(owner.id, id);
    const draft = (await getDraft(owner.id, id)).draft!;
    expect(draft.number).toBe(2);
    expect(draft.sections[0]!.problems.map((p) => p.leetcodeSlug)).toEqual([
      "two-sum",
      "valid-anagram",
    ]);

    await publishDraft(owner.id, id, {
      sections: [
        { title: "Arrays", problemIds: [ids["two-sum"]!] },
        { title: "Stack", problemIds: [ids["min-stack"]!] },
      ],
    });
    const latest = await getRoadmapView(owner.id, id);
    expect(latest.versions.map((v) => v.number)).toEqual([2, 1]);
    expect(latest.sections.map((s) => s.title)).toEqual(["Arrays", "Stack"]);
    const first = await getRoadmapView(owner.id, id, 1);
    expect(first.sections[0]!.items.map((i) => i.problem.leetcodeSlug)).toEqual([
      "two-sum",
      "valid-anagram",
    ]);
  });

  it("starting a draft twice keeps one draft", async () => {
    const owner = await createTestUser();
    const id = await publishedCustom(owner.id);
    await Promise.all([startDraft(owner.id, id), startDraft(owner.id, id)]);
    expect(await prisma.roadmapVersion.count({ where: { roadmapId: id, publishedAt: null } })).toBe(
      1,
    );
  });

  it("refuses to publish incomplete drafts or duplicate problems", async () => {
    const owner = await createTestUser();
    const { id } = await createCustomRoadmap(owner.id, details);
    await expect(publishDraft(owner.id, id, { sections: [] })).rejects.toMatchObject({
      code: "NOT_PUBLISHABLE",
    });
    await expect(
      publishDraft(owner.id, id, {
        sections: [
          { title: "A", problemIds: [ids["two-sum"]!] },
          { title: "Empty", problemIds: [] },
        ],
      }),
    ).rejects.toThrow(/"Empty" has no problems/);
    await expect(
      saveDraft(owner.id, id, {
        sections: [{ title: "A", problemIds: [ids["two-sum"]!, ids["two-sum"]!] }],
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_PROBLEM" });
  });

  it("rejects saving after the draft is gone", async () => {
    const owner = await createTestUser();
    const id = await publishedCustom(owner.id);
    await expect(saveDraft(owner.id, id, { sections: [] })).rejects.toMatchObject({
      code: "NO_DRAFT",
    });
  });

  it("discards a draft and leaves published versions", async () => {
    const owner = await createTestUser();
    const id = await publishedCustom(owner.id);
    await startDraft(owner.id, id);
    await discardDraft(owner.id, id);
    expect(await prisma.roadmapVersion.count({ where: { roadmapId: id } })).toBe(1);
  });

  it("only the owner edits", async () => {
    const [owner, other] = await Promise.all([createTestUser(), createTestUser()]);
    const id = await publishedCustom(owner.id);
    await expect(startDraft(other.id, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const curated = await createPublishedRoadmap();
    await expect(startDraft(owner.id, curated.roadmapId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("deleting", () => {
  it("deletes an unused roadmap but not one a plan uses", async () => {
    const owner = await createTestUser();
    const unused = await publishedCustom(owner.id);
    await deleteRoadmap(owner.id, unused);
    expect(await prisma.roadmap.count({ where: { id: unused } })).toBe(0);

    const used = await publishedCustom(owner.id);
    const group = await createTestGroup([{ userId: owner.id, role: "ADMIN" }]);
    const version = await prisma.roadmapVersion.findFirstOrThrow({ where: { roadmapId: used } });
    await prisma.groupRoadmapPlan.create({
      data: { groupId: group.id, roadmapVersionId: version.id, startDate: new Date("2026-11-02") },
    });
    await expect(deleteRoadmap(owner.id, used)).rejects.toMatchObject({ code: "ROADMAP_IN_USE" });
  });
});

describe("sharing", () => {
  it("shares by link and stops when turned off", async () => {
    const [owner, friend] = await Promise.all([createTestUser(), createTestUser()]);
    const id = await publishedCustom(owner.id);
    await setLinkSharing(owner.id, id, true);
    const token = (await getRoadmapView(owner.id, id)).roadmap.shareToken!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);

    const shared = await getSharedRoadmapView(friend.id, token);
    expect(shared.roadmap.title).toBe("My plan");
    expect(shared.roadmap.shareToken).toBeNull();
    await expect(getRoadmapView(friend.id, id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    await setLinkSharing(owner.id, id, false);
    await expect(getSharedRoadmapView(friend.id, token)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("catalog lookups", () => {
  it("searches by title and by pasted URL", async () => {
    expect((await searchProblems("anagram")).map((p) => p.leetcodeSlug).sort()).toEqual([
      "group-anagrams",
      "valid-anagram",
    ]);
    expect(
      (await searchProblems("https://leetcode.com/problems/min-stack/"))[0]!.leetcodeSlug,
    ).toBe("min-stack");
    expect(await searchProblems("a")).toEqual([]);
  });

  it("finds existing problems and adds new ones as user-submitted", async () => {
    const user = await createTestUser();
    expect(await findOrAddLeetCodeProblem(user.id, "leetcode.com/problems/two-sum/")).toMatchObject(
      {
        status: "found",
        problem: { leetcodeSlug: "two-sum" },
      },
    );
    expect(
      await findOrAddLeetCodeProblem(user.id, "https://leetcode.com/problems/word-search/"),
    ).toEqual({
      status: "needs-details",
      slug: "word-search",
    });
    const added = await findOrAddLeetCodeProblem(
      user.id,
      "https://leetcode.com/problems/word-search/",
      {
        title: "Word Search",
        difficulty: "MEDIUM",
      },
    );
    expect(added).toMatchObject({ status: "found", problem: { leetcodeSlug: "word-search" } });
    expect(
      await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "word-search" } }),
    ).toMatchObject({
      source: "USER",
      createdById: user.id,
    });
    await expect(
      findOrAddLeetCodeProblem(user.id, "https://not-leetcode.test/x"),
    ).rejects.toMatchObject({
      field: "url",
    });
  });

  it("never duplicates a problem added twice at once", async () => {
    const [a, b] = await Promise.all([createTestUser(), createTestUser()]);
    const input = { title: "Word Search", difficulty: "MEDIUM" as const };
    await Promise.all([
      findOrAddLeetCodeProblem(a.id, "word-search", input),
      findOrAddLeetCodeProblem(b.id, "word-search", input),
    ]);
    expect(await prisma.problem.count({ where: { leetcodeSlug: "word-search" } })).toBe(1);
  });

  it("limits how many problems one person adds per day", async () => {
    const user = await createTestUser();
    await prisma.problem.createMany({
      data: Array.from({ length: 50 }, (_, i) => ({
        leetcodeSlug: `user-problem-${i}`,
        title: `Problem ${i}`,
        difficulty: "EASY" as const,
        source: "USER" as const,
        createdById: user.id,
      })),
    });
    await expect(
      findOrAddLeetCodeProblem(user.id, "word-search", {
        title: "Word Search",
        difficulty: "MEDIUM",
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
