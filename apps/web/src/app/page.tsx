import Link from "next/link";
import { redirect } from "next/navigation";
import { BranchMark } from "@/components/brand/branch-mark";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/modules/auth/session";

export default async function LandingPage() {
  if (await getSession()) redirect("/home");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <BranchMark className="size-10" />
      <div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Branch</h1>
        <p className="mt-3 text-xl text-ink">Grow together. Solve better.</p>
        <p className="mt-2 max-w-prose text-base text-ink-muted">
          Work through a shared coding-interview roadmap with friends, one week at a time, at your
          own pace.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
          Create account
        </Link>
        <Link href="/sign-in" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Sign in
        </Link>
      </div>
      <p className="flex gap-4 text-xs text-ink-muted">
        <Link href="/changelog" className="underline underline-offset-4 hover:text-ink">
          What&apos;s new
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-ink">
          Terms
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
          Privacy
        </Link>
      </p>
    </main>
  );
}
