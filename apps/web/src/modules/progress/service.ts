import "server-only";
import { addDays, dateInTimeZone, isoWeekday } from "@branch/shared/calendar";
import { prisma } from "@branch/database";
import { isForeignKeyViolation } from "@/lib/db-errors";
import { NotFoundError } from "@/lib/errors";
import { getGroupPlan, listViewerPlans, type PlanLayout } from "@/modules/plans/service";
import { problemIdSchema } from "./schemas";
import { standingOn } from "./standing";

// Progress is derived, never stored: a person's single completion per problem (unique in the
// database) is matched against whichever plans and roadmaps contain that problem. Solving once
// therefore updates every group and roadmap at the same time.

const problemNotFound = () => new NotFoundError("We couldn't find that problem.");

// ---------------------------------------------------------------------------------------------
// Marking problems solved
// ---------------------------------------------------------------------------------------------

/**
 * Marks a problem solved or unsolved for the user. Idempotent: repeating a request (or racing it
 * from two tabs) leaves exactly one completion, and `changed` is true only for the request that
 * actually changed something.
 */
export async function setCompletion(
  userId: string,
  problemId: string,
  solved: boolean,
  now = new Date(),
): Promise<{ changed: boolean }> {
  if (!problemIdSchema.safeParse(problemId).success) throw problemNotFound();
  if (!solved) {
    const { count } = await prisma.problemCompletion.deleteMany({ where: { userId, problemId } });
    return { changed: count > 0 };
  }
  const problem = await prisma.problem.findUnique({
    where: { id: problemId },
    select: { id: true },
  });
  if (!problem) throw problemNotFound();
  try {
    // ON CONFLICT DO NOTHING on (userId, problemId).
    const { count } = await prisma.problemCompletion.createMany({
      data: [{ userId, problemId, source: "MANUAL", completedAt: now }],
      skipDuplicates: true,
    });
    return { changed: count > 0 };
  } catch (error) {
    if (isForeignKeyViolation(error)) throw problemNotFound();
    throw error;
  }
}

/** Which of `problemIds` the user has solved. */
export async function solvedAmong(userId: string, problemIds: string[]): Promise<Set<string>> {
  if (problemIds.length === 0) return new Set();
  const rows = await prisma.problemCompletion.findMany({
    where: { userId, problemId: { in: problemIds } },
    select: { problemId: true },
  });
  return new Set(rows.map((row) => row.problemId));
}

function planProblemIds(plan: PlanLayout): string[] {
  return [...new Set(plan.weeks.flatMap((week) => week.items.map((item) => item.problem.id)))];
}

// ---------------------------------------------------------------------------------------------
// A group's progress
// ---------------------------------------------------------------------------------------------

/**
 * The group's plan with every member's standing on it. Only completions of problems assigned in
 * the plan are read, so members never learn anything about each other's other progress.
 */
export async function getGroupProgress(userId: string, groupId: string, now = new Date()) {
  const { viewerRole, timezone, plan } = await getGroupPlan(userId, groupId, now);
  if (!plan) return { viewerRole, timezone, plan: null, members: [] };

  const memberships = await prisma.groupMembership.findMany({
    where: { groupId },
    orderBy: { joinedAt: "asc" },
    select: { userId: true, user: { select: { name: true } } },
  });
  const completions = await prisma.problemCompletion.findMany({
    where: {
      userId: { in: memberships.map((m) => m.userId) },
      problemId: { in: planProblemIds(plan) },
    },
    select: { userId: true, problemId: true },
  });
  const solvedBy = new Map<string, Set<string>>();
  for (const { userId: memberId, problemId } of completions) {
    if (!solvedBy.has(memberId)) solvedBy.set(memberId, new Set());
    solvedBy.get(memberId)!.add(problemId);
  }

  const members = memberships
    .map((m) => {
      const solved = solvedBy.get(m.userId) ?? new Set<string>();
      return {
        userId: m.userId,
        name: m.user.name,
        isViewer: m.userId === userId,
        standing: standingOn(plan.weeks, plan.currentWeek, (id) => solved.has(id)),
        solvedProblemIds: [...solved],
      };
    })
    // The viewer first, then everyone in the order they joined; never ranked by progress.
    .sort((a, b) => Number(b.isViewer) - Number(a.isViewer));

  return { viewerRole, timezone, plan, members };
}
export type GroupProgress = Awaited<ReturnType<typeof getGroupProgress>>;
export type MemberProgress = GroupProgress["members"][number];

