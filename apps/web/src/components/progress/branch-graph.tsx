import { formatCalendarDate } from "@branch/shared/calendar";
import { cn } from "@/lib/utils";
import type { PlanLayout } from "@/modules/plans/service";
import type { MemberProgress } from "@/modules/progress/service";
import { describeStanding } from "@/modules/progress/standing";

// The group's calendar is the main line; each member's progress branches off it and ends where
// their solved count reaches on the same week axis. The shaded column is the current week, so a
// branch inside it is on pace, short of it has backlog, and past it is ahead.
//
// Drawn with HTML and CSS (percentages along a shared track, rounded borders for the elbows) so
// lines stay crisp and nodes stay round at any width. Every row is the same height and there is
// no gap between rows, so the trunk reads as one line. The drawing is decorative; each row's text
// carries the same information.

const ROW =
  "grid h-12 grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)_4rem]";
const ELBOW = 10; // px radius of the curve where a branch leaves the trunk

const pct = (weeks: number, total: number) =>
  `${(Math.min(Math.max(weeks, 0), total) / total) * 100}%`;

function WeekBand({ plan }: { plan: Pick<PlanLayout, "currentWeek" | "totalWeeks"> }) {
  if (plan.currentWeek < 1 || plan.currentWeek > plan.totalWeeks) return null;
  return (
    <span
      className="absolute inset-y-0 bg-brand-soft/70"
      style={{
        left: pct(plan.currentWeek - 1, plan.totalWeeks),
        width: `${100 / plan.totalWeeks}%`,
      }}
    />
  );
}

export function BranchGraph({
  plan,
  members,
}: {
  plan: Pick<PlanLayout, "currentWeek" | "totalWeeks" | "startDate">;
  members: MemberProgress[];
}) {
  const total = Math.max(plan.totalWeeks, 1);
  const showTicks = total <= 30;
  const calendarLabel =
    plan.currentWeek === 0
      ? `Starts ${formatCalendarDate(plan.startDate)}`
      : plan.currentWeek > plan.totalWeeks
        ? "All weeks done"
        : `Week ${plan.currentWeek} of ${plan.totalWeeks}`;

  return (
    <ol aria-label="Progress by member" className="flex flex-col">
      <li className={ROW}>
        <div className="min-w-0">
          <p className="truncate font-medium">Group calendar</p>
          <p className="truncate text-xs text-ink-muted">{calendarLabel}</p>
        </div>
        <div aria-hidden="true" className="relative h-full">
          <WeekBand plan={plan} />
          {/* Trunk down to the members' branches. */}
          <span className="absolute top-1/2 bottom-0 left-0 w-0.5 -translate-x-1/2 bg-control" />
          <span className="absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 bg-control" />
          {showTicks
            ? Array.from({ length: total + 1 }, (_, week) => (
                <span
                  key={week}
                  className="absolute top-1/2 size-1.5 -translate-1/2 rounded-full bg-control"
                  style={{ left: pct(week, total) }}
                />
              ))
            : null}
        </div>
        <span />
      </li>
      {members.map((member, index) => {
        const last = index === members.length - 1;
        const { standing } = member;
        const tone = member.isViewer ? "bg-brand" : "bg-ink-faint";
        const end = pct(standing.position, total);
        return (
          <li key={member.userId} className={ROW}>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {member.name}
                {member.isViewer ? (
                  <span className="font-normal text-ink-muted"> (you)</span>
                ) : null}
              </p>
              <p className="truncate text-xs text-ink-muted">{describeStanding(standing)}</p>
            </div>
            <div aria-hidden="true" className="relative h-full">
              <WeekBand plan={plan} />
              {/* The trunk continues past this row unless it is the last branch. */}
              <span
                className="absolute top-0 left-0 w-0.5 -translate-x-1/2 bg-control"
                style={{ bottom: last ? `calc(50% + ${ELBOW}px)` : 0 }}
              />
              {/* The elbow: a quarter circle from the trunk into the branch. */}
              <span
                className={cn(
                  "absolute left-0 -translate-x-px rounded-bl-[10px] border-b-2 border-l-2",
                  member.isViewer ? "border-brand" : "border-ink-faint",
                )}
                style={{ bottom: "calc(50% - 1px)", width: ELBOW, height: ELBOW + 1 }}
              />
              <span
                className={cn("absolute top-1/2 h-0.5 -translate-y-1/2", tone)}
                style={{ left: ELBOW, width: `max(0px, calc(${end} - ${ELBOW}px))` }}
              />
              <span
                className={cn(
                  "absolute top-1/2 size-3 -translate-1/2 rounded-full ring-3 ring-surface",
                  tone,
                )}
                style={{ left: `max(${ELBOW}px, ${end})` }}
              />
            </div>
            <p className="text-right text-ink-muted tabular">
              <span className="text-ink">{standing.solved}</span>/{standing.total}
              <span className="sr-only"> solved</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function BranchGraphLegend() {
  return (
    <p className="text-xs text-ink-muted">
      Each branch shows how far someone has solved along the plan. The shaded column is this week.
    </p>
  );
}
