import { dateInTimeZone, nextMonday } from "@branch/shared/calendar";
import Link from "next/link";
import { PlanSetupForm } from "@/components/plans/plan-setup-form";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import { requireAdmin } from "@/modules/groups/access";
import { getGroupOverview } from "@/modules/groups/service";
import { getGroupPlan, listPlanCandidates } from "@/modules/plans/service";

export const metadata = { title: "Choose a roadmap" };

export default async function NewPlanPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { user } = await requireViewer();
  const { groupId } = await params;
  await orNotFound(requireAdmin(user.id, groupId));
  const [group, { plan }, candidates] = await Promise.all([
    getGroupOverview(user.id, groupId),
    getGroupPlan(user.id, groupId),
    listPlanCandidates(user.id),
  ]);

  return (
    <div className="max-w-xl">
      <PageHeader
        title={plan ? "Change roadmap" : "Choose a roadmap"}
        description={
          <Link
            href={`/groups/${group.id}`}
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            {group.name}
          </Link>
        }
      />
      {candidates.length === 0 ? (
        <EmptyState
          title="No published roadmaps yet"
          description="Create and publish a roadmap first, then come back to schedule it."
          action={
            <Link href="/roadmaps/new" className={buttonVariants()}>
              New roadmap
            </Link>
          }
        />
      ) : (
        <div className="rounded-xl bg-surface p-4 sm:p-5">
          <PlanSetupForm
            groupId={group.id}
            candidates={candidates}
            defaultStartDate={nextMonday(dateInTimeZone(new Date(), group.timezone))}
            replacing={plan ? plan.roadmap.title : null}
          />
        </div>
      )}
    </div>
  );
}
