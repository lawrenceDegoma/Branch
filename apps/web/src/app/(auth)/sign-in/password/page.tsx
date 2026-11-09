import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/redirect";
import { enabledSocialProviders, passwordSignUpAllowed } from "@/modules/auth/auth";
import { getSession } from "@/modules/auth/session";
import { SignInForm } from "../sign-in-form";

export const metadata = { title: "Sign in with your password" };

/** For accounts made with a password: sign in, then connect Google or GitHub. */
export default async function PasswordSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSession()) redirect(next ?? "/home");
  const moving = enabledSocialProviders.length > 0;

  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">
        Sign in with your password
      </h1>
      <p className="mt-1 mb-6 text-ink-muted">
        {moving
          ? "Branch now signs people in with Google or GitHub. Sign in once more, then connect one: your groups, progress, and everything else stay with you."
          : "Pick up where your group left off."}
      </p>
      {params.reset === "done" ? (
        <p role="status" className="mb-4 rounded-[10px] bg-positive-soft px-3 py-2.5 text-ink">
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      <SignInForm
        next={next ?? (moving ? "/account/move" : null)}
        signUpLink={passwordSignUpAllowed && !moving}
      />
    </>
  );
}
