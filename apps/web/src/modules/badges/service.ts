import "server-only";
import { prisma, type BadgeKind } from "@branch/database";

// Milestones, earned once and kept: no streaks, nothing to lose (brand rule: no streak pressure,
// no performance shaming). Awards are checked whenever badges are shown, so they also catch up
// on progress made before badges existed.

export const BADGES: Record<
  BadgeKind,
  { label: string; how: string; /** Groups may see it (with sharing on). */ shown: boolean }
> = {
  FIRST_SOLVE: { label: "First solve", how: "Solve a problem.", shown: true },
  SOLVED_10: { label: "10 solved", how: "Solve 10 problems.", shown: true },
  SOLVED_50: { label: "50 solved", how: "Solve 50 problems.", shown: true },
  SOLVED_100: { label: "100 solved", how: "Solve 100 problems.", shown: true },
  WEEK_DONE: {
    label: "Finished a week",
    how: "Solve every problem in a week of a group's plan.",
    shown: true,
  },
  ROADMAP_DONE: {
    label: "Finished a roadmap",
    how: "Solve every problem in a group's plan.",
    shown: true,
  },
  // Reviews are private, so this one is only ever shown to its owner.
  REVIEWS_25: { label: "25 reviews", how: "Do 25 reviews.", shown: false },
};
export const BADGE_ORDER = Object.keys(BADGES) as BadgeKind[];

export type Award = { kind: BadgeKind; earnedAt: Date };

/** Awards anything newly reached, then returns each person's badges in display order. */
export async function syncBadges(
  userIds: string[],
  now = new Date(),
): Promise<Map<string, Award[]>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const [solveCounts, reviewCounts, memberships] = await Promise.all([
    prisma.problemCompletion.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _count: true,
    }),
    prisma.reviewAttempt.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: true }),
    prisma.groupMembership.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, groupId: true },
    }),
  ]);
  const solves = new Map(solveCounts.map((r) => [r.userId, r._count]));
  const reviews = new Map(reviewCounts.map((r) => [r.userId, r._count]));

  // Weeks and roadmaps finished, in the plans of the groups they're in.
  const plans = await prisma.groupRoadmapPlan.findMany({
    where: { groupId: { in: [...new Set(memberships.map((m) => m.groupId))] } },
    select: {
      groupId: true,
      assignments: { select: { weekNumber: true, roadmapItem: { select: { problemId: true } } } },
    },
  });
  const planProblems = [
    ...new Set(plans.flatMap((p) => p.assignments.map((a) => a.roadmapItem.problemId))),
  ];
  const completions = await prisma.problemCompletion.findMany({
    where: { userId: { in: ids }, problemId: { in: planProblems } },
    select: { userId: true, problemId: true },
  });
  const solvedBy = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!solvedBy.has(c.userId)) solvedBy.set(c.userId, new Set());
    solvedBy.get(c.userId)!.add(c.problemId);
  }
  const groupsOf = new Map<string, Set<string>>();
  for (const m of memberships) {
    if (!groupsOf.has(m.userId)) groupsOf.set(m.userId, new Set());
    groupsOf.get(m.userId)!.add(m.groupId);
  }

  const earned: { userId: string; kind: BadgeKind; earnedAt: Date }[] = [];
  for (const userId of ids) {
    const count = solves.get(userId) ?? 0;
    const kinds: BadgeKind[] = [];
    if (count >= 1) kinds.push("FIRST_SOLVE");
    if (count >= 10) kinds.push("SOLVED_10");
    if (count >= 50) kinds.push("SOLVED_50");
    if (count >= 100) kinds.push("SOLVED_100");
    if ((reviews.get(userId) ?? 0) >= 25) kinds.push("REVIEWS_25");
    const mine = solvedBy.get(userId) ?? new Set<string>();
    const myPlans = plans.filter(
      (p) => groupsOf.get(userId)?.has(p.groupId) && p.assignments.length > 0,
    );
    const weekDone = myPlans.some((p) => {
      const weeks = new Map<number, string[]>();
      for (const a of p.assignments)
        weeks.set(a.weekNumber, [...(weeks.get(a.weekNumber) ?? []), a.roadmapItem.problemId]);
      return [...weeks.values()].some((problems) => problems.every((id) => mine.has(id)));
    });
    if (weekDone) kinds.push("WEEK_DONE");
    if (myPlans.some((p) => p.assignments.every((a) => mine.has(a.roadmapItem.problemId)))) {
      kinds.push("ROADMAP_DONE");
    }
    earned.push(...kinds.map((kind) => ({ userId, kind, earnedAt: now })));
  }
  if (earned.length > 0) await prisma.badgeAward.createMany({ data: earned, skipDuplicates: true });

  const awards = await prisma.badgeAward.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, kind: true, earnedAt: true },
  });
  const result = new Map<string, Award[]>(ids.map((id) => [id, []]));
  for (const a of awards) result.get(a.userId)!.push({ kind: a.kind, earnedAt: a.earnedAt });
  for (const list of result.values())
    list.sort((a, b) => BADGE_ORDER.indexOf(a.kind) - BADGE_ORDER.indexOf(b.kind));
  return result;
}

/**
 * What a group sees next to each member's name: only for people sharing their solves, never
 * the private review badge, and only the most telling two (the top solve count, and a finished
 * roadmap or week).
 */
export async function badgesForGroup(
  members: { userId: string }[],
): Promise<Map<string, string[]>> {
  const sharing = await prisma.profile.findMany({
    where: { userId: { in: members.map((m) => m.userId) }, shareSolves: true },
    select: { userId: true },
  });
  const awards = await syncBadges(sharing.map((p) => p.userId));
  const shown = new Map<string, string[]>();
  for (const [userId, list] of awards) {
    const kinds = new Set(list.map((a) => a.kind).filter((k) => BADGES[k].shown));
    const solved = (["SOLVED_100", "SOLVED_50", "SOLVED_10", "FIRST_SOLVE"] as const).find((k) =>
      kinds.has(k),
    );
    const finished = kinds.has("ROADMAP_DONE")
      ? "ROADMAP_DONE"
      : kinds.has("WEEK_DONE")
        ? "WEEK_DONE"
        : null;
    shown.set(
      userId,
      [solved, finished].filter((k): k is BadgeKind => Boolean(k)).map((k) => BADGES[k].label),
    );
  }
  return shown;
}
