import Link from "next/link";
import { z } from "zod";
import { Markdown } from "@/components/feed/markdown";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { PasteSolutionForm } from "@/components/integrations/paste-solution-form";
import { RefreshWhileAnalyzing } from "@/components/integrations/refresh-while-analyzing";
import { SolutionAnalysis } from "@/components/integrations/solution-analysis";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { serverEnv } from "@/lib/env";
import { formatDate, formatDateTime } from "@/lib/format";
import { analysisState } from "@/modules/analysis/service";
import { requireViewer } from "@/modules/auth/session";
import { deleteAllSubmissionsAction, deleteSubmissionAction } from "@/modules/integrations/actions";
import { codeFence, languageLabel, PASTE_LANGUAGES } from "@/modules/integrations/languages";
import { SUBMISSION_CODE_MAX, submissionIdSchema } from "@/modules/integrations/schemas";
import {
  listSolvedProblems,
  listSubmissions,
  matchWaitingSubmissions,
  WAITING_DAYS,
  type SubmissionItem,
} from "@/modules/integrations/submissions";

export const metadata = { title: "Your solutions" };

const SOURCE_LABEL = { LEETCODE: "LeetCode", NEETCODE: "neetcode.io", PASTED: "Pasted" } as const;

const querySchema = z.object({ before: submissionIdSchema.optional().catch(undefined) });

/**
 * The viewer's own solutions (synced by the extension, or pasted), their code, and their analysis.
 * Nobody else can see this page's data.
 */
export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await requireViewer();
  const { before } = querySchema.parse(await searchParams);
  // Anything waiting whose problem has been added since counts now, not at the next daily run.
  await matchWaitingSubmissions({ userId: user.id });
  const [{ items, nextCursor }, solved, analysis] = await Promise.all([
    listSubmissions(user.id, { before }),
    listSolvedProblems(user.id),
    analysisState(user.id),
  ]);
  const analysisOn = Boolean(serverEnv().ANALYZER_URL);
  return (
    <div className="max-w-3xl">
      {analysisOn && items.length > 0 ? (
        <RefreshWhileAnalyzing fingerprint={analysis.fingerprint} />
      ) : null}
      <PageHeader
        title="Your solutions"
        description={
          <>
            Solutions the extension synced from LeetCode and neetcode.io, and ones you pasted, with
            an estimate of each one&apos;s complexity. Only you can see them. A synced submission
            for a problem that isn&apos;t in Branch counts once someone adds it, and is deleted
            after {WAITING_DAYS} days otherwise.{" "}
            <Link href="/settings#extension" className="text-ink underline underline-offset-4">
              Extension settings
            </Link>
          </>
        }
      />
      <details className="group mb-8 rounded-xl bg-surface">
        <summary className="flex min-h-12 cursor-pointer items-center rounded-xl px-4 font-medium">
          Paste a solution
        </summary>
        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="text-ink-muted">
            For a problem you solved without the extension. It&apos;s analyzed like a synced one,
            and doesn&apos;t change whether the problem counts as solved.
          </p>
          {solved.length > 0 ? (
            <PasteSolutionForm
              problems={solved}
              languages={PASTE_LANGUAGES}
              codeMax={SUBMISSION_CODE_MAX}
            />
          ) : (
            <p>Mark a problem solved first, then paste your solution for it here.</p>
          )}
        </div>
      </details>
      <section aria-labelledby="submissions-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="submissions-heading" tabIndex={-1} className="text-base font-medium">
            {before ? "Older solutions" : "Solutions"}
          </h2>
          {items.length > 0 ? (
            <ConfirmAction
              action={deleteAllSubmissionsAction}
              fields={{}}
              focusAfterRemoval="submissions-heading"
              trigger="Delete all"
              triggerVariant="outline"
              title="Delete every solution?"
              description="Their code and analysis are deleted for good. Problems they marked solved stay solved."
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
          <ol aria-label="Your solutions" className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <SubmissionCard item={item} timeZone={profile.timezone} analysisOn={analysisOn} />
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title={before ? "No older solutions" : "No solutions yet"}
            description={
              before
                ? "You've reached the first one."
                : "Connect the extension in Settings and submit on LeetCode or neetcode.io, or paste a solution above. They appear here."
            }
          />
        )}
        {nextCursor ? (
          <Link
            href={`/settings/submissions?before=${nextCursor}`}
            className={buttonVariants({ variant: "outline", className: "self-center" })}
          >
            Older solutions
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function SubmissionCard({
  item,
  timeZone,
  analysisOn,
}: {
  item: SubmissionItem;
  timeZone: string;
  analysisOn: boolean;
}) {
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
            {SOURCE_LABEL[item.source]} · {languageLabel(item.language)} ·{" "}
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
          title="Delete this solution?"
          description="Its code and analysis are deleted for good. If it marked the problem solved, the problem stays solved."
          confirmLabel="Delete solution"
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
      {analysisOn ? <SolutionAnalysis analysis={item.analysis} language={item.language} /> : null}
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
