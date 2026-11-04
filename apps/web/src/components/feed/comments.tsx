import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/user/avatar";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { CommentItem, CommentThread } from "@/modules/feed/comments";
import { CommentForm } from "./comment-form";
import { Markdown } from "./markdown";
import { EditableBody } from "./post-actions";

/** Top-level comments, each with its replies and a folded "Reply" form at the end. */
export function CommentList({
  postId,
  threads,
  now,
  timeZone,
}: {
  postId: string;
  threads: CommentThread[];
  now: Date;
  timeZone: string;
}) {
  return (
    <ol aria-label="Comments" className="flex flex-col gap-3">
      {threads.map((thread) => (
        <li key={thread.id} className="flex flex-col gap-3 rounded-xl bg-surface p-4">
          <Comment comment={thread} now={now} timeZone={timeZone} />
          {thread.replies.length > 0 ? (
            <ol
              aria-label={`Replies to ${thread.author?.name ?? "a deleted comment"}`}
              className="ml-3 flex flex-col gap-3 border-l-2 border-line pl-4"
            >
              {thread.replies.map((reply) => (
                <li key={reply.id}>
                  <Comment comment={reply} now={now} timeZone={timeZone} />
                </li>
              ))}
            </ol>
          ) : null}
          <details className="group ml-3 pl-4">
            <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-full font-medium text-ink-muted hover:text-ink pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden
                className="size-4 transition-[rotate] duration-(--duration-fast) group-open:rotate-90"
              />
              Reply
            </summary>
            <div className="pt-2">
              <CommentForm
                postId={postId}
                parentId={thread.id}
                label={`Reply to ${thread.author?.name ?? "this thread"}`}
                submitLabel="Reply"
              />
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}

function Comment({
  comment,
  now,
  timeZone,
}: {
  comment: CommentItem;
  now: Date;
  timeZone: string;
}) {
  if (comment.deleted || !comment.author) {
    return (
      <article aria-label="Deleted comment">
        <p className="text-ink-muted italic">Comment deleted.</p>
      </article>
    );
  }
  const headingId = `comment-${comment.id}-author`;
  return (
    <article aria-labelledby={headingId} className="flex gap-3">
      <Avatar userId={comment.author.id} name={comment.author.name} size="sm" className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span id={headingId} className="font-medium">
            {comment.author.name}
          </span>
          <span className="text-xs text-ink-muted">
            <time
              dateTime={comment.createdAt.toISOString()}
              title={formatDateTime(comment.createdAt, timeZone)}
            >
              {formatRelative(comment.createdAt, now, timeZone)}
            </time>
            {comment.editedAt ? <span> · edited</span> : null}
          </span>
        </p>
        <EditableBody
          target="comment"
          id={comment.id}
          body={comment.body ?? ""}
          spoiler={comment.spoiler}
          canEdit={comment.canEdit}
          canDelete={comment.canDelete}
        >
          <Markdown spoiler={comment.spoiler}>{comment.body ?? ""}</Markdown>
        </EditableBody>
      </div>
    </article>
  );
}
