import "server-only";
import type { Prisma } from "@branch/database";

// Automatic posts follow the author's completions. Solving a problem, with "Share my solves" on,
// posts to each group whose active plan assigns it, plus "finished week N" or "finished the plan"
// when that solve completes one. Each post exists at most once per author (partial unique
// indexes), so repeated or racing solves never post twice. Undoing the solve withdraws the posts
// it made true; redoing it restores them in their original place rather than celebrating again.
// A post the author hid stays hidden either way.

type Tx = Prisma.TransactionClient;
type Announcement = Prisma.PostCreateManyInput & { kind: "SOLVE" | "WEEK_DONE" | "PLAN_DONE" };

/** Runs inside the completion's transaction, only when the completion actually changed. */
export async function syncAutomaticPosts(
  tx: Tx,
  userId: string,
  problemId: string,
  solved: boolean,
  now: Date,
) {
  if (solved) await announce(tx, userId, problemId, now);
  else await withdraw(tx, userId, problemId, now);
}

async function announce(tx: Tx, userId: string, problemId: string, now: Date) {
  const profile = await tx.profile.findUnique({
    where: { userId },
    select: { shareSolves: true },
  });
  if (!profile?.shareSolves) return;

  const plans = await tx.groupRoadmapPlan.findMany({
    where: {
      status: "ACTIVE",
      group: { memberships: { some: { userId } } },
      assignments: { some: { roadmapItem: { problemId } } },
    },
    select: {
      id: true,
      groupId: true,
      assignments: { select: { weekNumber: true, roadmapItem: { select: { problemId: true } } } },
    },
  });
  if (plans.length === 0) return;

  const planProblemIds = plans.flatMap((plan) =>
    plan.assignments.map((a) => a.roadmapItem.problemId),
  );
  const solved = new Set(
    (
      await tx.problemCompletion.findMany({
        where: { userId, problemId: { in: [...new Set(planProblemIds)] } },
        select: { problemId: true },
      })
    ).map((row) => row.problemId),
  );
  const allSolved = (assignments: (typeof plans)[number]["assignments"]) =>
    assignments.every((a) => solved.has(a.roadmapItem.problemId));

  const announcements: Announcement[] = [];
  // Posts that come back if an earlier undo withdrew them, but aren't new.
  const restoreOnly: Announcement[] = [];
  for (const plan of plans) {
    const base = { groupId: plan.groupId, authorId: userId, createdAt: now };
    announcements.push({ ...base, kind: "SOLVE", problemId });
    // A problem appears once per roadmap version, so it sits in exactly one week of the plan.
    const week = plan.assignments.find((a) => a.roadmapItem.problemId === problemId)!.weekNumber;
    const weekDone: Announcement = {
      ...base,
      kind: "WEEK_DONE",
      planId: plan.id,
      weekNumber: week,
    };
    if (allSolved(plan.assignments)) {
      // Finishing the plan says it all; no new post for its last week.
      announcements.push({ ...base, kind: "PLAN_DONE", planId: plan.id });
      restoreOnly.push(weekDone);
    } else if (allSolved(plan.assignments.filter((a) => a.weekNumber === week))) {
      announcements.push(weekDone);
    }
  }

  // ON CONFLICT DO NOTHING: anything already posted (shown, hidden, or withdrawn) is kept as is...
  await tx.post.createMany({ data: announcements, skipDuplicates: true });
  // ...then posts withdrawn by an earlier undo come back. Hidden ones stay hidden.
  await tx.post.updateMany({
    where: {
      authorId: userId,
      withdrawnAt: { not: null },
      OR: [...announcements, ...restoreOnly].map(
        ({ kind, groupId, problemId, planId, weekNumber }) =>
          kind === "SOLVE" ? { kind, groupId, problemId } : { kind, planId, weekNumber },
      ),
    },
    data: { withdrawnAt: null },
  });
}

/** Undoing a solve takes down every automatic post it made true, whatever the sharing setting. */
async function withdraw(tx: Tx, userId: string, problemId: string, now: Date) {
  const inPlan = { assignments: { some: { roadmapItem: { problemId } } } };
  const weekPosts = await tx.post.findMany({
    where: { authorId: userId, kind: "WEEK_DONE", withdrawnAt: null, plan: inPlan },
    select: {
      id: true,
      weekNumber: true,
      plan: {
        select: {
          assignments: { where: { roadmapItem: { problemId } }, select: { weekNumber: true } },
        },
      },
    },
  });
  const weekPostIds = weekPosts
    .filter((post) => post.plan?.assignments.some((a) => a.weekNumber === post.weekNumber))
    .map((post) => post.id);

  await tx.post.updateMany({
    where: {
      authorId: userId,
      withdrawnAt: null,
      OR: [
        { kind: "SOLVE", problemId },
        { kind: "PLAN_DONE", plan: inPlan },
        { id: { in: weekPostIds } },
      ],
    },
    data: { withdrawnAt: now },
  });
}
