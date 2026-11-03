import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { RolePill } from "@/components/groups/role-pill";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { requireViewer } from "@/modules/auth/session";
import { listGroupsForUser } from "@/modules/groups/service";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const { user } = await requireViewer();
  const groups = await listGroupsForUser(user.id);
  const createLink = (
    <Link href="/groups/new" className={buttonVariants()}>
      Create group
    </Link>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Groups"
        description={
          groups.length > 0 ? `You're in ${pluralize(groups.length, "group")}.` : undefined
        }
        actions={groups.length > 0 ? createLink : undefined}
      />
      {groups.length === 0 ? (
        <EmptyState
          title="You're not in a group yet"
          description="Create one for your friends, or open an invite link someone shared with you."
          action={createLink}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="flex items-center gap-4 rounded-xl bg-surface px-5 py-4 transition-colors duration-(--duration-fast) hover:bg-raised"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-medium">{group.name}</span>
                    <RolePill role={group.role} />
                  </p>
                  <p className="mt-0.5 truncate text-ink-muted">
                    {pluralize(group.memberCount, "member")}
                    {group.description ? ` · ${group.description}` : ""}
                  </p>
                </div>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
