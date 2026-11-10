import { ConfirmAction } from "@/components/forms/confirm-action";
import { ProgressBar } from "@/components/progress/progress-bar";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";
import { PageHeader } from "@/components/shell/page-header";
import { CountBars } from "@/components/stats/count-bars";
import { WeekColumns } from "@/components/stats/week-columns";
import { formatDateTime, pluralize } from "@/lib/format";
import { requireViewer } from "@/modules/auth/session";
import { OUTCOME_LABEL } from "@/modules/review/schedule";
import { getStats } from "@/modules/stats/service";
import { deleteStudyAction } from "@/modules/study/actions";
import { formatStudyTime, formatTimeSpent } from "@/modules/study/duration";

export const metadata = { title: "Your stats" };

const DIFFICULTY_LABEL = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;

/** Private: the viewer's own progress over time. No streaks, rankings, or comparisons. */
export default async function StatsPage() {
  const { user, profile } = await requireViewer();
  const stats = await getStats(user.id, profile.timezone);
  const solvedInWeeks = stats.solved.byWeek.reduce((sum, w) => sum + w.value, 0);
  const studiedInWeeks = stats.study.byWeek.reduce((sum, w) => sum + w.value, 0);
  const minutes = (value: number) => formatStudyTime(value * 60_000);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Your stats"
        description="Your progress over time, counted in your time zone. Only you see this page."
      />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="solving-heading" className="flex flex-col gap-4">
          <h2 id="solving-heading" className="text-base font-medium">
            Solving
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-surface p-4">
              <dt className="text-xs text-ink-muted">Solved in total</dt>
              <dd className="text-2xl font-semibold">{stats.solved.total}</dd>
            </div>
            {stats.solved.byDifficulty.map(({ difficulty, count }) => (
              <div key={difficulty} className="rounded-xl bg-surface p-4">
                <dt>
                  <DifficultyPill difficulty={difficulty} />
                </dt>
                <dd className="mt-1 text-2xl font-semibold">{count}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-xl bg-surface p-4 sm:p-5">
            <h3 className="mb-2 font-medium">Solved each week</h3>
            <WeekColumns
              id="solved-weeks"
              data={stats.solved.byWeek}
              format={(value) => String(value)}
              unit="Problems solved"
              summary={`Problems solved each week for the last ${stats.weeksShown} weeks: ${solvedInWeeks} in all, ${stats.solved.byWeek.at(-1)?.value ?? 0} this week.`}
            />
          </div>
        </section>

        <section aria-labelledby="time-heading" className="flex flex-col gap-4">
          <h2 id="time-heading" className="text-base font-medium">
            Time
          </h2>
          <div className="rounded-xl bg-surface p-4 sm:p-5">
            <h3 className="mb-2 font-medium">Studied each week</h3>
            <WeekColumns
              id="study-weeks"
              data={stats.study.byWeek}
              format={minutes}
              unit="Time studied"
              summary={`Time studied each week for the last ${stats.weeksShown} weeks: ${minutes(studiedInWeeks)} in all, ${minutes(stats.study.byWeek.at(-1)?.value ?? 0)} this week.`}
            />
          </div>
          <div className="rounded-xl bg-surface p-4 sm:p-5">
            <h3 className="font-medium">Typical time per problem</h3>
            {stats.times.length > 0 ? (
              <dl className="mt-3 flex flex-col gap-2">
                {stats.times.map(({ difficulty, medianSeconds, count }) => (
                  <div key={difficulty} className="flex flex-wrap items-baseline gap-x-2">
                    <dt className="w-20 text-ink-muted">{DIFFICULTY_LABEL[difficulty]}</dt>
                    <dd>
                      <span className="font-medium">{formatTimeSpent(medianSeconds)}</span>{" "}
                      <span className="text-ink-muted">
                        (the middle of {pluralize(count, "timed solve")})
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-1 text-ink-muted">
                The extension&apos;s problem timer (version 1.2.0) times each problem you solve on
                LeetCode or neetcode.io. Your typical times show here.
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="topics-heading" className="flex flex-col gap-3">
          <h2 id="topics-heading" className="text-base font-medium">
            Topics
          </h2>
          {stats.topics.length > 0 ? (
            <ul
              aria-label="Your topics"
              className="flex flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5"
            >
              {stats.topics.map(({ topic, solved, total, status }) => (
                <li key={topic.slug} className="flex flex-col gap-1.5">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">{topic.name}</span>
                    <span className="text-ink-muted tabular">
                      {solved} of {total}
                      {status === "needs-practice" ? " · Needs practice" : ""}
                    </span>
                  </p>
                  <ProgressBar value={solved} total={total} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">Topics show up once you&apos;ve solved a problem.</p>
          )}
        </section>

        <section aria-labelledby="reviews-heading" className="flex flex-col gap-3">
          <h2 id="reviews-heading" className="text-base font-medium">
            Reviews in the last {stats.reviews.days} days
          </h2>
          {stats.reviews.total > 0 ? (
            <div className="rounded-xl bg-surface p-4 sm:p-5">
              <CountBars
                label="How your reviews went"
                rows={stats.reviews.byOutcome.map(({ outcome, count }) => ({
                  name: OUTCOME_LABEL[outcome],
                  count,
                }))}
              />
            </div>
          ) : (
            <p className="text-ink-muted">No reviews in the last {stats.reviews.days} days.</p>
          )}
        </section>

        <section aria-labelledby="sessions-heading" className="flex flex-col gap-3">
          <h2 id="sessions-heading" tabIndex={-1} className="text-base font-medium">
            Study sessions
          </h2>
          {stats.study.sessions.length > 0 ? (
            <>
              <ul
                aria-label="Your latest study sessions"
                className="flex flex-col rounded-xl bg-surface"
              >
                {stats.study.sessions.map((session) => {
                  const when = formatDateTime(session.startedAt, profile.timezone);
                  return (
                    <li
                      key={session.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 first:border-t-0"
                    >
                      <div>
                        <p className="font-medium">
                          {formatStudyTime(session.endedAt.getTime() - session.startedAt.getTime())}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {when}
                          {session.autoStopped ? " · stopped automatically" : ""}
                          {session.shared > 0
                            ? ` · shared to ${pluralize(session.shared, "group")}`
                            : ""}
                        </p>
                      </div>
                      <ConfirmAction
                        action={deleteStudyAction}
                        fields={{ sessionId: session.id }}
                        focusAfterRemoval="sessions-heading"
                        trigger="Delete"
                        triggerName={`Delete the session from ${when}`}
                        title="Delete this session?"
                        description={
                          session.shared > 0
                            ? "It's removed from your time, and the posts that shared it are deleted too."
                            : "It's removed from your time."
                        }
                        confirmLabel="Delete session"
                        pendingLabel="Deleting…"
                        destructive
                      />
                    </li>
                  );
                })}
              </ul>
              {stats.study.sessions.length === stats.study.sessionsShown ? (
                <p className="text-xs text-ink-muted">Your latest {stats.study.sessionsShown}.</p>
              ) : null}
            </>
          ) : (
            <p className="text-ink-muted">
              Sessions you time with the study timer on Home show up here.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
