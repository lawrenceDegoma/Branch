import Link from "next/link";
import { Feed, GroupFilter } from "@/components/feed/feed";
import { Backlog, GroupWeek, isPlanned } from "@/components/home/group-week";
import { GettingStarted } from "@/components/home/getting-started";
import { WeekSummary } from "@/components/home/week-summary";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { serverEnv } from "@/lib/env";
import { requireViewer } from "@/modules/auth/session";
import { feedQuerySchema } from "@/modules/feed/schemas";
import { listComposerGroups, listFeed } from "@/modules/feed/service";
import { listConnections } from "@/modules/integrations/connections";
import { getHome } from "@/modules/progress/service";

export const metadata = { title: "Home" };

// Feed-first Home (PRD §4): activity from every group in the centre; on wide screens a rail with
// the week's summary, this week's problems, and the backlog. On narrow screens a compact summary
// comes first (with a link down to this week's problems), then the feed, then the lists.
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await requireViewer();
  const query = feedQuerySchema.parse(await searchParams);
  const home = await getHome(user.id, profile.timezone);

  if (home.groups.length === 0) {
    return (
      <div className="max-w-4xl">
        <PageHeader title="Home" />
        <EmptyState
          title="Start with a group"
          description="Create a group for your friends, or open an invite link someone shared with you. Your weekly problems and your groups' activity show up here."
          action={
            <Link href="/groups/new" className={buttonVariants()}>
              Create group
            </Link>
          }
        />
      </div>
    );
  }

  const groups = home.groups.map((g) => g.group);
  // A stale or foreign ?group= falls back to every group rather than revealing anything.
  const selected = groups.some((g) => g.id === query.group) ? query.group : undefined;
  const [page, composerGroups, connections] = await Promise.all([
    listFeed(user.id, { groupId: selected, before: query.before }),
    listComposerGroups(user.id),
    profile.gettingStartedHidden ? Promise.resolve([]) : listConnections(user.id),
  ]);
  const planned = home.groups.filter(isPlanned);
  const unplanned = home.groups.filter((g) => !isPlanned(g));

  return (
    <div>
      <PageHeader title="Home" />
      <div className="grid gap-6 [grid-template-areas:'summary'_'feed'_'week'_'backlog'] xl:grid-cols-[minmax(0,1fr)_var(--rail-width)] xl:grid-rows-[auto_auto_1fr] xl:items-start xl:[grid-template-areas:'feed_summary'_'feed_week'_'feed_backlog']">
        <aside aria-label="Weekly summary" className="[grid-area:summary]">
          <WeekSummary summary={home.summary} weekLink={planned.length > 0} />
        </aside>
        <section
          aria-labelledby="this-week-heading"
          id="this-week"
          className="flex scroll-mt-4 flex-col gap-3 [grid-area:week]"
        >
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
        <div className="flex min-w-0 flex-col gap-6 [grid-area:feed]">
          {profile.gettingStartedHidden ? null : (
            <GettingStarted
              connected={connections.length > 0}
              shareSolves={profile.shareSolves}
              solved={home.summary.totalSolved > 0}
              storeUrl={serverEnv().EXTENSION_STORE_URL}
            />
          )}
          <Feed
            page={page}
            composerGroups={
              selected ? composerGroups.filter((g) => g.id === selected) : composerGroups
            }
            basePath="/home"
            query={selected ? { group: selected } : undefined}
            showGroup={!selected}
            timeZone={profile.timezone}
            filter={<GroupFilter groups={groups} selected={selected} />}
            isOlderPage={Boolean(query.before)}
          />
        </div>
        <div className="[grid-area:backlog]">
          <Backlog groups={planned} />
        </div>
      </div>
    </div>
  );
}
