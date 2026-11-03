import type { GroupAuditAction } from "@branch/database";
import Link from "next/link";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { DeleteGroupForm } from "@/components/groups/delete-group-form";
import { GroupDetailsForm } from "@/components/groups/group-details-form";
import { InviteCreator } from "@/components/groups/invite-panel";
import { MemberList } from "@/components/groups/member-list";
import { SettingsSection } from "@/components/settings/settings-section";
import { PageHeader } from "@/components/shell/page-header";
import { formatDate, formatDateTime } from "@/lib/format";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import {
  removeMemberAction,
  revokeInviteAction,
  transferAdminAction,
  updateGroupAction,
} from "@/modules/groups/actions";
import { getGroupOverview, listActiveInvites, listAuditEvents } from "@/modules/groups/service";
import { listTimeZones } from "@/modules/profile/timezone";

export const metadata = { title: "Group settings" };

function describeEvent(action: GroupAuditAction, actor: string, subject: string): string {
  switch (action) {
    case "GROUP_CREATED":
      return `${actor} created the group`;
    case "GROUP_UPDATED":
      return `${actor} updated the group details`;
    case "MEMBER_JOINED":
      return `${subject} joined`;
    case "MEMBER_LEFT":
      return `${subject} left`;
    case "MEMBER_REMOVED":
      return `${actor} removed ${subject}`;
    case "ADMIN_TRANSFERRED":
      return `${actor} made ${subject} the admin`;
    case "INVITE_CREATED":
      return `${actor} created an invite link`;
    case "INVITE_REVOKED":
      return `${actor} turned off an invite link`;
    case "PLAN_CHANGED":
      return `${actor} changed the group's roadmap`;
  }
}

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { user, profile } = await requireViewer();
  const { groupId } = await params;
  // Admin-only reads first: members who open this URL get a 404.
  const [invites, events] = await Promise.all([
    orNotFound(listActiveInvites(user.id, groupId)),
    orNotFound(listAuditEvents(user.id, groupId)),
  ]);
  const group = await getGroupOverview(user.id, groupId);
  const tz = profile.timezone;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Group settings"
        description={
          <Link
            href={`/groups/${group.id}`}
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            {group.name}
          </Link>
        }
      />

      <SettingsSection
        id="details"
        title="Details"
        description="Name, description, and the timezone weeks follow."
      >
        <GroupDetailsForm
          action={updateGroupAction}
          groupId={group.id}
          defaults={{
            name: group.name,
            description: group.description ?? "",
            timezone: group.timezone,
          }}
          zones={listTimeZones()}
          submitLabel="Save details"
          pendingLabel="Saving…"
        />
      </SettingsSection>

      <SettingsSection
        id="invites"
        title="Invite links"
        description="Anyone with a link can join until it expires, reaches its limit, or you turn it off."
      >
        <InviteCreator groupId={group.id} />
        <div className="mt-6 border-t border-line pt-4">
          <h3 className="mb-3 font-medium">Active links</h3>
          {invites.length === 0 ? (
            <p className="text-ink-muted">No active invite links.</p>
          ) : (
            <ul className="divide-y divide-rule">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1 leading-5">
                    <p>
                      Expires {formatDate(invite.expiresAt, tz)} ·{" "}
                      <span className="tabular">
                        {invite.maxUses === null
                          ? `${invite.useCount} used`
                          : `${invite.useCount} of ${invite.maxUses} used`}
                      </span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      Created {formatDateTime(invite.createdAt, tz)}
                      {invite.createdByName ? ` by ${invite.createdByName}` : ""}
                    </p>
                  </div>
                  <ConfirmAction
                    action={revokeInviteAction}
                    fields={{ groupId: group.id, inviteId: invite.id }}
                    trigger="Turn off"
                    title="Turn off this invite link?"
                    description="People who haven't joined yet won't be able to use it. Members who already joined stay."
                    confirmLabel="Turn off link"
                    pendingLabel="Turning off…"
                    destructive
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        id="members"
        title="Members"
        description="Each group has one admin. Hand the role to someone else before you leave."
      >
        <MemberList
          members={group.members}
          viewerId={user.id}
          timeZone={tz}
          actions={(member) =>
            member.userId === user.id ? null : (
              <>
                <ConfirmAction
                  action={transferAdminAction}
                  fields={{ groupId: group.id, userId: member.userId }}
                  trigger="Make admin"
                  title={`Make ${member.name} the admin?`}
                  description="You'll become a regular member and lose access to these settings. They can hand the role back."
                  confirmLabel="Transfer admin"
                  pendingLabel="Transferring…"
                />
                <ConfirmAction
                  action={removeMemberAction}
                  fields={{ groupId: group.id, userId: member.userId }}
                  trigger="Remove"
                  title={`Remove ${member.name}?`}
                  description="They'll lose access to the group. Their own progress stays with them, and they can rejoin with a new invite."
                  confirmLabel="Remove member"
                  pendingLabel="Removing…"
                  destructive
                />
              </>
            )
          }
        />
      </SettingsSection>

      <SettingsSection
        id="activity"
        title="Admin activity"
        description="Recent changes to membership and settings."
      >
        <ol className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="flex flex-wrap justify-between gap-x-4">
              <span>
                {describeEvent(
                  event.action,
                  event.actor?.name ?? "A former member",
                  event.subjectUser?.name ?? "A former member",
                )}
              </span>
              <span className="text-ink-muted tabular">{formatDateTime(event.createdAt, tz)}</span>
            </li>
          ))}
        </ol>
      </SettingsSection>

      <SettingsSection id="delete" title="Delete group" description="This can't be undone.">
        <DeleteGroupForm groupId={group.id} groupName={group.name} />
      </SettingsSection>
    </div>
  );
}
