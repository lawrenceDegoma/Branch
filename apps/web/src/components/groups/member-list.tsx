import { Avatar } from "@/components/user/avatar";
import { formatDate } from "@/lib/format";
import { RolePill } from "./role-pill";

export type MemberRow = {
  userId: string;
  name: string;
  username: string | null;
  photo: string | null;
  role: "ADMIN" | "MEMBER";
  joinedAt: Date;
  /** Milestones shown to the group (only for people sharing their solves). */
  badges?: string[];
};

export function MemberList({
  members,
  viewerId,
  timeZone,
  actions,
}: {
  members: MemberRow[];
  viewerId: string;
  timeZone: string;
  actions?: (member: MemberRow) => React.ReactNode;
}) {
  return (
    <ul className="divide-y divide-rule">
      {members.map((member) => (
        <li
          key={member.userId}
          className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
        >
          <Avatar userId={member.userId} name={member.name} photo={member.photo} />
          <div className="min-w-0 flex-1 leading-5">
            <p className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{member.name}</span>
              {member.userId === viewerId ? <span className="text-ink-muted">(you)</span> : null}
              <RolePill role={member.role} />
              {member.badges?.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex h-5 items-center rounded-full bg-raised px-2 text-xs font-medium whitespace-nowrap text-ink-muted"
                >
                  {badge}
                </span>
              ))}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {member.username ? `@${member.username} · ` : ""}Joined{" "}
              {formatDate(member.joinedAt, timeZone)}
            </p>
          </div>
          {actions ? <div className="flex shrink-0 gap-1">{actions(member)}</div> : null}
        </li>
      ))}
    </ul>
  );
}
