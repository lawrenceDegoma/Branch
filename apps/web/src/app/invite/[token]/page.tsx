import Link from "next/link";
import { redirect } from "next/navigation";
import { BranchWordmark } from "@/components/brand/branch-mark";
import { buttonVariants } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { getSession } from "@/modules/auth/session";
import { findMembership } from "@/modules/groups/access";
import { inviteStatusMessage } from "@/modules/groups/invite-token";
import { previewInvite } from "@/modules/groups/service";
import { getProfile } from "@/modules/profile/service";
import { JoinGroupForm } from "./join-group-form";

// Invite links are capabilities; keep them out of search results.
export const metadata = { title: "Join a group", robots: { index: false, follow: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, session] = await Promise.all([previewInvite(token), getSession()]);
  const here = `/invite/${token}`;

  if (session && preview.status !== "invalid") {
    if (!(await getProfile(session.user.id)))
      redirect(`/onboarding?next=${encodeURIComponent(here)}`);
    if (await findMembership(session.user.id, preview.group.id))
      redirect(`/groups/${preview.group.id}`);
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="self-start rounded-md py-1">
        <BranchWordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-12">
        {preview.status === "invalid" ? (
          <div>
            <h1 className="text-2xl leading-8 font-semibold tracking-tight">
              This invite link isn&apos;t valid
            </h1>
            <p className="mt-2 text-ink-muted">
              Check that you copied the whole link, or ask for a new one.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-ink-muted">
                {preview.invitedBy
                  ? `${preview.invitedBy} invited you to join`
                  : "You're invited to join"}
              </p>
              <h1 className="mt-1 text-2xl leading-8 font-semibold tracking-tight">
                {preview.group.name}
              </h1>
              <p className="mt-1 text-ink-muted">
                {pluralize(preview.group.memberCount, "member")} on Branch
              </p>
            </div>
            {preview.status !== "active" ? (
              <p role="alert" className="rounded-[10px] bg-negative-soft px-3 py-2.5 text-ink">
                {inviteStatusMessage[preview.status]}
              </p>
            ) : session ? (
              <JoinGroupForm token={token} />
            ) : (
              <div className="flex flex-col gap-3">
                <Link
                  href={`/sign-up?next=${encodeURIComponent(here)}`}
                  className={buttonVariants({ size: "lg" })}
                >
                  Create an account to join
                </Link>
                <Link
                  href={`/sign-in?next=${encodeURIComponent(here)}`}
                  className={buttonVariants({ size: "lg", variant: "outline" })}
                >
                  I already have an account
                </Link>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
