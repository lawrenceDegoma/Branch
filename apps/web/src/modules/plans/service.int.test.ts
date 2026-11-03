import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import {
  createPublishedRoadmap,
  createTestGroup,
  createTestUser,
  testRoadmapDefinition,
} from "@/test/factories";
import { createCustomRoadmap, publishDraft, startDraft } from "@/modules/roadmaps/service";
import {
  createPlan,
  endPlan,
  getGroupPlan,
  listPlanCandidates,
  moveAssignment,
  updatePlanStartDate,
  upgradePlanVersion,
} from "./service";

// Tuesday 2026-11-03, 15:00 in New York.
const NOW = new Date("2026-11-03T20:00:00Z");
const fourAWeek = { mode: "PER_WEEK" as const, problemsPerWeek: 2 };

async function setup() {
  const [admin, member, outsider] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);
  const group = await createTestGroup(
    [
      { userId: admin.id, role: "ADMIN" },
      { userId: member.id, role: "MEMBER" },
    ],
    { timezone: "America/New_York" },
  );
  const version = await createPublishedRoadmap(); // 3 items: two-sum, valid-anagram | valid-parentheses
  return { admin, member, outsider, group, version };
}

describe("creating a plan", () => {
  it("gives every member the same weekly schedule", async () => {
    const { admin, member, group, version } = await setup();
    await createPlan(
      admin.id,
      group.id,
      { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: fourAWeek },
      NOW,
    );

    const forAdmin = await getGroupPlan(admin.id, group.id, NOW);
    const forMember = await getGroupPlan(member.id, group.id, NOW);
    expect(forMember.plan).toEqual(forAdmin.plan);
    expect(forMember.plan).toMatchObject({
      startDate: "2026-11-02",
      today: "2026-11-03",
      currentWeek: 1,
      totalWeeks: 2,
      versionNumber: 1,
      newerVersionNumber: null,
    });
    expect(forMember.plan!.weeks.map((w) => w.items.map((i) => i.problem.leetcodeSlug))).toEqual([
      ["two-sum", "valid-anagram"],
      ["valid-parentheses"],
    ]);
  });

  it("schedules one section per week", async () => {
    const { admin, group, version } = await setup();
    await createPlan(
      admin.id,
      group.id,
      { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: { mode: "PER_SECTION" } },
      NOW,
    );
    const { plan } = await getGroupPlan(admin.id, group.id, NOW);
    expect(plan!.weeks.map((w) => w.items.length)).toEqual([2, 1]);
  });

  it("advances weeks on the group's calendar", async () => {
    const { admin, group, version } = await setup();
    await createPlan(
      admin.id,
      group.id,
      { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: fourAWeek },
      NOW,
    );
    // Sunday 23:30 in New York is still week 1; Monday 00:30 is week 2.
    expect(
      (await getGroupPlan(admin.id, group.id, new Date("2026-11-09T04:30:00Z"))).plan!.currentWeek,
    ).toBe(1);
    expect(
      (await getGroupPlan(admin.id, group.id, new Date("2026-11-09T05:30:00Z"))).plan!.currentWeek,
    ).toBe(2);
    expect(
      (await getGroupPlan(admin.id, group.id, new Date("2026-10-30T12:00:00Z"))).plan!.currentWeek,
    ).toBe(0);
  });

  it("lets only the admin create a plan, and hides the group from outsiders", async () => {
    const { member, outsider, group, version } = await setup();
    const input = { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: fourAWeek };
    await expect(createPlan(member.id, group.id, input, NOW)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(createPlan(outsider.id, group.id, input, NOW)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(getGroupPlan(outsider.id, group.id, NOW)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("refuses drafts and other people's private roadmaps", async () => {
    const { admin, outsider, group } = await setup();
    const { id: privateId } = await createCustomRoadmap(outsider.id, {
      title: "Mine",
      description: null,
    });
    const draft = await prisma.roadmapVersion.findFirstOrThrow({ where: { roadmapId: privateId } });
    const input = { roadmapVersionId: draft.id, startDate: "2026-11-02", pacing: fourAWeek };
    await expect(createPlan(admin.id, group.id, input, NOW)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const two = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
    await publishDraft(outsider.id, privateId, {
      sections: [{ title: "A", problemIds: [two.id] }],
    });
    await expect(createPlan(admin.id, group.id, input, NOW)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await listPlanCandidates(admin.id)).map((c) => c.title)).toEqual(["Test roadmap"]);
  });

  it("rejects start dates more than a year away", async () => {
    const { admin, group, version } = await setup();
    await expect(
      createPlan(
        admin.id,
        group.id,
        { roadmapVersionId: version.id, startDate: "2028-01-03", pacing: fourAWeek },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "START_OUT_OF_RANGE", field: "startDate" });
  });
});

describe("changing a plan", () => {
  it("replaces the active plan, archives the old one, and keeps completions", async () => {
    const { admin, member, group, version } = await setup();
    const first = await createPlan(
      admin.id,
      group.id,
      { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: fourAWeek },
      NOW,
    );
    await prisma.problemCompletion.create({
      data: {
        userId: member.id,
        problemId: version.items[0]!.problemId,
        source: "MANUAL",
        completedAt: NOW,
      },
    });
    const other = await createPublishedRoadmap(
      testRoadmapDefinition({ slug: "other", title: "Other" }),
    );
    await createPlan(
      admin.id,
      group.id,
      { roadmapVersionId: other.id, startDate: "2026-11-09", pacing: { mode: "PER_SECTION" } },
      NOW,
    );

    expect(
      await prisma.groupRoadmapPlan.findUniqueOrThrow({ where: { id: first.id } }),
    ).toMatchObject({ status: "ARCHIVED" });
    expect((await getGroupPlan(member.id, group.id, NOW)).plan).toMatchObject({
      roadmap: { title: "Other" },
      currentWeek: 0,
    });
    expect(await prisma.problemCompletion.count({ where: { userId: member.id } })).toBe(1);
    const audit = await prisma.groupAuditEvent.findMany({
      where: { groupId: group.id, action: "PLAN_CHANGED" },
    });
    expect(audit).toHaveLength(2);
  });

  it("keeps one active plan when two are created at once", async () => {
    const { admin, group, version } = await setup();
    const input = { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: fourAWeek };
    await Promise.allSettled([
      createPlan(admin.id, group.id, input, NOW),
      createPlan(admin.id, group.id, input, NOW),
    ]);
    expect(
      await prisma.groupRoadmapPlan.count({ where: { groupId: group.id, status: "ACTIVE" } }),
    ).toBe(1);
  });

  it("moves a problem to another week, admin only", async () => {
    const { admin, member, group, version } = await setup();
    await createPlan(
      admin.id,
      group.id,
      { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: fourAWeek },
      NOW,
    );
    const { plan } = await getGroupPlan(admin.id, group.id, NOW);
    const item = plan!.weeks[0]!.items[0]!;

    await expect(moveAssignment(member.id, group.id, item.roadmapItemId, 3)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await moveAssignment(admin.id, group.id, item.roadmapItemId, 3);
    const after = (await getGroupPlan(member.id, group.id, NOW)).plan!;
    expect(after.totalWeeks).toBe(3);
    expect(after.weeks[2]!.items.map((i) => i.problem.leetcodeSlug)).toEqual([
      item.problem.leetcodeSlug,
    ]);
    await expect(
      moveAssignment(admin.id, group.id, "0190a2c0-0000-7000-8000-000000000000", 1),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("changes the start date and the current week with it", async () => {
    const { admin, group, version } = await setup();
    await createPlan(
      admin.id,
      group.id,
      { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: fourAWeek },
      NOW,
    );
    await updatePlanStartDate(admin.id, group.id, "2026-10-26", NOW);
    expect((await getGroupPlan(admin.id, group.id, NOW)).plan).toMatchObject({
      startDate: "2026-10-26",
      currentWeek: 2,
    });
  });

  it("upgrades to a newer roadmap version with the same start and pace", async () => {
    const { admin, member, group } = await setup();
    const { id: roadmapId } = await createCustomRoadmap(admin.id, {
      title: "Ours",
      description: null,
    });
    const ids = Object.fromEntries(
      (await prisma.problem.findMany()).map((p) => [p.leetcodeSlug, p.id]),
    );
    await publishDraft(admin.id, roadmapId, {
      sections: [{ title: "A", problemIds: [ids["two-sum"]!] }],
    });
    const v1 = await prisma.roadmapVersion.findFirstOrThrow({ where: { roadmapId, number: 1 } });
    await createPlan(
      admin.id,
      group.id,
      {
        roadmapVersionId: v1.id,
        startDate: "2026-11-02",
        pacing: { mode: "PER_WEEK", problemsPerWeek: 1 },
      },
      NOW,
    );
    await expect(upgradePlanVersion(admin.id, group.id, NOW)).rejects.toMatchObject({
      code: "UP_TO_DATE",
    });

    await startDraft(admin.id, roadmapId);
    await publishDraft(admin.id, roadmapId, {
      sections: [{ title: "A", problemIds: [ids["two-sum"]!, ids["min-stack"]!] }],
    });
    expect((await getGroupPlan(member.id, group.id, NOW)).plan!.newerVersionNumber).toBe(2);

    await upgradePlanVersion(admin.id, group.id, NOW);
    const plan = (await getGroupPlan(member.id, group.id, NOW)).plan!;
    expect(plan).toMatchObject({
      versionNumber: 2,
      startDate: "2026-11-02",
      totalWeeks: 2,
      newerVersionNumber: null,
    });
    expect(plan.pacing).toEqual({ mode: "PER_WEEK", problemsPerWeek: 1 });
  });

  it("ends a plan", async () => {
    const { admin, member, group, version } = await setup();
    await createPlan(
      admin.id,
      group.id,
      { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: fourAWeek },
      NOW,
    );
    await expect(endPlan(member.id, group.id, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await endPlan(admin.id, group.id, NOW);
    expect((await getGroupPlan(member.id, group.id, NOW)).plan).toBeNull();
  });
});
