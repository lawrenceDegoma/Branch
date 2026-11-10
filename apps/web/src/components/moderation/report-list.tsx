import Link from "next/link";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { formatDateTime, pluralize } from "@/lib/format";
import { deleteCommentAction, deletePostAction } from "@/modules/feed/actions";
import { dismissReportsAction } from "@/modules/moderation/actions";
import type { ReportedItem } from "@/modules/moderation/reports";
import { REASON_LABEL } from "@/modules/moderation/schemas";

/**
 * The admin's open reports: one row per reported post or comment, with why, and the two choices:
 * remove it (the usual audited delete, which closes its reports) or dismiss the reports. Who
 * reported is never shown.
 */
export function ReportList({
  groupId,
  items,
  timeZone,
}: {
  groupId: string;
  items: ReportedItem[];
  timeZone: string;
}) {
  if (items.length === 0) return <p className="text-ink-muted">No open reports.</p>;
  return (
    <ul aria-label="Open reports" className="flex flex-col divide-y divide-line">
      {items.map((item) => {
        const what = `${item.kind === "post" ? "post" : "comment"} by ${item.authorName}`;
        const target: Record<string, string> =
          item.kind === "post" ? { postId: item.id } : { commentId: item.id };
        return (
          <li
            key={`${item.kind}-${item.id}`}
            className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0"
          >
            <p className="font-medium">
              {item.kind === "post" ? "A post" : "A comment"} by {item.authorName}
            </p>
            <blockquote className="border-l-2 border-line pl-3 break-words whitespace-pre-wrap text-ink-muted">
              {item.excerpt}
            </blockquote>
            <p className="text-xs text-ink-muted">
              {pluralize(item.reports, "report")}:{" "}
              {item.reasons
                .map(({ reason, count }) =>
                  count > 1 ? `${REASON_LABEL[reason]} (${count})` : REASON_LABEL[reason],
                )
                .join(", ")}
              {" · "}first {formatDateTime(item.firstReportedAt, timeZone)}
            </p>
            {item.notes.length > 0 ? (
              <ul aria-label="Notes from reports" className="flex flex-col gap-1 text-sm">
                {item.notes.map((note, i) => (
                  <li key={i} className="break-words">
                    “{note}”
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/posts/${item.postId}`}
                className="text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                See it in context
              </Link>
              <span className="ml-auto flex flex-wrap gap-1">
                <ConfirmAction
                  action={dismissReportsAction}
                  fields={{ groupId, ...target }}
                  focusAfterRemoval="reports-heading"
                  trigger="Dismiss"
                  triggerName={`Dismiss the reports about the ${what}`}
                  title="Keep it up?"
                  description="The reports are closed and it stays. This is recorded in the group's activity log."
                  confirmLabel="Dismiss reports"
                  pendingLabel="Dismissing…"
                />
                <ConfirmAction
                  action={item.kind === "post" ? deletePostAction : deleteCommentAction}
                  fields={target}
                  focusAfterRemoval="reports-heading"
                  trigger="Remove"
                  triggerName={`Remove the ${what}`}
                  title={`Remove the ${what}?`}
                  description="It's deleted for everyone, and the removal is recorded in the group's activity log."
                  confirmLabel="Remove"
                  pendingLabel="Removing…"
                  destructive
                />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
