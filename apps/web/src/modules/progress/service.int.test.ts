import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { createPlan, endPlan } from "@/modules/plans/service";
import {
  createPublishedRoadmap,
  createTestGroup,
  createTestUser,
  testRoadmapDefinition,
} from "@/test/factories";
import { getGroupProgress, getHome, setCompletion } from "./service";

// Tuesday 2026-11-03, 15:00 in New York: week 1 of a plan starting Monday 2026-11-02.
const NOW = new Date("2026-11-03T20:00:00Z");
const WEEK_2 = new Date("2026-11-10T20:00:00Z");
const WEEK_5 = new Date("2026-12-01T20:00:00Z");
const twoAWeek = { mode: "PER_WEEK" as const, problemsPerWeek: 2 };

async function problemId(slug: string) {
  return (await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: slug } })).id;
}

/** A group whose plan has week 1: two-sum, valid-anagram · week 2: valid-parentheses. */
async function setup() {
  const [admin, member, outsider] = await Promise.all([
    createTestUser({ name: "Ada Admin" }),
    createTestUser({ name: "Grace Member" }),
    createTestUser(),
  ]);
  const group = await createTestGroup([
    { userId: admin.id, role: "ADMIN" },
    { userId: member.id, role: "MEMBER" },
  ]);
  const version = await createPublishedRoadmap();
  await createPlan(
    admin.id,
    group.id,
    { roadmapVersionId: version.id, startDate: "2026-11-02", pacing: twoAWeek },
    NOW,
  );
  const ids = {
    twoSum: await problemId("two-sum"),
    validAnagram: await problemId("valid-anagram"),
    validParentheses: await problemId("valid-parentheses"),
    groupAnagrams: await problemId("group-anagrams"),
  };
  return { admin, member, outsider, group, ids };
}

