import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown inside the block that failed, never as a full-screen banner. */
export function ErrorState({
  message,
  action,
  className,
}: {
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface px-5 py-4",
        className,
      )}
    >
      <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-negative" strokeWidth={2} />
      <p className="min-w-0 flex-1 text-ink">{message}</p>
      {action}
    </div>
  );
}
