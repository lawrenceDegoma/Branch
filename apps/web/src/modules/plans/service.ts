import "server-only";
import { prisma, type Prisma } from "@branch/database";
import { isUniqueViolation } from "@/lib/db-errors";
import { DomainError, NotFoundError } from "@/lib/errors";
import { requireAdmin, requireMembership } from "@/modules/groups/access";
import { requireViewableRoadmap } from "@/modules/roadmaps/service";
import {
  daysBetween,
  dateInTimeZone,
  fromDbDate,
  toDbDate,
  weekNumberOn,
  type CalendarDate,
} from "@branch/shared/calendar";
import { generateAssignments, MAX_WEEK, type Pacing } from "@branch/shared/schedule";
import type { CreatePlanInput } from "./schemas";

// A group has at most one active plan: a published roadmap version, a start date, and the week
// each item is assigned to. Weeks are computed in the group's timezone (see schedule/calendar).

const MAX_START_DISTANCE_DAYS = 366;

const planChanged = () =>
  new DomainError("PLAN_CHANGED", "Someone just changed this group's plan. Reload and try again.");

function checkStartDate(startDate: CalendarDate, today: CalendarDate) {
  if (Math.abs(daysBetween(today, startDate)) > MAX_START_DISTANCE_DAYS) {
    throw new DomainError(
      "START_OUT_OF_RANGE",
      "Choose a start date within a year of today.",
      "startDate",
    );
  }
}

async function activePlan(db: typeof prisma | Prisma.TransactionClient, groupId: string) {
  return db.groupRoadmapPlan.findFirst({ where: { groupId, status: "ACTIVE" } });
}

