import { formatCalendarDate } from "@branch/shared/calendar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BranchWordmark } from "@/components/brand/branch-mark";
import { Markdown } from "@/components/feed/markdown";
import { CHANGELOG } from "@/modules/changelog/entries";

type Params = { params: Promise<{ id: string }> };

const entryFor = (id: string) => CHANGELOG.find((entry) => entry.id === id);

export function generateStaticParams() {
  return CHANGELOG.map((entry) => ({ id: entry.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params) {
  const entry = entryFor((await params).id);
  return entry ? { title: entry.title, description: entry.summary } : {};
}

/** One update in full. Public; the IDs are permanent, so links to them keep working. */
export default async function ChangelogEntryPage({ params }: Params) {
  const entry = entryFor((await params).id);
  if (!entry) notFound();
  return (
    <div className="flex min-h-dvh flex-col px-4 py-6 sm:px-8">
      <Link href="/" className="self-start rounded-md py-1">
        <BranchWordmark />
      </Link>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-10">
        <Link
          href="/changelog"
          className="self-start text-ink-muted underline-offset-4 hover:underline"
        >
          All updates
        </Link>
        <h1 className="text-2xl font-semibold">{entry.title}</h1>
        <p className="text-ink-muted">
          <time dateTime={entry.date}>{formatCalendarDate(entry.date, { year: "numeric" })}</time>
        </p>
        <Markdown>{entry.details}</Markdown>
      </main>
    </div>
  );
}
