import { formatCalendarDate } from "@branch/shared/calendar";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { ChangelogEntry } from "@/modules/changelog/entries";
import { DismissWhatsNew } from "./dismiss-whats-new";

/** Home's card after an update: the newest unseen entry, and a count of any others. */
export function WhatsNew({
  entries,
  focusTarget,
}: {
  entries: readonly ChangelogEntry[];
  focusTarget: string;
}) {
  const [latest, ...more] = entries;
  if (!latest) return null;
  return (
    <section
      aria-labelledby="whats-new-heading"
      className="flex flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="whats-new-heading" className="text-base font-medium">
            What&apos;s new
          </h2>
          <p className="text-ink-muted">
            <time dateTime={latest.date}>{formatCalendarDate(latest.date)}</time>
          </p>
        </div>
        <DismissWhatsNew focusTarget={focusTarget} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{latest.title}</p>
        <p className="text-ink-muted">{latest.summary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/changelog/${latest.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Read more<span className="sr-only"> about {latest.title}</span>
        </Link>
        {more.length > 0 ? (
          <Link href="/changelog" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            And {more.length} more {more.length === 1 ? "update" : "updates"}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
