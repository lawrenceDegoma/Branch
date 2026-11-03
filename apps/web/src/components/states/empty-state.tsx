import { cn } from "@/lib/utils";

/** An empty section keeps its frame: one sentence, and the next action when there is one. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-dashed border-line px-5 py-6",
        className,
      )}
    >
      <div>
        <p className="font-medium text-ink">{title}</p>
        {description ? <p className="mt-1 text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
