import Link from "next/link";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";
import { Avatar } from "@/components/user/avatar";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { FeedItem } from "@/modules/feed/service";
import { Markdown } from "./markdown";
import { EditablePostBody } from "./post-actions";

export function PostCard({
  post,
  now,
  timeZone,
  showGroup,
}: {
  post: FeedItem;
  now: Date;
  timeZone: string;
  showGroup: boolean;
}) {
  const headingId = `post-${post.id}-author`;
  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5"
    >
      <header className="flex items-start gap-3">
        <Avatar userId={post.author.id} name={post.author.name} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span id={headingId} className="font-medium">
              {post.author.name}
            </span>
            {showGroup ? (
              <span className="text-ink-muted">
                in{" "}
                <Link
                  href={`/groups/${post.group.id}`}
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {post.group.name}
                </Link>
              </span>
            ) : null}
          </p>
          <p className="text-xs text-ink-muted">
            <time
              dateTime={post.createdAt.toISOString()}
              title={formatDateTime(post.createdAt, timeZone)}
            >
              {formatRelative(post.createdAt, now, timeZone)}
            </time>
            {post.editedAt ? <span> · edited</span> : null}
          </p>
        </div>
      </header>
      {post.problem ? (
        <p className="flex flex-wrap items-center gap-2 text-ink-muted">
          <span>About</span>
          <a
            href={`https://leetcode.com/problems/${post.problem.leetcodeSlug}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink underline-offset-4 hover:underline"
          >
            {post.problem.title}
            <span className="sr-only"> (opens LeetCode in a new tab)</span>
          </a>
          <DifficultyPill difficulty={post.problem.difficulty} />
        </p>
      ) : null}
      <EditablePostBody
        postId={post.id}
        body={post.body}
        canEdit={post.canEdit}
        canDelete={post.canDelete}
      >
        <Markdown>{post.body}</Markdown>
      </EditablePostBody>
    </article>
  );
}
