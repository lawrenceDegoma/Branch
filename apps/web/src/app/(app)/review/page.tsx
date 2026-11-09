import { formatCalendarDate } from "@branch/shared/calendar";
import Link from "next/link";
import { z } from "zod";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";
import { PracticeSection, TopicsSection } from "@/components/review/practice";
import { ReviewQueue, type ReviewCardData } from "@/components/review/review-queue";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, pluralize } from "@/lib/format";
import { requireViewer } from "@/modules/auth/session";
import { getPractice } from "@/modules/review/practice";
import { describeGap, OUTCOME_LABEL } from "@/modules/review/schedule";
import { reviewAttemptIdSchema } from "@/modules/review/schemas";
import {
  DUE_SHOWN,
  getReviewQueue,
  listReviewHistory,
  type DueReview,
} from "@/modules/review/service";

export const metadata = { title: "Review" };

const querySchema = z.object({ before: reviewAttemptIdSchema.optional().catch(undefined) });

/** The viewer's own review queue and history. Nobody else can see any of it. */
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await requireViewer();
  const { before } = querySchema.parse(await searchParams);
  const timeZone = profile.timezone;
  const [queue, history, practice] = await Promise.all([
    getReviewQueue(user.id, timeZone),
    listReviewHistory(user.id, { before }),
    getPractice(user.id),
  ]);

  const cards: ReviewCardData[] = queue.due.map((item: DueReview) => ({
    problem: item.problem,
    estimate: item.estimate
      ? `Your last solution: ${item.estimate.bound ? "at most" : "probably"} ${item.estimate.time} time and ${item.estimate.space} space.`
      : null,
    context:
      item.lastReviewedAt && item.lastOutcome
        ? `Last review ${formatDate(item.lastReviewedAt, timeZone)}: ${OUTCOME_LABEL[item.lastOutcome]}`
        : `Solved ${formatDate(item.solvedAt, timeZone)}`,
    choices: item.choices.map(({ outcome, days }) => ({
      outcome,
      label: OUTCOME_LABEL[outcome],
      when: describeGap(days),
    })),
  }));
  const next = queue.upcoming[0];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Review"
        description="Problems you've solved come back here on a schedule. Try each one again on LeetCode, then say how it went: the harder it was, the sooner it returns. Your reviews also point to topics worth more practice, and Solutions shows how your code performs. Only you see any of this."
      />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="due-heading" className="flex flex-col gap-3">
          <h2 id="due-heading" tabIndex={-1} className="text-base font-medium">
            Due today{" "}
            {queue.dueCount > 0 ? (
              <span className="ml-2 font-normal text-ink-muted tabular">{queue.dueCount}</span>
            ) : null}
          </h2>
          {queue.dueCount > DUE_SHOWN ? (
            <p className="text-ink-muted">
              Showing the first {DUE_SHOWN} of {queue.dueCount}. The rest appear as you go.
            </p>
          ) : null}
          <ReviewQueue items={cards} headingId="due-heading" />
          {cards.length === 0 ? (
            <EmptyState
              title={next ? "Nothing due" : "Nothing to review yet"}
              description={
                next
                  ? `Your next review is ${next.problem.title}, on ${formatCalendarDate(next.dueOn, { weekday: "short" })}.`
                  : "Problems you mark solved come back here a few days later."
              }
            />
          ) : null}
        </section>

        <PracticeSection practice={practice.practice} reviewed={practice.reviewed} />

        {queue.upcoming.length > 0 ? (
          <section aria-labelledby="upcoming-heading" className="flex flex-col gap-3">
            <h2 id="upcoming-heading" className="text-base font-medium">
              Coming up
            </h2>
            <ol className="flex flex-col rounded-xl bg-surface px-4 py-1">
              {queue.upcoming.map((item) => (
                <li
                  key={item.problem.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 font-medium">{item.problem.title}</span>
                  <span className="text-ink-muted tabular">
                    {formatCalendarDate(item.dueOn, { weekday: "short" })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <TopicsSection standings={practice.standings} />

        <section aria-labelledby="history-heading" className="flex flex-col gap-3">
          <h2 id="history-heading" className="text-base font-medium">
            {before ? "Older reviews" : "History"}
          </h2>
          {before ? (
            <Link
              href="/review"
              className={buttonVariants({ variant: "outline", className: "self-start" })}
            >
              Back to newest
            </Link>
          ) : null}
          {history.items.length > 0 ? (
            <ol aria-label="Past reviews" className="flex flex-col rounded-xl bg-surface px-4 py-1">
              {history.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-3 last:border-b-0"
                >
                  <span className="flex min-w-48 flex-1 flex-wrap items-center gap-2">
                    <span className="font-medium">{item.problem.title}</span>
                    <DifficultyPill difficulty={item.problem.difficulty} />
                  </span>
                  <span className="text-ink-muted">
                    {OUTCOME_LABEL[item.outcome]} ·{" "}
                    <time dateTime={item.reviewedAt.toISOString()}>
                      {formatDate(item.reviewedAt, timeZone)}
                    </time>{" "}
                    · next after {pluralize(item.intervalDays, "day")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-ink-muted">
              {before ? "You've reached your first review." : "Your reviews will be listed here."}
            </p>
          )}
          {history.nextCursor ? (
            <Link
              href={`/review?before=${history.nextCursor}`}
              className={buttonVariants({ variant: "outline", className: "self-center" })}
            >
              Older reviews
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}
