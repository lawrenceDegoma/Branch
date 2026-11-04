// Database-level invariants, exercised directly with Prisma so they hold even if application
// code is bypassed or buggy.
import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import {
  createPublishedRoadmap,
  createTestGroup,
  createTestUser,
  testRoadmapDefinition,
} from "@/test/factories";

describe("groups", () => {
  it("allows at most one admin per group", async () => {
    const [a, b, c] = await Promise.all([createTestUser(), createTestUser(), createTestUser()]);
    const group = await createTestGroup([
      { userId: a.id, role: "ADMIN" },
      { userId: b.id, role: "MEMBER" },
    ]);
    await expect(
      prisma.groupMembership.create({ data: { groupId: group.id, userId: c.id, role: "ADMIN" } }),
    ).rejects.toThrow();
    await expect(
      prisma.groupMembership.update({
        where: { groupId_userId: { groupId: group.id, userId: b.id } },
        data: { role: "ADMIN" },
      }),
    ).rejects.toThrow();
  });

  it("allows a user to belong to several groups, each with its own admin", async () => {
    const [a, b] = await Promise.all([createTestUser(), createTestUser()]);
    await createTestGroup([
      { userId: a.id, role: "ADMIN" },
      { userId: b.id, role: "MEMBER" },
    ]);
    await createTestGroup([
      { userId: b.id, role: "ADMIN" },
      { userId: a.id, role: "MEMBER" },
    ]);
    expect(await prisma.groupMembership.count({ where: { userId: a.id } })).toBe(2);
  });

  it("rejects blank or overlong group names", async () => {
    await expect(prisma.group.create({ data: { name: "   ", timezone: "UTC" } })).rejects.toThrow();
    await expect(
      prisma.group.create({ data: { name: "x".repeat(61), timezone: "UTC" } }),
    ).rejects.toThrow();
  });

  it("keeps invite use counts within their limit", async () => {
    const group = await createTestGroup([]);
    const base = { groupId: group.id, expiresAt: new Date(Date.now() + 86_400_000) };
    await expect(
      prisma.groupInvite.create({ data: { ...base, tokenHash: "a", maxUses: 0 } }),
    ).rejects.toThrow();
    const invite = await prisma.groupInvite.create({
      data: { ...base, tokenHash: "b", maxUses: 1 },
    });
    await prisma.groupInvite.update({ where: { id: invite.id }, data: { useCount: 1 } });
    await expect(
      prisma.groupInvite.update({ where: { id: invite.id }, data: { useCount: 2 } }),
    ).rejects.toThrow();
  });
});

describe("catalog", () => {
  it("requires kebab-case LeetCode slugs", async () => {
    await expect(
      prisma.problem.create({
        data: { leetcodeSlug: "Two Sum", title: "Two Sum", difficulty: "EASY", source: "USER" },
      }),
    ).rejects.toThrow();
  });

  it("allows no free alternative, or an https one of reasonable length", async () => {
    const problem = (slug: string, freeAlternativeUrl: string | null) =>
      prisma.problem.create({
        data: {
          leetcodeSlug: slug,
          title: slug,
          difficulty: "EASY",
          source: "SEED",
          premium: true,
          freeAlternativeUrl,
        },
      });
    await expect(problem("no-alternative", null)).resolves.toBeTruthy();
    await expect(problem("secure", "https://www.lintcode.com/problem/920/")).resolves.toBeTruthy();
    await expect(problem("insecure", "http://www.lintcode.com/problem/920/")).rejects.toThrow();
    await expect(problem("script", "javascript:alert(1)")).rejects.toThrow();
    await expect(problem("too-long", `https://example.test/${"a".repeat(300)}`)).rejects.toThrow();
  });
});

describe("completions", () => {
  it("records one canonical completion per user and problem", async () => {
    const [me, friend] = await Promise.all([createTestUser(), createTestUser()]);
    const version = await createPublishedRoadmap();
    const problemId = version.items[0]!.problemId;
    const completion = { problemId, source: "MANUAL" as const, completedAt: new Date() };

    await prisma.problemCompletion.create({ data: { ...completion, userId: me.id } });
    await expect(
      prisma.problemCompletion.create({ data: { ...completion, userId: me.id } }),
    ).rejects.toThrow();
    await prisma.problemCompletion.create({ data: { ...completion, userId: friend.id } });
  });
});

