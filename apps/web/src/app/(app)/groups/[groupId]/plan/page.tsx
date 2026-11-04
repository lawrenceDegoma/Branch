import { formatCalendarDate, formatWeekRange } from "@branch/shared/calendar";
import { MAX_WEEK } from "@branch/shared/schedule";
import Link from "next/link";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { MoveWeekForm } from "@/components/plans/move-week-form";
import { paceLabel, planPosition } from "@/components/plans/plan-format";
import { ProblemRow } from "@/components/plans/problem-row";
import { CompletionToggle } from "@/components/progress/completion-toggle";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import { getGroupOverview } from "@/modules/groups/service";
import { endPlanAction, upgradePlanAction } from "@/modules/plans/actions";
import { getGroupProgress } from "@/modules/progress/service";
import { StartDateForm } from "./start-date-form";

export const metadata = { title: "Schedule" };

export default async function PlanPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { user } = await requireViewer();
  const { groupId } = await params;
  const [group, { plan, viewerRole, members }] = await Promise.all([
    orNotFound(getGroupOverview(user.id, groupId)),
    orNotFound(getGroupProgress(user.id, groupId)),
  ]);
  const isAdmin = viewerRole === "ADMIN";
  const groupLink = (
    <Link
      href={`/groups/${group.id}`}
      className="underline-offset-4 hover:text-ink hover:underline"
    >
      {group.name}
    </Link>
  );

  if (!plan) {
    return (
      <div className="max-w-4xl">
        <PageHeader title="Schedule" description={groupLink} />
        <EmptyState
          title="No roadmap yet"
          description={
            isAdmin
              ? "Choose a roadmap to build the weekly schedule."
              : "The group admin hasn't chosen a roadmap yet."
          }
          action={
            isAdmin ? (
              <Link href={`/groups/${group.id}/plan/new`} className={buttonVariants()}>
                Choose a roadmap
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const position = planPosition(plan);
  const solved = new Set(members.find((m) => m.isViewer)?.solvedProblemIds);
  const weekOptions = Math.min(MAX_WEEK, plan.totalWeeks + 4);

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Schedule"
        description={groupLink}
        actions={
          isAdmin ? (
            <Link
              href={`/groups/${group.id}/plan/new`}
              className={buttonVariants({ variant: "outline" })}
            >
              Change roadmap
            </Link>
          ) : undefined
        }
      />

      <section
        aria-label="Plan details"
        className="mb-6 flex flex-col gap-4 rounded-xl bg-surface p-4 sm:p-5"
      >
        <div>
          <p className="text-base font-medium">
            <Link
              href={`/roadmaps/${plan.roadmap.id}?version=${plan.versionNumber}`}
              className="underline-offset-4 hover:underline"
            >
              {plan.roadmap.title}
            </Link>{" "}
            <span className="font-normal text-ink-muted">version {plan.versionNumber}</span>
          </p>
          <p className="text-ink-muted">
            {position.label} · {paceLabel(plan.pacing)} · Started{" "}
            {formatCalendarDate(plan.startDate, { year: "numeric" })} ·{" "}
            {group.timezone.replaceAll("_", " ")} time
          </p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
            <StartDateForm groupId={group.id} startDate={plan.startDate} />
            <div className="flex flex-wrap gap-2">
              {plan.newerVersionNumber ? (
                <ConfirmAction
                  action={upgradePlanAction}
                  fields={{ groupId: group.id }}
                  trigger={`Switch to version ${plan.newerVersionNumber}`}
                  triggerVariant="outline"
                  title={`Switch to version ${plan.newerVersionNumber}?`}
                  description="The schedule is rebuilt from the new version with the same start date and pace. Weeks you moved by hand are reset; members keep their progress."
                  confirmLabel="Switch version"
                  pendingLabel="Switching…"
                />
              ) : null}
              <ConfirmAction
                action={endPlanAction}
                fields={{ groupId: group.id }}
                trigger="End plan"
                triggerVariant="destructive"
                title="End this plan?"
                description="The group stops following this roadmap. Members keep their progress, and you can choose a roadmap again anytime."
                confirmLabel="End plan"
                pendingLabel="Ending…"
                destructive
              />
            </div>
          </div>
        ) : null}
      </section>

      <ol className="flex flex-col gap-4">
        {plan.weeks.map((week) => {
          const current = week.number === plan.currentWeek;
          const past = week.number < plan.currentWeek;
          const solvedCount = week.items.filter((item) => solved.has(item.problem.id)).length;
          return (
            <li key={week.number}>
              <section
                aria-labelledby={`week-${week.number}`}
                className="rounded-xl bg-surface p-4 sm:p-5"
              >
                <h2
                  id={`week-${week.number}`}
                  className="flex flex-wrap items-center gap-x-3 text-base font-medium"
                >
                  Week {week.number}
                  <span className="text-sm font-normal text-ink-muted">
                    {formatWeekRange(plan.startDate, week.number)}
                  </span>
                  {current ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink">
                      <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
                      This week
                    </span>
                  ) : null}
                  {week.items.length > 0 ? (
                    <span className="ml-auto text-sm font-normal text-ink-muted tabular">
                      {solvedCount} of {week.items.length} solved
                    </span>
                  ) : null}
                </h2>
                {week.items.length === 0 ? (
                  <p className="mt-2 text-ink-muted">No problems this week.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-rule">
                    {week.items.map((item) => (
                      <ProblemRow
                        key={item.roadmapItemId}
                        problem={item.problem}
                        sectionTitle={item.sectionTitle}
                        leading={
                          <CompletionToggle
                            problemId={item.problem.id}
                            title={item.problem.title}
                            solved={solved.has(item.problem.id)}
                          />
                        }
                      >
                        {past && !solved.has(item.problem.id) ? (
                          <span className="text-xs text-ink-muted">Backlog</span>
                        ) : null}
                        {isAdmin ? (
                          <MoveWeekForm
                            groupId={group.id}
                            roadmapItemId={item.roadmapItemId}
                            title={item.problem.title}
                            currentWeek={week.number}
                            weekOptions={weekOptions}
                          />
                        ) : null}
                      </ProblemRow>
                    ))}
                  </ul>
                )}
              </section>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
