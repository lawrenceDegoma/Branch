import Link from "next/link";
import { BranchMark } from "@/components/brand/branch-mark";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Not found" };

// Also served for resources the viewer may not access, so private groups cannot be probed.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-5 px-6">
      <BranchMark className="size-8" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-ink-muted">
          This page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "outline", className: "self-start" })}>
        Go to Branch
      </Link>
    </main>
  );
}
