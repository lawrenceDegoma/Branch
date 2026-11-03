import Link from "next/link";
import { GroupDetailsForm } from "@/components/groups/group-details-form";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireViewer } from "@/modules/auth/session";
import { createGroupAction } from "@/modules/groups/actions";
import { listTimeZones } from "@/modules/profile/timezone";

export const metadata = { title: "Create group" };

export default async function NewGroupPage() {
  const { profile } = await requireViewer();
  return (
    <div className="max-w-xl">
      <PageHeader
        title="Create a group"
        description="Groups are private. Only people with an invite link can join."
      />
      <div className="rounded-xl bg-surface p-4 sm:p-5">
        <GroupDetailsForm
          action={createGroupAction}
          defaults={{ name: "", description: "", timezone: profile.timezone }}
          zones={listTimeZones()}
          submitLabel="Create group"
          pendingLabel="Creating…"
        >
          <Link href="/groups" className={buttonVariants({ variant: "ghost" })}>
            Cancel
          </Link>
        </GroupDetailsForm>
      </div>
    </div>
  );
}
