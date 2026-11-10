import { formatCalendarDate } from "@branch/shared/calendar";
import Link from "next/link";
import { BranchWordmark } from "@/components/brand/branch-mark";
import { CHANGELOG } from "@/modules/changelog/entries";

export const metadata = {
  title: "What's new",
  description: "Every update to Branch, newest first.",
};

/** Public, like the privacy policy: Home's "What's new" card links here. */
export default function ChangelogPage() {
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="self-start rounded-md py-1">
        <BranchWordmark />
      </Link>
      <main className="prose-branch mx-auto w-full max-w-2xl py-10">
        <h1>What&apos;s new</h1>
        <p className="text-ink-muted">Every update to Branch, newest first.</p>
        <ol aria-label="Updates" className="mt-2 flex flex-col">
          {CHANGELOG.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 border-t border-line py-5">
              <p className="text-ink-muted">
                <time dateTime={entry.date}>
                  {formatCalendarDate(entry.date, { year: "numeric" })}
                </time>
              </p>
              <h2>
                <Link href={`/changelog/${entry.id}`} className="text-ink">
                  {entry.title}
                </Link>
              </h2>
              <p className="text-ink-muted">{entry.summary}</p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
