import { ProblemRow } from "@/components/plans/problem-row";
import { CompletionToggle } from "@/components/progress/completion-toggle";
import { EmptyState } from "@/components/states/empty-state";
import type { Practice } from "@/modules/review/practice";
import { RECENT_REVIEWS, type TopicStanding } from "@/modules/review/topics";

/** New problems in the topics the viewer's reviews say need work, each with the reason. */
export function PracticeSection({ practice, reviewed }: Omit<Practice, "standings">) {
  return (
    <section aria-labelledby="practice-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="practice-heading" className="text-base font-medium">
          Practice
        </h2>
        <p className="text-ink-muted">
          Problems you haven&apos;t solved, in topics your reviews say need work. Easiest first.
        </p>
      </div>
      {practice.length > 0 ? (
        <ul aria-label="Topics to practice" className="flex flex-col gap-3">
          {practice.map(({ topic, reason, problems }) => (
            <li key={topic.slug}>
              <article
                aria-labelledby={`practice-${topic.slug}`}
                className="rounded-xl bg-surface p-4"
              >
                <h3 id={`practice-${topic.slug}`} className="font-medium">
                  {topic.name}
                </h3>
                <p className="text-ink-muted">{reason}</p>
                {problems.length > 0 ? (
                  <ul aria-label={`Suggested ${topic.name} problems`} className="mt-1">
                    {problems.map((problem) => (
                      <ProblemRow
                        key={problem.id}
                        problem={problem}
                        leading={
                          <CompletionToggle
                            problemId={problem.id}
                            title={problem.title}
                            solved={problem.solved}
                          />
                        }
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2">
                    You&apos;ve solved every free {topic.name} problem in Branch. Your reviews will
                    keep bringing them back.
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={
            reviewed ? "No topics need practice right now" : "Suggestions come from your reviews"
          }
          description={
            reviewed
              ? `A topic shows up here when you struggle on at least half of your last ${RECENT_REVIEWS} reviews in it, or on two of them.`
              : "Once you've done a few reviews, topics you struggle with show up here with new problems to practice."
          }
        />
      )}
    </section>
  );
}

const statusText = (s: TopicStanding) =>
  s.status === "not-reviewed"
    ? "Not reviewed yet"
    : `Struggled on ${s.struggled} of your last ${s.reviews === 1 ? "review" : `${s.reviews} reviews`}`;

/** How each topic the viewer has worked on is going, from their solves and recent reviews. */
export function TopicsSection({ standings }: { standings: TopicStanding[] }) {
  if (standings.length === 0) return null;
  return (
    <section aria-labelledby="topics-heading" className="flex flex-col gap-3">
      <h2 id="topics-heading" className="text-base font-medium">
        Topics
      </h2>
      <ul aria-label="Your topics" className="flex flex-col rounded-xl bg-surface px-4 py-1">
        {standings.map((s) => (
          <li
            key={s.topic.slug}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-3 last:border-b-0"
          >
            <span className="flex min-w-48 flex-1 flex-wrap items-center gap-2">
              <span className="font-medium">{s.topic.name}</span>
              {s.status === "needs-practice" ? (
                <span className="inline-flex h-5 items-center rounded-full bg-raised px-2 text-xs font-medium whitespace-nowrap">
                  Needs practice
                </span>
              ) : null}
            </span>
            <span className="text-ink-muted tabular">
              {s.solved} of {s.total} solved · {statusText(s)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
