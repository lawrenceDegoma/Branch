import { Settings } from "lucide-react";
import Link from "next/link";
import { BranchWordmark } from "@/components/brand/branch-mark";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MobileHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-ground px-4 sm:px-6",
        className,
      )}
    >
      <Link href="/home" className="rounded-md py-1">
        <BranchWordmark />
      </Link>
      <Link
        href="/settings"
        aria-label="Settings"
        className={buttonVariants({ variant: "ghost", size: "icon" })}
      >
        <Settings aria-hidden="true" strokeWidth={1.75} />
      </Link>
    </header>
  );
}
