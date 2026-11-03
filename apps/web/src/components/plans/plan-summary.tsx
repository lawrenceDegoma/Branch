import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import type { GroupPlan } from "@/modules/plans/service";
import { paceLabel, planPosition } from "./plan-format";
import { ProblemRow } from "./problem-row";

/** The group page's roadmap block: where the group is, and this week's problems. */
export function PlanSummary({
  groupId,
  plan,
  isAdmin,
}: {
  groupId: string;
  plan: GroupPlan | null;
  isAdmin: boolean;
}) {
  if (!plan) {
    return (
      <section aria-labelledby="roadmap-heading" className="rounded-xl bg-surface p-4 sm:p-5">
        <h2 id="roadmap-heading" className="mb-4 text-base font-medium">
          Roadmap
        </h2>
        {isAdmin ? (
          <EmptyState
            title="Choose a roadmap"
            description="Pick a list and a start date, and Branch spreads the problems across weeks for everyone."
            action={
              <Link href={`/groups/${groupId}/plan/new`} className={buttonVariants()}>
                Choose a roadmap
              </Link>
            }
          />
        ) : (
          <p className="text-ink-muted">The group admin hasn&apos;t chosen a roadmap yet.</p>
        )}
      </section>
    );
  }

  const position = planPosition(plan);
  const week = position.featuredWeek ? plan.weeks[position.featuredWeek - 1] : null;

  return (
    <section aria-labelledby="roadmap-heading" className="rounded-xl bg-surface p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="roadmap-heading" className="text-base font-medium">
          <Link
            href={`/roadmaps/${plan.roadmap.id}?version=${plan.versionNumber}`}
            className="underline-offset-4 hover:underline"
          >
            {plan.roadmap.title}
          </Link>
        </h2>
        <Link
          href={`/groups/${groupId}/plan`}
          className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Full schedule
        </Link>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-ink-muted">
        {position.isLive ? (
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
        ) : null}
        <span className="text-ink">{position.label}</span>
        {/* The separator only shows when both fit on one line, so a wrap never starts with "·". */}
        <span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·{" "}
          </span>
          {paceLabel(plan.pacing)}
        </span>
      </p>
      {week ? (
        week.items.length > 0 ? (
          <ul className="mt-3 divide-y divide-rule" aria-label={`Week ${week.number} problems`}>
            {week.items.map((item) => (
              <ProblemRow
                key={item.roadmapItemId}
                problem={item.problem}
                sectionTitle={item.sectionTitle}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ink-muted">No problems this week. A breather.</p>
        )
      ) : null}
    </section>
  );
}
