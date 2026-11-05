import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/user/avatar";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { CommentItem, CommentThread } from "@/modules/feed/threads";
import { CommentForm } from "./comment-form";
import { commentsToggleId } from "./comment-ids";
import { Markdown } from "./markdown";
import { EditableBody } from "./post-actions";

/**
 * The thread inside a post's card: its comments, links to the rest when there are more than
 * shown, and the form for a new comment.
 */
export function PostComments({
  postId,
  threads,
  total,
  earlier,
  later,
  now,
  timeZone,
}: {
  postId: string;
  threads: CommentThread[];
  /** Every comment on the post, replies included. */
  total: number;
  /** Paging links on the post's own page. */
  earlier?: string;
  later?: string;
  now: Date;
  timeZone: string;
}) {
  const shown = threads.reduce((sum, thread) => sum + 1 + thread.replies.length, 0);
  // In a feed (no paging links), the post's page has whatever didn't fit.
  const seeAll = !earlier && !later && shown < total ? `/posts/${postId}` : undefined;
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
    >
      {label}
    </Link>
  );
  return (
    <div className="mt-1 flex flex-col gap-5 border-t border-line pt-4">
      {earlier ? link(earlier, "Earlier comments") : null}
      {threads.length > 0 ? (
        <CommentList postId={postId} threads={threads} now={now} timeZone={timeZone} />
      ) : null}
      {later ? link(later, "Later comments") : null}
      {seeAll ? link(seeAll, `See all ${total} comments`) : null}
      <CommentForm postId={postId} label="Add a comment" submitLabel="Post comment" />
    </div>
  );
}

/**
 * Top-level comments in order, each with its replies hanging off a thread line beneath the
 * commenter's avatar, and a folded "Reply" form at the end of the thread.
 */
function CommentList({
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
    <ol aria-label="Comments" className="flex flex-col gap-5">
      {threads.map((thread) => (
        <li key={thread.id} className="flex flex-col gap-3">
          <Comment postId={postId} comment={thread} now={now} timeZone={timeZone} />
          {/* The line sits under the avatar's centre; the text column starts past the avatar. */}
          <div className="ml-[0.6875rem] flex flex-col gap-3 border-l-2 border-line pl-[1.1875rem]">
            {thread.replies.length > 0 ? (
              <ol aria-label={`Replies to ${thread.author.name}`} className="flex flex-col gap-3">
                {thread.replies.map((reply) => (
                  <li key={reply.id}>
                    <Comment postId={postId} comment={reply} now={now} timeZone={timeZone} />
                  </li>
                ))}
              </ol>
            ) : null}
            <details className="group">
              <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-full text-xs font-medium text-ink-muted hover:text-ink pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
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
                  label={`Reply to ${thread.author.name}`}
                  submitLabel="Reply"
                />
              </div>
            </details>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Comment({
  postId,
  comment,
  now,
  timeZone,
}: {
  postId: string;
  comment: CommentItem;
  now: Date;
  timeZone: string;
}) {
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
          body={comment.body}
          spoiler={comment.spoiler}
          canEdit={comment.canEdit}
          canDelete={comment.canDelete}
          focusAfterRemoval={commentsToggleId(postId)}
        >
          <Markdown spoiler={comment.spoiler}>{comment.body}</Markdown>
        </EditableBody>
      </div>
    </article>
  );
}
