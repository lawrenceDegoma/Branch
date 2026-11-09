import Link from "next/link";
import { redirect } from "next/navigation";
import { SocialSignIn } from "@/components/forms/social-sign-in";
import { safeNextPath } from "@/lib/redirect";
import { enabledSocialProviders } from "@/modules/auth/auth";
import { getSession } from "@/modules/auth/session";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create account" };

/** New accounts sign up with Google or GitHub (a password form only where no provider is set up). */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  if (await getSession()) redirect(next ?? "/home");
  const signInHref = next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";

  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">Join Branch</h1>
      <p className="mt-1 mb-6 text-ink-muted">Grow together. Solve better.</p>
      {enabledSocialProviders.length > 0 ? (
        <>
          <SocialSignIn providers={enabledSocialProviders} next={next} divider={false} />
          <p className="mt-6 text-ink-muted">
            No new password to remember: Branch uses your Google or GitHub account to sign you in.
            Already have an account?{" "}
            <Link href={signInHref} className="font-medium text-ink underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </>
      ) : (
        <SignUpForm next={next} />
      )}
    </>
  );
}
