import Link from "next/link";
import { Backlog, GroupWeek, isPlanned } from "@/components/home/group-week";
import { WeekSummary } from "@/components/home/week-summary";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { requireViewer } from "@/modules/auth/session";
import { getHome } from "@/modules/progress/service";

export const metadata = { title: "Home" };

// Phase 1 Home: the viewer's week across every group. The activity feed joins it in Phase 2.
export default async function HomePage() {
  const { user, profile } = await requireViewer();
  const home = await getHome(user.id, profile.timezone);
  const planned = home.groups.filter(isPlanned);
  const unplanned = home.groups.filter((g) => !isPlanned(g));

  if (home.groups.length === 0) {
    return (
      <div className="max-w-4xl">
        <PageHeader title="Home" />
        <EmptyState
          title="Start with a group"
          description="Create a group for your friends, or open an invite link someone shared with you. Your weekly problems show up here."
          action={
            <Link href="/groups/new" className={buttonVariants()}>
              Create group
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Home"
        description={`Your week across ${pluralize(home.groups.length, "group")}.`}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_var(--rail-width)] xl:items-start">
        {/* First in reading order on every screen; the right rail on wide ones. */}
        <aside
          aria-label="Weekly summary"
          className="xl:sticky xl:top-9 xl:col-start-2 xl:row-start-1"
        >
          <WeekSummary summary={home.summary} />
        </aside>
        <div className="flex min-w-0 flex-col gap-8 xl:col-start-1 xl:row-start-1">
          <section aria-labelledby="this-week-heading" className="flex flex-col gap-3">
            <h2 id="this-week-heading" className="text-base font-medium">
              This week
            </h2>
            {planned.map((entry) => (
              <GroupWeek key={entry.group.id} entry={entry} />
            ))}
            {unplanned.length > 0 ? (
              <div className="rounded-xl bg-surface p-4 sm:p-5">
                <p className="font-medium">Waiting for a roadmap</p>
                <ul className="mt-1 flex flex-col gap-1 text-ink-muted">
                  {unplanned.map(({ group }) => (
                    <li key={group.id}>
                      <Link
                        href={`/groups/${group.id}`}
                        className="underline-offset-4 hover:text-ink hover:underline"
                      >
                        {group.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
          <Backlog groups={planned} />
        </div>
      </div>
    </div>
  );
}
