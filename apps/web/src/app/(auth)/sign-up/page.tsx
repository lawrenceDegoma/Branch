import { redirect } from "next/navigation";
import { GitHubButton } from "@/components/forms/github-button";
import { safeNextPath } from "@/lib/redirect";
import { githubEnabled } from "@/modules/auth/auth";
import { getSession } from "@/modules/auth/session";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNextPath((await searchParams).next);
  if (await getSession()) redirect(next ?? "/home");

  return (
    <>
      <h1 className="text-2xl leading-8 font-semibold tracking-tight">Join Branch</h1>
      <p className="mt-1 mb-6 text-ink-muted">Grow together. Solve better.</p>
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
      <SignUpForm next={next} />
    </>
  );
}