describe("roadmap versions", () => {
  it("rejects any change to a published version's content", async () => {
    const version = await createPublishedRoadmap();
    const item = version.items[0]!;
    const section = await prisma.roadmapSection.findFirstOrThrow({
      where: { versionId: version.id },
    });
    const extra = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "min-stack" } });

    await expect(
      prisma.roadmapItem.create({
        data: { versionId: version.id, sectionId: section.id, problemId: extra.id, position: 99 },
      }),
    ).rejects.toThrow(/published/);
    await expect(
      prisma.roadmapItem.update({ where: { id: item.id }, data: { position: 50 } }),
    ).rejects.toThrow(/published/);
    await expect(prisma.roadmapItem.delete({ where: { id: item.id } })).rejects.toThrow(
      /published/,
    );
    await expect(
      prisma.roadmapSection.update({ where: { id: section.id }, data: { title: "Renamed" } }),
    ).rejects.toThrow(/published/);
    await expect(
      prisma.roadmapSection.create({ data: { versionId: version.id, position: 9, title: "New" } }),
    ).rejects.toThrow(/published/);
  });

  it("keeps a published version published and numbered", async () => {
    const version = await createPublishedRoadmap();
    await expect(
      prisma.roadmapVersion.update({ where: { id: version.id }, data: { publishedAt: null } }),
    ).rejects.toThrow(/published/);
    await expect(
      prisma.roadmapVersion.update({ where: { id: version.id }, data: { number: 7 } }),
    ).rejects.toThrow(/published/);
  });

  it("lets a draft be edited until it is published, and allows one draft at a time", async () => {
    const published = await createPublishedRoadmap();
    const problem = await prisma.problem.findUniqueOrThrow({
      where: { leetcodeSlug: "min-stack" },
    });
    const draft = await prisma.roadmapVersion.create({
      data: { roadmapId: published.roadmapId, number: 2 },
    });
    const section = await prisma.roadmapSection.create({
      data: { versionId: draft.id, position: 0, title: "Stack" },
    });
    const item = await prisma.roadmapItem.create({
      data: { versionId: draft.id, sectionId: section.id, problemId: problem.id, position: 0 },
    });
    await prisma.roadmapItem.update({ where: { id: item.id }, data: { position: 1 } });

    await expect(
      prisma.roadmapVersion.create({ data: { roadmapId: published.roadmapId, number: 3 } }),
    ).rejects.toThrow();

    await prisma.roadmapVersion.update({
      where: { id: draft.id },
      data: { publishedAt: new Date() },
    });
    await expect(
      prisma.roadmapItem.update({ where: { id: item.id }, data: { position: 2 } }),
    ).rejects.toThrow(/published/);
  });

  it("keeps an item's section inside the same version", async () => {
    const a = await createPublishedRoadmap();
    const b = await prisma.roadmapVersion.create({ data: { roadmapId: a.roadmapId, number: 2 } });
    const sectionOfA = await prisma.roadmapSection.findFirstOrThrow({ where: { versionId: a.id } });
    const problem = await prisma.problem.findUniqueOrThrow({
      where: { leetcodeSlug: "min-stack" },
    });
    await expect(
      prisma.roadmapItem.create({
        data: { versionId: b.id, sectionId: sectionOfA.id, problemId: problem.id, position: 0 },
      }),
    ).rejects.toThrow();
  });

  it("deletes an unused roadmap with its published versions", async () => {
    const version = await createPublishedRoadmap();
    await prisma.roadmap.delete({ where: { id: version.roadmapId } });
    expect(await prisma.roadmapItem.count({ where: { versionId: version.id } })).toBe(0);
  });

  it("rejects curated roadmaps with an owner and share tokens without link visibility", async () => {
    const owner = await createTestUser();
    await expect(
      prisma.roadmap.create({ data: { kind: "CURATED", title: "X", ownerId: owner.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.roadmap.create({
        data: { kind: "CUSTOM", title: "X", ownerId: owner.id, shareToken: "t" },
      }),
    ).rejects.toThrow();
  });
});

describe("plans and assignments", () => {
  async function groupWithPlan() {
    const admin = await createTestUser();
    const group = await createTestGroup([{ userId: admin.id, role: "ADMIN" }]);
    const version = await createPublishedRoadmap();
    const plan = await prisma.groupRoadmapPlan.create({
      data: {
        groupId: group.id,
        roadmapVersionId: version.id,
        startDate: new Date("2026-11-02"),
        pacing: "PER_SECTION" as const,
      },
    });
    return { group, version, plan };
  }

  it("allows one active plan per group", async () => {
    const { group, version, plan } = await groupWithPlan();
    await expect(
      prisma.groupRoadmapPlan.create({
        data: {
          groupId: group.id,
          roadmapVersionId: version.id,
          startDate: new Date("2026-12-07"),
          pacing: "PER_SECTION" as const,
        },
      }),
    ).rejects.toThrow();

    await prisma.groupRoadmapPlan.update({
      where: { id: plan.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await prisma.groupRoadmapPlan.create({
      data: {
        groupId: group.id,
        roadmapVersionId: version.id,
        startDate: new Date("2026-12-07"),
        pacing: "PER_SECTION" as const,
      },
    });
  });

  it("requires archivedAt exactly when a plan is archived", async () => {
    const { plan } = await groupWithPlan();
    await expect(
      prisma.groupRoadmapPlan.update({ where: { id: plan.id }, data: { status: "ARCHIVED" } }),
    ).rejects.toThrow();
  });

  it("only assigns items from the plan's own roadmap version", async () => {
    const { version, plan } = await groupWithPlan();
    const other = await createPublishedRoadmap(
      testRoadmapDefinition({ slug: "other", title: "Other" }),
    );
    const own = version.items[0]!;
    const foreign = other.items[0]!;

    await prisma.weeklyAssignment.create({
      data: { planId: plan.id, versionId: version.id, roadmapItemId: own.id, weekNumber: 1 },
    });
    await expect(
      prisma.weeklyAssignment.create({
        data: { planId: plan.id, versionId: version.id, roadmapItemId: foreign.id, weekNumber: 1 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.weeklyAssignment.create({
        data: { planId: plan.id, versionId: other.id, roadmapItemId: foreign.id, weekNumber: 1 },
      }),
    ).rejects.toThrow();
  });

  it("keeps pacing and problems-per-week consistent", async () => {
    const { group, version, plan } = await groupWithPlan();
    await prisma.groupRoadmapPlan.update({
      where: { id: plan.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    const base = {
      groupId: group.id,
      roadmapVersionId: version.id,
      startDate: new Date("2026-11-02"),
    };
    await expect(
      prisma.groupRoadmapPlan.create({ data: { ...base, pacing: "PER_WEEK" } }),
    ).rejects.toThrow();
    await expect(
      prisma.groupRoadmapPlan.create({
        data: { ...base, pacing: "PER_WEEK", problemsPerWeek: 51 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.groupRoadmapPlan.create({
        data: { ...base, pacing: "PER_SECTION", problemsPerWeek: 3 },
      }),
    ).rejects.toThrow();
    await prisma.groupRoadmapPlan.create({
      data: { ...base, pacing: "PER_WEEK", problemsPerWeek: 4 },
    });
  });

  it("rejects week numbers below 1", async () => {
    const { version, plan } = await groupWithPlan();
    await expect(
      prisma.weeklyAssignment.create({
        data: {
          planId: plan.id,
          versionId: version.id,
          roadmapItemId: version.items[0]!.id,
          weekNumber: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it("protects a version that a plan uses from deletion", async () => {
    const { version } = await groupWithPlan();
    await expect(prisma.roadmap.delete({ where: { id: version.roadmapId } })).rejects.toThrow();
  });
});
