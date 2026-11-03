import { cn } from "@/lib/utils";

/** A flat placeholder at the real size of the content it stands in for. No shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-raised", className)} />;
}
