import Link from "next/link";
import { z } from "zod";
import { Markdown } from "@/components/feed/markdown";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { requireViewer } from "@/modules/auth/session";
import { deleteAllSubmissionsAction, deleteSubmissionAction } from "@/modules/integrations/actions";
import { codeFence, languageLabel } from "@/modules/integrations/languages";
import { submissionIdSchema } from "@/modules/integrations/schemas";
import {
  listSubmissions,
  matchWaitingSubmissions,
  WAITING_DAYS,
  type SubmissionItem,
} from "@/modules/integrations/submissions";

export const metadata = { title: "Synced submissions" };

const querySchema = z.object({ before: submissionIdSchema.optional().catch(undefined) });

/** The viewer's own synced submissions and their code. Nobody else can see this page's data. */
export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await requireViewer();
  const { before } = querySchema.parse(await searchParams);
  // Anything waiting whose problem has been added since counts now, not at the next daily run.
  await matchWaitingSubmissions({ userId: user.id });
  const { items, nextCursor } = await listSubmissions(user.id, { before });

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Synced submissions"
        description={
          <>
            Accepted LeetCode submissions the extension synced. Only you can see them. A submission
            for a problem that isn&apos;t in Branch counts once someone adds it, and is deleted
            after {WAITING_DAYS} days otherwise.{" "}
            <Link href="/settings#extension" className="text-ink underline underline-offset-4">
              Extension settings
            </Link>
          </>
        }
      />
      <section aria-labelledby="submissions-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="submissions-heading" tabIndex={-1} className="text-base font-medium">
            {before ? "Older submissions" : "Submissions"}
          </h2>
          {items.length > 0 ? (
            <ConfirmAction
              action={deleteAllSubmissionsAction}
              fields={{}}
              focusAfterRemoval="submissions-heading"
              trigger="Delete all"
              triggerVariant="outline"
              title="Delete every synced submission?"
              description="Their code is deleted for good. Problems they marked solved stay solved."
              confirmLabel="Delete all"
              pendingLabel="Deleting…"
              destructive
            />
          ) : null}
        </div>
        {before ? (
          <Link
            href="/settings/submissions"
            className={buttonVariants({ variant: "outline", className: "self-start" })}
          >
            Back to newest
          </Link>
        ) : null}
        {items.length > 0 ? (
          <ol aria-label="Synced submissions" className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <SubmissionCard item={item} timeZone={profile.timezone} />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title={before ? "No older submissions" : "Nothing synced yet"}
            description={
              before
                ? "You've reached the first one."
                : "Connect the extension in Settings, then submit on LeetCode. Accepted submissions appear here."
            }
          />
        )}
        {nextCursor ? (
          <Link
            href={`/settings/submissions?before=${nextCursor}`}
            className={buttonVariants({ variant: "outline", className: "self-center" })}
          >
            Older submissions
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function SubmissionCard({ item, timeZone }: { item: SubmissionItem; timeZone: string }) {
  const headingId = `submission-${item.id}`;
  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-3 rounded-xl bg-surface p-4">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="flex flex-wrap items-center gap-2 font-medium">
            <a
              href={`https://leetcode.com/problems/${item.problemSlug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {item.problem?.title ?? item.problemSlug}
              <span className="sr-only"> (opens LeetCode in a new tab)</span>
            </a>
            {item.problem ? <DifficultyPill difficulty={item.problem.difficulty} /> : null}
          </h3>
          <p className="text-xs text-ink-muted">
            {languageLabel(item.language)} ·{" "}
            <time
              dateTime={item.submittedAt.toISOString()}
              title={formatDateTime(item.submittedAt, timeZone)}
            >
              {formatDate(item.submittedAt, timeZone, true)}
            </time>
          </p>
        </div>
        <ConfirmAction
          action={deleteSubmissionAction}
          fields={{ submissionId: item.id }}
          focusAfterRemoval="submissions-heading"
          trigger="Delete"
          title="Delete this submission?"
          description="Its code is deleted for good. If it marked the problem solved, the problem stays solved."
          confirmLabel="Delete submission"
          pendingLabel="Deleting…"
          destructive
        />
      </div>
      {item.waitingUntil ? (
        <p className="rounded-[10px] bg-raised px-3 py-2 text-ink-muted">
          Not counted yet: this problem isn&apos;t in Branch. It counts once someone adds it to a
          roadmap, and is deleted on {formatDate(item.waitingUntil, timeZone, true)} otherwise.
        </p>
      ) : null}
      <details className="group">
        <summary className="inline-flex min-h-8 cursor-pointer items-center rounded-full font-medium text-ink-muted hover:text-ink pointer-coarse:min-h-11">
          <span className="group-open:hidden">Show code</span>
          <span className="hidden group-open:inline">Hide code</span>
        </summary>
        <div className="pt-2">
          <Markdown>{codeFence(item.code, item.language)}</Markdown>
        </div>
      </details>
    </article>
  );
}