function pacingOf(plan: {
  pacing: "PER_WEEK" | "PER_SECTION";
  problemsPerWeek: number | null;
}): Pacing {
  return plan.pacing === "PER_WEEK"
    ? { mode: "PER_WEEK", problemsPerWeek: plan.problemsPerWeek ?? 1 }
    : { mode: "PER_SECTION" };
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

/** Published roadmaps an admin may attach: curated, their own, and ones their groups use. */
export async function listPlanCandidates(userId: string) {
  const roadmaps = await prisma.roadmap.findMany({
    where: {
      versions: { some: { publishedAt: { not: null } } },
      OR: [
        { kind: "CURATED" },
        { ownerId: userId },
        {
          versions: { some: { plans: { some: { group: { memberships: { some: { userId } } } } } } },
        },
      ],
    },
    orderBy: [{ kind: "asc" }, { title: "asc" }],
    include: {
      versions: {
        where: { publishedAt: { not: null } },
        orderBy: { number: "desc" },
        take: 1,
        include: {
          sections: {
            orderBy: { position: "asc" },
            select: { _count: { select: { items: true } } },
          },
        },
      },
    },
  });
  return roadmaps.flatMap((roadmap) => {
    const version = roadmap.versions[0];
    if (!version) return [];
    return [
      {
        roadmapId: roadmap.id,
        title: roadmap.title,
        kind: roadmap.kind,
        versionId: version.id,
        versionNumber: version.number,
        sectionSizes: version.sections.map((s) => s._count.items),
      },
    ];
  });
}

const planInclude = {
  roadmapVersion: {
    select: { id: true, number: true, roadmap: { select: { id: true, title: true } } },
  },
  assignments: {
    include: {
      roadmapItem: {
        select: {
          id: true,
          position: true,
          section: { select: { title: true, position: true } },
          problem: {
            select: {
              id: true,
              leetcodeSlug: true,
              title: true,
              difficulty: true,
              premium: true,
              freeAlternativeUrl: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.GroupRoadmapPlanInclude;

type PlanRecord = Prisma.GroupRoadmapPlanGetPayload<{ include: typeof planInclude }>;

/** Lays a plan out by week, as seen on `now` in the group's timezone. */
function layoutPlan(plan: PlanRecord, timeZone: string, now: Date) {
  const startDate = fromDbDate(plan.startDate);
  const today = dateInTimeZone(now, timeZone);
  const ordered = [...plan.assignments].sort(
    (a, b) =>
      a.weekNumber - b.weekNumber ||
      a.roadmapItem.section.position - b.roadmapItem.section.position ||
      a.roadmapItem.position - b.roadmapItem.position,
  );
  const totalWeeks = Math.max(0, ...ordered.map((a) => a.weekNumber));
  const weeks = Array.from({ length: totalWeeks }, (_, index) => ({
    number: index + 1,
    items: ordered
      .filter((a) => a.weekNumber === index + 1)
      .map((a) => ({
        roadmapItemId: a.roadmapItem.id,
        sectionTitle: a.roadmapItem.section.title,
        problem: a.roadmapItem.problem,
      })),
  }));
  return {
    id: plan.id,
    roadmap: plan.roadmapVersion.roadmap,
    versionNumber: plan.roadmapVersion.number,
    startDate,
    pacing: pacingOf(plan),
    today,
    currentWeek: weekNumberOn(startDate, today),
    totalWeeks,
    weeks,
  };
}
export type PlanLayout = ReturnType<typeof layoutPlan>;

/** The group's active plan laid out by week, or null when none is set. */
export async function getGroupPlan(userId: string, groupId: string, now = new Date()) {
  const membership = await requireMembership(userId, groupId);
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { timezone: true },
  });
  const plan = await prisma.groupRoadmapPlan.findFirst({
    where: { groupId, status: "ACTIVE" },
    include: planInclude,
  });
  if (!plan) return { viewerRole: membership.role, timezone: group.timezone, plan: null };

  const newer = await prisma.roadmapVersion.findFirst({
    where: {
      roadmapId: plan.roadmapVersion.roadmap.id,
      publishedAt: { not: null },
      number: { gt: plan.roadmapVersion.number },
    },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  return {
    viewerRole: membership.role,
    timezone: group.timezone,
    plan: { ...layoutPlan(plan, group.timezone, now), newerVersionNumber: newer?.number ?? null },
  };
}
export type GroupPlan = NonNullable<Awaited<ReturnType<typeof getGroupPlan>>["plan"]>;

/** Every group the user belongs to, oldest membership first, with its active plan laid out. */
export async function listViewerPlans(userId: string, now = new Date()) {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          timezone: true,
          plans: { where: { status: "ACTIVE" }, take: 1, include: planInclude },
        },
      },
    },
  });
  return memberships.map(({ group }) => {
    const plan = group.plans[0];
    return {
      group: { id: group.id, name: group.name },
      plan: plan ? layoutPlan(plan, group.timezone, now) : null,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Changing the plan (admin only)
// ---------------------------------------------------------------------------------------------

/**
 * Attaches a published roadmap version to the group, replacing (archiving) any active plan.
 * Members' progress is unaffected: completions belong to people and problems, not plans.
 */
export async function createPlan(
  adminId: string,
  groupId: string,
  input: CreatePlanInput,
  now = new Date(),
) {
  await requireAdmin(adminId, groupId);
  const version = await prisma.roadmapVersion.findUnique({
    where: { id: input.roadmapVersionId },
    include: {
      roadmap: { select: { id: true, title: true } },
      sections: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" }, select: { id: true } } },
      },
    },
  });
  if (!version?.publishedAt) throw new NotFoundError("We couldn't find that roadmap.");
  await requireViewableRoadmap(adminId, version.roadmapId);

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { timezone: true },
  });
  checkStartDate(input.startDate, dateInTimeZone(now, group.timezone));

  const assignments = generateAssignments(
    version.sections.map((s) => ({ itemIds: s.items.map((i) => i.id) })),
    input.pacing,
  );
  if (assignments.some((a) => a.weekNumber > MAX_WEEK)) {
    throw new DomainError(
      "TOO_MANY_WEEKS",
      `That pace would take more than ${MAX_WEEK} weeks. Try more problems a week.`,
      "pacing",
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const previous = await activePlan(tx, groupId);
      if (previous) {
        await tx.groupRoadmapPlan.update({
          where: { id: previous.id },
          data: { status: "ARCHIVED", archivedAt: now },
        });
      }
      const plan = await tx.groupRoadmapPlan.create({
        data: {
          groupId,
          roadmapVersionId: version.id,
          startDate: toDbDate(input.startDate),
          pacing: input.pacing.mode,
          problemsPerWeek: input.pacing.mode === "PER_WEEK" ? input.pacing.problemsPerWeek : null,
          createdById: adminId,
        },
      });
      await tx.weeklyAssignment.createMany({
        data: assignments.map((a) => ({
          planId: plan.id,
          versionId: version.id,
          roadmapItemId: a.itemId,
          weekNumber: a.weekNumber,
        })),
      });
      await tx.groupAuditEvent.create({
        data: {
          groupId,
          action: "PLAN_CHANGED",
          actorId: adminId,
          metadata: {
            roadmapId: version.roadmap.id,
            roadmapTitle: version.roadmap.title,
            versionNumber: version.number,
            startDate: input.startDate,
            previousPlanId: previous?.id ?? null,
          },
        },
      });
      return { id: plan.id };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw planChanged();
    throw error;
  }
}

/** Moves the active plan to the newest published version of its roadmap, keeping start and pace. */
export async function upgradePlanVersion(adminId: string, groupId: string, now = new Date()) {
  await requireAdmin(adminId, groupId);
  const plan = await activePlan(prisma, groupId);
  if (!plan) throw new NotFoundError("This group doesn't have a roadmap yet.");
  const current = await prisma.roadmapVersion.findUniqueOrThrow({
    where: { id: plan.roadmapVersionId },
  });
  const latest = await prisma.roadmapVersion.findFirst({
    where: { roadmapId: current.roadmapId, publishedAt: { not: null } },
    orderBy: { number: "desc" },
  });
  if (!latest || latest.number <= current.number) {
    throw new DomainError("UP_TO_DATE", "This plan already uses the latest version.");
  }
  return createPlan(
    adminId,
    groupId,
    { roadmapVersionId: latest.id, startDate: fromDbDate(plan.startDate), pacing: pacingOf(plan) },
    now,
  );
}

export async function moveAssignment(
  adminId: string,
  groupId: string,
  roadmapItemId: string,
  weekNumber: number,
) {
  await requireAdmin(adminId, groupId);
  const plan = await activePlan(prisma, groupId);
  if (!plan) throw new NotFoundError("This group doesn't have a roadmap yet.");
  const result = await prisma.weeklyAssignment.updateMany({
    where: { planId: plan.id, roadmapItemId },
    data: { weekNumber },
  });
  if (result.count === 0) throw new NotFoundError("That problem isn't in this group's plan.");
}

export async function updatePlanStartDate(
  adminId: string,
  groupId: string,
  startDate: CalendarDate,
  now = new Date(),
) {
  await requireAdmin(adminId, groupId);
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { timezone: true },
  });
  checkStartDate(startDate, dateInTimeZone(now, group.timezone));
  await prisma.$transaction(async (tx) => {
    const plan = await activePlan(tx, groupId);
    if (!plan) throw new NotFoundError("This group doesn't have a roadmap yet.");
    await tx.groupRoadmapPlan.update({
      where: { id: plan.id },
      data: { startDate: toDbDate(startDate) },
    });
    await tx.groupAuditEvent.create({
      data: { groupId, action: "PLAN_CHANGED", actorId: adminId, metadata: { startDate } },
    });
  });
}

/** Stops using a roadmap without choosing another. Members keep their progress. */
export async function endPlan(adminId: string, groupId: string, now = new Date()) {
  await requireAdmin(adminId, groupId);
  await prisma.$transaction(async (tx) => {
    const plan = await activePlan(tx, groupId);
    if (!plan) throw new NotFoundError("This group doesn't have a roadmap yet.");
    await tx.groupRoadmapPlan.update({
      where: { id: plan.id },
      data: { status: "ARCHIVED", archivedAt: now },
    });
    await tx.groupAuditEvent.create({
      data: { groupId, action: "PLAN_CHANGED", actorId: adminId, metadata: { ended: true } },
    });
  });
}
