import { Check } from "lucide-react";
import Link from "next/link";
import { planPosition } from "@/components/plans/plan-format";
import { ProblemRow } from "@/components/plans/problem-row";
import { CompletionToggle } from "@/components/progress/completion-toggle";
import { pluralize } from "@/lib/format";
import type { HomeGroup, HomeItem } from "@/modules/progress/service";

type PlannedGroup = Extract<HomeGroup, { plan: NonNullable<HomeGroup["plan"]> }>;

function ItemList({
  items,
  label,
  showWeek,
}: {
  items: HomeItem[];
  label: string;
  showWeek?: boolean;
}) {
  return (
    <ul aria-label={label} className="divide-y divide-rule">
      {items.map((item) => (
        <ProblemRow
          key={item.roadmapItemId}
          problem={item.problem}
          sectionTitle={item.sectionTitle}
          leading={
            <CompletionToggle
              problemId={item.problem.id}
              title={item.problem.title}
              solved={item.solved}
            />
          }
        >
          {showWeek ? (
            <span className="text-xs text-ink-muted tabular">Week {item.weekNumber}</span>
          ) : null}
        </ProblemRow>
      ))}
    </ul>
  );
}

/** One group's current week on Home, with next week tucked away for working ahead. */
export function GroupWeek({ entry }: { entry: PlannedGroup }) {
  const { group, plan, thisWeek, nextWeek } = entry;
  const position = planPosition(plan);
  const solved = thisWeek.filter((item) => item.solved).length;
  const headingId = `home-group-${group.id}`;
  const weekDone = thisWeek.length > 0 && solved === thisWeek.length;
  const upcoming = plan.currentWeek === 0 ? "Week 1" : "Next week";

  return (
    <section aria-labelledby={headingId} className="rounded-xl bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="text-base font-medium">
          <Link href={`/groups/${group.id}`} className="underline-offset-4 hover:underline">
            {group.name}
          </Link>
        </h3>
        {thisWeek.length > 0 ? (
          <p className="text-ink-muted tabular">
            {solved} of {thisWeek.length} solved
          </p>
        ) : null}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-ink-muted">
        {position.isLive ? (
          <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
        ) : null}
        <span className="text-ink">{position.label}</span>
        <span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·{" "}
          </span>
          {plan.roadmap.title}
        </span>
      </p>

      {thisWeek.length > 0 ? (
        <div className="mt-3">
          <ItemList items={thisWeek} label={`${group.name}: this week`} />
        </div>
      ) : position.isLive ? (
        <p className="mt-3 text-ink-muted">No problems this week. A breather.</p>
      ) : null}
      {weekDone ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand-ink">
          <Check aria-hidden="true" className="size-4" />
          Week {plan.currentWeek} done.
        </p>
      ) : null}

      {nextWeek.length > 0 ? (
        <details className="group mt-3 border-t border-line pt-3">
          <summary className="cursor-pointer text-ink-muted marker:text-ink-faint hover:text-ink">
            {upcoming}{" "}
            <span className="tabular">
              · {pluralize(nextWeek.length, "problem")}
              {nextWeek.some((item) => item.solved)
                ? `, ${nextWeek.filter((item) => item.solved).length} solved early`
                : ""}
            </span>
          </summary>
          <div className="mt-2">
            <ItemList items={nextWeek} label={`${group.name}: ${upcoming.toLowerCase()}`} />
          </div>
        </details>
      ) : null}
    </section>
  );
}

/** Earlier weeks' unsolved problems, by group. They stay until solved. */
export function Backlog({ groups }: { groups: PlannedGroup[] }) {
  const withBacklog = groups.filter((g) => g.backlog.length > 0);
  if (withBacklog.length === 0) return null;
  return (
    <section aria-labelledby="backlog-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="backlog-heading" className="text-base font-medium">
          Backlog
        </h2>
        <p className="text-ink-muted">
          Problems from earlier weeks stay here until you solve them, at your own pace.
        </p>
      </div>
      {withBacklog.map((entry) => (
        <div key={entry.group.id} className="rounded-xl bg-surface p-4 sm:p-5">
          <h3 className="font-medium">
            {entry.group.name}{" "}
            <span className="font-normal text-ink-muted tabular">{entry.backlog.length}</span>
          </h3>
          <div className="mt-1">
            <ItemList items={entry.backlog} label={`${entry.group.name}: backlog`} showWeek />
          </div>
        </div>
      ))}
    </section>
  );
}

export function isPlanned(entry: HomeGroup): entry is PlannedGroup {
  return entry.plan !== null;
}