// ---------------------------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------------------------

type PlanItem = PlanLayout["weeks"][number]["items"][number];
export type HomeItem = PlanItem & { weekNumber: number; solved: boolean };

/**
 * The viewer's week across all their groups: this week's problems, the next week's (for working
 * ahead), their backlog, and a summary. A problem shared by two groups appears in both, backed by
 * the same completion.
 */
export async function getHome(userId: string, timeZone: string, now = new Date()) {
  const entries = await listViewerPlans(userId, now);
  const plans = entries.flatMap((entry) => (entry.plan ? [entry.plan] : []));
  const solved = await solvedAmong(userId, [...new Set(plans.flatMap(planProblemIds))]);
  const isSolved = (id: string) => solved.has(id);

  const groups = entries.map(({ group, plan }) => {
    if (!plan) return { group, plan: null };
    const itemsOf = (weekNumbers: (n: number) => boolean): HomeItem[] =>
      plan.weeks
        .filter((week) => weekNumbers(week.number))
        .flatMap((week) =>
          week.items.map((item) => ({
            ...item,
            weekNumber: week.number,
            solved: isSolved(item.problem.id),
          })),
        );
    const current = plan.currentWeek;
    return {
      group,
      plan: {
        roadmap: plan.roadmap,
        versionNumber: plan.versionNumber,
        startDate: plan.startDate,
        currentWeek: current,
        totalWeeks: plan.totalWeeks,
      },
      standing: standingOn(plan.weeks, current, isSolved),
      thisWeek: itemsOf((n) => n === current),
      nextWeek: itemsOf((n) => n === current + 1),
      backlog: itemsOf((n) => n < current).filter((item) => !item.solved),
    };
  });

  // Summary counts are per problem, so a problem shared by two groups counts once.
  const unique = (items: HomeItem[]) => new Set(items.map((item) => item.problem.id));
  const withPlans = groups.flatMap((g) => (g.plan ? [g] : []));
  const thisWeek = unique(withPlans.flatMap((g) => g.thisWeek));
  const backlog = unique(withPlans.flatMap((g) => g.backlog));
  const ahead = new Set(
    plans.flatMap((plan) =>
      plan.weeks
        .filter((week) => week.number > plan.currentWeek)
        .flatMap((week) => week.items.map((item) => item.problem.id))
        .filter(isSolved),
    ),
  );

  // "Solved this week" uses the viewer's own calendar week (Monday start, their timezone).
  const today = dateInTimeZone(now, timeZone);
  const monday = addDays(today, -(isoWeekday(today) - 1));
  const [recent, totalSolved] = await Promise.all([
    prisma.problemCompletion.findMany({
      where: { userId, completedAt: { gte: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) } },
      select: { completedAt: true },
    }),
    prisma.problemCompletion.count({ where: { userId } }),
  ]);

  return {
    groups,
    summary: {
      thisWeek: { total: thisWeek.size, solved: [...thisWeek].filter(isSolved).length },
      backlog: backlog.size,
      ahead: ahead.size,
      solvedThisWeek: recent.filter((c) => dateInTimeZone(c.completedAt, timeZone) >= monday)
        .length,
      totalSolved,
    },
  };
}
export type HomeView = Awaited<ReturnType<typeof getHome>>;
export type HomeGroup = HomeView["groups"][number];
