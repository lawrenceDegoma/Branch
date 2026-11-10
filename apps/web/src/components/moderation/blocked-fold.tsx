import { ChevronRight } from "lucide-react";

/**
 * Someone the viewer blocked: their writing folds away (blocking is personal and silent), with a
 * way to look anyway. Everyone else's shows as usual.
 */
export function BlockedFold({
  blocked,
  name,
  children,
}: {
  blocked: boolean;
  name: string;
  children: React.ReactNode;
}) {
  if (!blocked) return children;
  return (
    <details className="group/blocked">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 transition-transform group-open/blocked:rotate-90"
        />
        Hidden: you blocked {name}. Show
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}
