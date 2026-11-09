import { Award } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BADGE_ORDER, BADGES, type Award as Earned } from "@/modules/badges/service";

/** Settings: the viewer's milestones, earned (with when) and still to come. */
export function Badges({ earned, timeZone }: { earned: Earned[]; timeZone: string }) {
  const when = new Map(earned.map((a) => [a.kind, a.earnedAt]));
  return (
    <ul aria-label="Badges" className="grid gap-2 sm:grid-cols-2">
      {BADGE_ORDER.map((kind) => {
        const at = when.get(kind);
        return (
          <li
            key={kind}
            className={cn(
              "flex items-start gap-3 rounded-[10px] bg-raised px-3 py-2.5",
              !at && "border border-dashed border-line bg-transparent",
            )}
          >
            <Award
              aria-hidden
              className={cn("mt-0.5 size-4 shrink-0", at ? "text-brand" : "text-ink-faint")}
            />
            <div className="min-w-0">
              <p className={cn("font-medium", !at && "text-ink-muted")}>{BADGES[kind].label}</p>
              <p className="text-xs text-ink-muted">
                {at ? `Earned ${formatDate(at, timeZone, true)}` : BADGES[kind].how}
                {BADGES[kind].shown ? "" : " Only you see this one."}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
