import Link from "next/link";
import { BranchWordmark } from "@/components/brand/branch-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="self-start rounded-md py-1">
        <BranchWordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        {children}
      </main>
      <footer className="flex justify-center gap-4 text-xs text-ink-muted">
        <Link href="/terms" className="underline underline-offset-4 hover:text-ink">
          Terms
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-ink">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
