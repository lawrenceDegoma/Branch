import "server-only";
import {
  addDays,
  dateInTimeZone,
  formatCalendarDate,
  fromDbDate,
  toDbDate,
  type CalendarDate,
} from "@branch/shared/calendar";
import { prisma, type Prisma } from "@branch/database";
import { DomainError, NotFoundError } from "@/lib/errors";
import {
  FIRST_REVIEW_DAYS,
  DEFAULT_EASE,
  nextReview,
  reviewChoices,
  type ReviewOutcome,
} from "./schedule";

// Reviews are the user's own: every function here takes the signed-in user's ID and touches only
// their rows. A schedule exists exactly while its problem is solved (the database deletes it with
// the completion), and reviewing never changes the completion.

/** How many due reviews the page shows at once; the rest wait their turn. */
export const DUE_SHOWN = 10;
const UPCOMING_SHOWN = 5;
const HISTORY_PAGE = 20;

const problemSelect = {
  id: true,
  title: true,
  leetcodeSlug: true,
  difficulty: true,
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
} satisfies Prisma.ProblemSelect;

type ProblemRow = Prisma.ProblemGetPayload<{ select: typeof problemSelect }>;
const toProblem = ({ tags, ...problem }: ProblemRow) => ({
  ...problem,
  topics: tags.map((t) => t.tag.name),
});
export type ReviewProblem = ReturnType<typeof toProblem>;

/**
 * Puts a newly solved problem in the user's review queue, due a few days from today in their
 * timezone. Runs inside the completion's transaction; a schedule that already exists is kept.
 */
export async function startReviews(
  tx: Prisma.TransactionClient,
  userId: string,
  problemId: string,
  now: Date,
) {
  const profile = await tx.profile.findUnique({ where: { userId }, select: { timezone: true } });
  const today = dateInTimeZone(now, profile?.timezone ?? "UTC");
  await tx.reviewSchedule.createMany({
    data: [
      {
        userId,
        problemId,
        dueOn: toDbDate(addDays(today, FIRST_REVIEW_DAYS)),
        intervalDays: FIRST_REVIEW_DAYS,
        ease: DEFAULT_EASE,
      },
    ],
    skipDuplicates: true,
  });
}

/** How many reviews are due today or earlier. */
export async function countDueReviews(userId: string, timeZone: string, now = new Date()) {
  const today = dateInTimeZone(now, timeZone);
  return prisma.reviewSchedule.count({ where: { userId, dueOn: { lte: toDbDate(today) } } });
}

/**
 * The Review page's queue: the reviews due now (oldest first, at most DUE_SHOWN), how many are
 * due in all, and the next few coming up. Each due review lists every outcome with when it would
 * bring the problem back.
 */
export async function getReviewQueue(userId: string, timeZone: string, now = new Date()) {
  const today = toDbDate(dateInTimeZone(now, timeZone));
  const include = {
    completion: { select: { completedAt: true, problem: { select: problemSelect } } },
  } satisfies Prisma.ReviewScheduleInclude;
  const order = [
    { dueOn: "asc" },
    { problemId: "asc" },
  ] satisfies Prisma.ReviewScheduleOrderByWithRelationInput[];
  const [due, dueCount, upcoming] = await Promise.all([
    prisma.reviewSchedule.findMany({
      where: { userId, dueOn: { lte: today } },
      orderBy: order,
      take: DUE_SHOWN,
      include,
    }),
    prisma.reviewSchedule.count({ where: { userId, dueOn: { lte: today } } }),
    prisma.reviewSchedule.findMany({
      where: { userId, dueOn: { gt: today } },
      orderBy: order,
      take: UPCOMING_SHOWN,
      include,
    }),
  ]);

  // The last outcome of each due problem, so a card can say how the previous review went.
  const latest = await prisma.reviewAttempt.findMany({
    where: { userId, problemId: { in: due.map((s) => s.problemId) } },
    orderBy: { id: "desc" },
    distinct: ["problemId"],
    select: { problemId: true, outcome: true },
  });
  const lastOutcome = new Map(latest.map((a) => [a.problemId, a.outcome]));

  const toItem = (s: (typeof due)[number]) => ({
    problem: toProblem(s.completion.problem),
    dueOn: fromDbDate(s.dueOn),
    solvedAt: s.completion.completedAt,
    reviewCount: s.reviewCount,
    lastReviewedAt: s.lastReviewedAt,
    lastOutcome: lastOutcome.get(s.problemId) ?? null,
  });
  return {
    due: due.map((s) => ({ ...toItem(s), choices: reviewChoices(s) })),
    dueCount,
    upcoming: upcoming.map(toItem),
  };
}
export type ReviewQueue = Awaited<ReturnType<typeof getReviewQueue>>;
export type DueReview = ReviewQueue["due"][number];

const alreadyReviewed = (dueOn: CalendarDate) =>
  new DomainError(
    "ALREADY_REVIEWED",
    `You've already reviewed this. It comes back on ${formatCalendarDate(dueOn)}.`,
  );

/**
 * Records how a due review went and schedules the next one. Only a due review can be rated, and
 * the update is conditional on the schedule being unchanged, so a double submit or a second tab
 * records one review, not two.
 */
export async function recordReview(
  userId: string,
  problemId: string,
  outcome: ReviewOutcome,
  timeZone: string,
  now = new Date(),
): Promise<{ title: string; dueOn: CalendarDate; days: number }> {
  const schedule = await prisma.reviewSchedule.findUnique({
    where: { userId_problemId: { userId, problemId } },
    include: { completion: { select: { problem: { select: { title: true } } } } },
  });
  if (!schedule) throw new NotFoundError("That problem isn't in your reviews.");
  const today = dateInTimeZone(now, timeZone);
  if (fromDbDate(schedule.dueOn) > today) throw alreadyReviewed(fromDbDate(schedule.dueOn));

  const next = nextReview(schedule, outcome);
  const dueOn = addDays(today, next.intervalDays);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.reviewSchedule.updateMany({
      where: { userId, problemId, dueOn: schedule.dueOn, reviewCount: schedule.reviewCount },
      data: {
        dueOn: toDbDate(dueOn),
        intervalDays: next.intervalDays,
        ease: next.ease,
        reviewCount: { increment: 1 },
        lastReviewedAt: now,
      },
    });
    if (count === 0) throw alreadyReviewed(dueOn);
    await tx.reviewAttempt.create({
      data: { userId, problemId, outcome, reviewedAt: now, intervalDays: next.intervalDays },
    });
  });
  return { title: schedule.completion.problem.title, dueOn, days: next.intervalDays };
}

/** The user's past reviews, newest first, paged by attempt ID (UUIDv7, so time order). */
export async function listReviewHistory(userId: string, { before }: { before?: string } = {}) {
  const rows = await prisma.reviewAttempt.findMany({
    where: { userId, ...(before ? { id: { lt: before } } : {}) },
    orderBy: { id: "desc" },
    take: HISTORY_PAGE + 1,
    select: {
      id: true,
      outcome: true,
      reviewedAt: true,
      intervalDays: true,
      problem: { select: problemSelect },
    },
  });
  const items = rows.slice(0, HISTORY_PAGE).map(({ problem, ...attempt }) => ({
    ...attempt,
    problem: toProblem(problem),
  }));
  return { items, nextCursor: rows.length > HISTORY_PAGE ? items.at(-1)!.id : null };
}
export type ReviewHistoryItem = Awaited<ReturnType<typeof listReviewHistory>>["items"][number];
