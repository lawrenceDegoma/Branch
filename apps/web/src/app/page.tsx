import Link from "next/link";
import { BranchMark } from "@/components/brand/branch-mark";
import { buttonVariants } from "@/components/ui/button";

export default function LandingPage() {
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
      <Link href="/home" className={buttonVariants({ size: "lg", className: "self-start" })}>
        Open Branch
      </Link>
    </main>
  );
}
