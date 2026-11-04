import { redirect } from "next/navigation";
import { SocialSignIn } from "@/components/forms/social-sign-in";
import { safeNextPath } from "@/lib/redirect";
import { enabledSocialProviders } from "@/modules/auth/auth";
import { socialSignInErrorMessage } from "@/modules/auth/errors";
import { getSession } from "@/modules/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSession()) redirect(next ?? "/home");

  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">Sign in to Branch</h1>
      <p className="mt-1 mb-6 text-ink-muted">Pick up where your group left off.</p>
      {params.reset === "done" ? (
        <p role="status" className="mb-4 rounded-[10px] bg-positive-soft px-3 py-2.5 text-ink">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-negative-soft px-3 py-2.5 text-ink">
          {socialSignInErrorMessage(params.error)}
        </p>
      ) : null}
      <SocialSignIn providers={enabledSocialProviders} next={next} />
      <SignInForm next={next} />
    </>
  );
}
