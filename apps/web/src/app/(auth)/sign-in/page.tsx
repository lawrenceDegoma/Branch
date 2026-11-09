import Link from "next/link";
import { redirect } from "next/navigation";
import { SocialSignIn } from "@/components/forms/social-sign-in";
import { safeNextPath } from "@/lib/redirect";
import { enabledSocialProviders } from "@/modules/auth/auth";
import { socialSignInErrorMessage } from "@/modules/auth/errors";
import { getSession } from "@/modules/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

/**
 * Sign in with Google or GitHub. Accounts made with a password before Branch moved to providers
 * sign in on /sign-in/password, then connect a provider. (With no provider set up, the password
 * form is shown here instead.)
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSession()) redirect(next ?? "/home");
  const passwordHref = next
    ? `/sign-in/password?next=${encodeURIComponent(next)}`
    : "/sign-in/password";

  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">Sign in to Branch</h1>
      <p className="mt-1 mb-6 text-ink-muted">Pick up where your group left off.</p>
      {params.error ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-negative-soft px-3 py-2.5 text-ink">
          {socialSignInErrorMessage(params.error)}
        </p>
      ) : null}
      {enabledSocialProviders.length > 0 ? (
        <>
          <SocialSignIn providers={enabledSocialProviders} next={next} divider={false} />
          <p className="mt-6 text-ink-muted">
            Made your account with an email and password?{" "}
            <Link href={passwordHref} className="font-medium text-ink underline underline-offset-4">
              Sign in with your password
            </Link>{" "}
            once more to move it to Google or GitHub.
          </p>
        </>
      ) : (
        <SignInForm next={next} />
      )}
    </>
  );
}
