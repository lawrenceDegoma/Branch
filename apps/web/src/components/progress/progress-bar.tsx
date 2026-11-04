import { cn } from "@/lib/utils";

/** A thin orange bar for a share of problems solved. Decorative: pair it with the numbers. */
export function ProgressBar({
  value,
  total,
  className,
}: {
  value: number;
  total: number;
  className?: string;
}) {
  const share = total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <span
      aria-hidden="true"
      className={cn("block h-1.5 overflow-hidden rounded-full bg-raised", className)}
    >
      <span
        className="block h-full rounded-full bg-brand transition-[width] duration-(--duration-base)"
        style={{ width: `${share * 100}%` }}
      />
    </span>
  );
}
