import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
  headingId,
}: {
  title: string;
  /** Lets focus move to the heading (it's made focusable). */
  headingId?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1
          id={headingId}
          tabIndex={headingId ? -1 : undefined}
          className="text-2xl leading-8 font-semibold tracking-tight"
        >
          {title}
        </h1>
        {description ? <p className="mt-1 text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
