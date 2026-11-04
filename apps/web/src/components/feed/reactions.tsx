"use client";

import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setReactionAction } from "@/modules/feed/actions";
import { REACTIONS, type ReactionKindValue } from "@/modules/feed/schemas";
import type { ReactionSummary } from "@/modules/feed/service";

/**
 * The four reactions as toggle buttons. Each flips at once; if saving fails, React drops the
 * optimistic value and the reason is shown. Pressed reactions get an outline as well as a fill,
 * so the state doesn't rest on colour alone.
 */
export function ReactionBar({ postId, reactions }: { postId: string; reactions: ReactionSummary }) {
  const [optimistic, toggleOptimistic] = useOptimistic(
    reactions,
    (current, kind: ReactionKindValue) =>
      current.map((r) =>
        r.kind === kind ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r,
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(kind: ReactionKindValue, on: boolean) {
    setError(null);
    startTransition(async () => {
      toggleOptimistic(kind);
      const result = await setReactionAction(postId, kind, on);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Reactions">
      {REACTIONS.map(({ kind, emoji, label }) => {
        const { count, mine } = optimistic.find((r) => r.kind === kind)!;
        return (
          <button
            key={kind}
            type="button"
            aria-pressed={mine}
            title={label}
            onClick={() => toggle(kind, !mine)}
            className={cn(
              "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border px-2 text-xs font-medium tabular transition-colors duration-(--duration-fast) pointer-coarse:h-11 pointer-coarse:min-w-11",
              mine
                ? "border-control bg-raised text-ink"
                : "border-transparent text-ink-muted hover:bg-raised",
            )}
          >
            <span aria-hidden className="text-sm leading-none">
              {emoji}
            </span>
            <span className="sr-only">{label}</span>
            {count > 0 ? <span>{count}</span> : null}
          </button>
        );
      })}
      {error ? (
        <span role="alert" className="text-xs text-negative">
          {error}
        </span>
      ) : null}
    </div>
  );
}
