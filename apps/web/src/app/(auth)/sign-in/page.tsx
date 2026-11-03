import { redirect } from "next/navigation";
import { GitHubButton } from "@/components/forms/github-button";
import { safeNextPath } from "@/lib/redirect";
import { githubEnabled } from "@/modules/auth/auth";
import { getSession } from "@/modules/auth/session";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSession()) redirect(next ?? "/home");

  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">Sign in to Branch</h1>
      <p className="mt-1 mb-6 text-ink-muted">Pick up where your group left off.</p>
      {params.error === "github" ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-negative-soft px-3 py-2.5 text-ink">
          GitHub sign-in didn&apos;t complete. Try again or use your email.
        </p>
      ) : null}
      {githubEnabled ? (
        <>
          <GitHubButton next={next} />
          <div className="my-5 flex items-center gap-3 text-xs text-ink-faint" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}
      <SignInForm next={next} />
    </>
  );
}
