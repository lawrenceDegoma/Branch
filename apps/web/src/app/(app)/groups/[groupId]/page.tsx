import { Settings, UserPlus } from "lucide-react";
import Link from "next/link";
import { Feed } from "@/components/feed/feed";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { MemberList } from "@/components/groups/member-list";
import { PlanSummary } from "@/components/plans/plan-summary";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import { feedQuerySchema } from "@/modules/feed/schemas";
import { listComposerGroups, listFeed } from "@/modules/feed/service";
import { leaveGroupAction } from "@/modules/groups/actions";
import { badgesForGroup } from "@/modules/badges/service";
import { getGroupOverview } from "@/modules/groups/service";
import { getGroupProgress } from "@/modules/progress/service";

type Params = { params: Promise<{ groupId: string }> };
type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params) {
  const { user } = await requireViewer();
  const group = await orNotFound(getGroupOverview(user.id, (await params).groupId));
  return { title: group.name };
}

export default async function GroupPage({ params, searchParams }: Params & SearchParams) {
  const { user, profile } = await requireViewer();
  const group = await orNotFound(getGroupOverview(user.id, (await params).groupId));
  const { before } = feedQuerySchema.parse(await searchParams);
  const [{ plan, members }, page, composerGroups] = await Promise.all([
    getGroupProgress(user.id, group.id),
    listFeed(user.id, { groupId: group.id, before }),
    listComposerGroups(user.id),
  ]);
  const isAdmin = group.viewerRole === "ADMIN";

  const badges = await badgesForGroup(group.members);
  const withBadges = group.members.map((m) => ({ ...m, badges: badges.get(m.userId) ?? [] }));

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={group.name}
        description={group.description ?? undefined}
        actions={
          isAdmin ? (
            <>
              <Link href={`/groups/${group.id}/settings#invites`} className={buttonVariants()}>
                <UserPlus aria-hidden="true" />
                Invite
              </Link>
              <Link
                href={`/groups/${group.id}/settings`}
                aria-label="Group settings"
                className={buttonVariants({ variant: "outline", size: "icon" })}
              >
                <Settings aria-hidden="true" />
              </Link>
            </>
          ) : undefined
        }
      />
      <div className="mb-4">
        <PlanSummary groupId={group.id} plan={plan} members={members} isAdmin={isAdmin} />
      </div>
      <div className="mb-6">
        <Feed
          page={page}
          composerGroups={composerGroups.filter((g) => g.id === group.id)}
          basePath={`/groups/${group.id}`}
          showGroup={false}
          timeZone={profile.timezone}
          isOlderPage={Boolean(before)}
        />
      </div>
      <section aria-labelledby="members-heading" className="rounded-xl bg-surface p-4 sm:p-5">
        <h2 id="members-heading" className="mb-4 text-base font-medium">
          Members <span className="font-normal text-ink-muted">{group.members.length}</span>
        </h2>
        <MemberList members={withBadges} viewerId={user.id} timeZone={profile.timezone} />
      </section>
      {!isAdmin ? (
        <div className="mt-6 flex justify-end">
          <ConfirmAction
            action={leaveGroupAction}
            fields={{ groupId: group.id }}
            trigger="Leave group"
            triggerVariant="destructive"
            title={`Leave ${group.name}?`}
            description={`You'll stop seeing the group's plan and members. Your own progress stays with you. To come back you'll need a new invite link (${pluralize(group.members.length - 1, "other member")} will stay).`}
            confirmLabel="Leave group"
            pendingLabel="Leaving…"
            destructive
          />
        </div>
      ) : null}
    </div>
  );
}