describe("marking a problem solved", () => {
  it("is idempotent: one completion, changed only the first time", async () => {
    const { member, ids } = await setup();
    expect(await setCompletion(member.id, ids.twoSum, true, NOW)).toEqual({ changed: true });
    expect(await setCompletion(member.id, ids.twoSum, true, NOW)).toEqual({ changed: false });
    const rows = await prisma.problemCompletion.findMany({ where: { userId: member.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ problemId: ids.twoSum, source: "MANUAL", completedAt: NOW });
  });

  it("keeps a single completion when duplicate requests race", async () => {
    const { member, ids } = await setup();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => setCompletion(member.id, ids.twoSum, true, NOW)),
    );
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect(await prisma.problemCompletion.count({ where: { userId: member.id } })).toBe(1);
  });

  it("can be undone, and undoing twice is harmless", async () => {
    const { member, ids } = await setup();
    await setCompletion(member.id, ids.twoSum, true, NOW);
    expect(await setCompletion(member.id, ids.twoSum, false)).toEqual({ changed: true });
    expect(await setCompletion(member.id, ids.twoSum, false)).toEqual({ changed: false });
    expect(await prisma.problemCompletion.count({ where: { userId: member.id } })).toBe(0);
  });

  it("refuses unknown and malformed problem IDs", async () => {
    const { member } = await setup();
    await expect(
      setCompletion(member.id, "0190f5b4-0000-7000-8000-000000000000", true),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(setCompletion(member.id, "not-a-uuid", true)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("belongs to the person, so ending the plan keeps it", async () => {
    const { admin, group, ids } = await setup();
    await setCompletion(admin.id, ids.twoSum, true, NOW);
    await endPlan(admin.id, group.id, NOW);
    const home = await getHome(admin.id, "UTC", NOW);
    expect(home.groups[0]!.plan).toBeNull();
    expect(home.summary.totalSolved).toBe(1);
  });
});

describe("group progress", () => {
  it("shows every member's standing to fellow members", async () => {
    const { admin, member, group, ids } = await setup();
    await setCompletion(admin.id, ids.twoSum, true, NOW);
    const progress = await getGroupProgress(member.id, group.id, NOW);
    expect(progress.members.map((m) => [m.name, m.isViewer])).toEqual([
      ["Grace Member", true],
      ["Ada Admin", false],
    ]);
    const adminRow = progress.members.find((m) => m.userId === admin.id)!;
    expect(adminRow.solvedProblemIds).toEqual([ids.twoSum]);
    expect(adminRow.standing).toMatchObject({
      solved: 1,
      total: 3,
      thisWeek: { total: 2, solved: 1 },
      position: 0.5,
      status: "on-pace",
    });
  });

  it("reveals only completions of problems assigned in the plan", async () => {
    const { admin, member, group, ids } = await setup();
    await setCompletion(admin.id, ids.groupAnagrams, true, NOW); // not in the plan
    const progress = await getGroupProgress(member.id, group.id, NOW);
    const adminRow = progress.members.find((m) => m.userId === admin.id)!;
    expect(adminRow.solvedProblemIds).toEqual([]);
    expect(adminRow.standing.solved).toBe(0);
  });

  it("is hidden from non-members", async () => {
    const { outsider, group } = await setup();
    await expect(getGroupProgress(outsider.id, group.id, NOW)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("keeps unfinished problems as backlog while the group moves on", async () => {
    const { member, group, ids } = await setup();
    const backlogOn = async (now: Date) =>
      (await getGroupProgress(member.id, group.id, now)).members[0]!.standing;

    expect(await backlogOn(NOW)).toMatchObject({ backlog: 0, status: "on-pace" });
    expect(await backlogOn(WEEK_2)).toMatchObject({ backlog: 2, status: "catching-up" });

    await setCompletion(member.id, ids.validAnagram, true, WEEK_2);
    expect((await backlogOn(WEEK_2)).backlog).toBe(1);
    // Weeks later, after the plan's last week, the rest is still there.
    expect((await backlogOn(WEEK_5)).backlog).toBe(2);

    const [entry] = (await getHome(member.id, "UTC", WEEK_5)).groups;
    expect(
      entry?.plan && entry.backlog.map((item) => [item.problem.leetcodeSlug, item.weekNumber]),
    ).toEqual([
      ["two-sum", 1],
      ["valid-parentheses", 2],
    ]);
  });

  it("recognizes work done ahead of the schedule", async () => {
    const { member, group, ids } = await setup();
    await setCompletion(member.id, ids.validParentheses, true, NOW); // week 2's problem
    const standing = (await getGroupProgress(member.id, group.id, NOW)).members[0]!.standing;
    expect(standing).toMatchObject({ ahead: 1, backlog: 0, status: "ahead" });
    expect((await getHome(member.id, "UTC", NOW)).summary.ahead).toBe(1);
  });
});

describe("one completion, many roadmaps", () => {
  it("updates every group and roadmap containing the problem, counted once", async () => {
    const { admin, member, group, ids } = await setup();
    // A second group following a different roadmap that also contains Two Sum.
    const other = await createTestGroup([{ userId: member.id, role: "ADMIN" }], {
      name: "Second group",
    });
    const second = await createPublishedRoadmap(
      testRoadmapDefinition({
        slug: "second-roadmap",
        title: "Second roadmap",
        sections: [{ title: "Mixed", problems: ["two-sum", "min-stack"] }],
      }),
    );
    await createPlan(
      member.id,
      other.id,
      { roadmapVersionId: second.id, startDate: "2026-11-02", pacing: twoAWeek },
      NOW,
    );

    await setCompletion(member.id, ids.twoSum, true, NOW);
    expect(await prisma.problemCompletion.count({ where: { userId: member.id } })).toBe(1);

    for (const groupId of [group.id, other.id]) {
      const progress = await getGroupProgress(member.id, groupId, NOW);
      expect(progress.members.find((m) => m.isViewer)!.solvedProblemIds).toEqual([ids.twoSum]);
    }
    // The admin of the first group sees it there, but learns nothing about the second group.
    const seenByAdmin = await getGroupProgress(admin.id, group.id, NOW);
    expect(seenByAdmin.members.find((m) => m.userId === member.id)!.standing.solved).toBe(1);
    await expect(getGroupProgress(admin.id, other.id, NOW)).rejects.toBeInstanceOf(NotFoundError);

    const home = await getHome(member.id, "UTC", NOW);
    expect(home.groups.map((g) => g.group.id)).toEqual([group.id, other.id]);
    for (const entry of home.groups) {
      const twoSum = entry.plan && entry.thisWeek.find((item) => item.problem.id === ids.twoSum);
      expect(twoSum).toMatchObject({ solved: true });
    }
    // Week 1 holds two-sum and valid-anagram in one group, two-sum and min-stack in the other.
    expect(home.summary).toMatchObject({
      thisWeek: { total: 3, solved: 1 },
      solvedThisWeek: 1,
      totalSolved: 1,
    });
  });
});

describe("home", () => {
  it("lists groups without a plan and the next week for working ahead", async () => {
    const { member, ids } = await setup();
    await createTestGroup([{ userId: member.id, role: "ADMIN" }], { name: "Empty group" });
    const home = await getHome(member.id, "UTC", NOW);
    expect(home.groups.map((g) => g.plan === null)).toEqual([false, true]);
    const planned = home.groups[0]!;
    expect(planned.plan && planned.nextWeek.map((item) => item.problem.id)).toEqual([
      ids.validParentheses,
    ]);
  });

  it("counts problems solved this week in the viewer's own timezone", async () => {
    const { member, ids } = await setup();
    // Sunday 23:30 in New York is already Monday in London.
    await setCompletion(member.id, ids.twoSum, true, new Date("2026-11-09T04:30:00Z"));
    const mondayInLondon = new Date("2026-11-09T12:00:00Z");
    expect((await getHome(member.id, "Europe/London", mondayInLondon)).summary.solvedThisWeek).toBe(
      1,
    );
    expect(
      (await getHome(member.id, "America/New_York", mondayInLondon)).summary.solvedThisWeek,
    ).toBe(0);
  });
});
