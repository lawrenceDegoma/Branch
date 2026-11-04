"use client";

import { Check } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setCompletionAction } from "@/modules/progress/actions";

/**
 * Marks a problem solved for the viewer. The check flips at once; if saving fails, React drops
 * the optimistic value (the button returns to the saved state) and the reason is shown.
 */
export function CompletionToggle({
  problemId,
  title,
  solved,
}: {
  problemId: string;
  title: string;
  solved: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(solved);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !optimistic;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const result = await setCompletionAction(problemId, next);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-pressed={optimistic}
        aria-label={`Solved: ${title}`}
        onClick={toggle}
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-(--duration-fast) outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          optimistic
            ? "border-brand bg-brand text-ground"
            : "group border-control text-ink-faint hover:border-ink-muted",
        )}
      >
        {/* Unsolved: the check only appears on hover, as a hint of what a click does. */}
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className={cn("size-3.5", !optimistic && "opacity-0 group-hover:opacity-100")}
        />
      </button>
      {error ? (
        <span role="alert" className="text-xs text-negative">
          {error}
        </span>
      ) : null}
    </span>
  );
}
