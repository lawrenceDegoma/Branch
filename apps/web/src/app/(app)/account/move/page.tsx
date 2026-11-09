import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { finishMove, signInMethods } from "@/modules/auth/accounts";
import { connectProviderAction } from "@/modules/auth/actions";
import { enabledSocialProviders } from "@/modules/auth/auth";
import { socialSignInErrorMessage } from "@/modules/auth/errors";
import { requireViewer } from "@/modules/auth/session";

export const metadata = { title: "Move to Google or GitHub" };

const LABEL = { google: "Google", github: "GitHub" } as const;

/**
 * Moving a password account to Google or GitHub: connect one, and the password is switched off.
 * It's the same account, so groups, progress, and solutions stay exactly as they were.
 */
export default async function MoveAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await requireViewer();
  const { error } = await searchParams;
  await finishMove(user.id);
  const { password, providers } = await signInMethods(user.id);
  const done = providers.length > 0 && !password;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Move to Google or GitHub" />
      {error ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-negative-soft px-3 py-2.5 text-ink">
          {socialSignInErrorMessage(error)}
        </p>
      ) : null}
      {done ? (
        <div role="status" className="flex flex-col items-start gap-4 rounded-xl bg-surface p-5">
          <p className="flex items-start gap-2">
            <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-positive" />
            <span>
              You&apos;re all set: you sign in with {providers.map((p) => LABEL[p]).join(" or ")}{" "}
              now. Your groups, progress, and solutions are all still here, and your old password no
              longer works.
            </span>
          </p>
          <Link href="/home" className={buttonVariants()}>
            Go to Home
          </Link>
        </div>
      ) : enabledSocialProviders.length === 0 ? (
        <p className="text-ink-muted">Google and GitHub sign-in aren&apos;t set up yet.</p>
      ) : (
        <div className="flex flex-col gap-4 rounded-xl bg-surface p-5">
          <p>
            Branch now signs people in with Google or GitHub instead of passwords. Connect one to
            this account: it&apos;s the same account afterwards, so your groups, progress, and
            solutions all stay. Then your password is switched off.
          </p>
          <p className="text-ink-muted">
            Its email doesn&apos;t have to match the one you signed up with.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {enabledSocialProviders.map((provider) => (
              <form key={provider} action={connectProviderAction}>
                <input type="hidden" name="provider" value={provider} />
                <SubmitButton variant="outline" pendingLabel={`Opening ${LABEL[provider]}…`}>
                  Connect {LABEL[provider]}
                </SubmitButton>
              </form>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
