import { CircleCheck, Flag } from "lucide-react";
import Link from "next/link";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { DifficultyPill } from "@/components/roadmaps/difficulty-pill";
import { Avatar } from "@/components/user/avatar";
import { formatDateTime, formatRelative } from "@/lib/format";
import { hidePostAction } from "@/modules/feed/actions";
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
      {post.kind === "TEXT" ? (
        <>
          {post.problem ? (
            <p className="flex flex-wrap items-center gap-2 text-ink-muted">
              <span>About</span>
              <ProblemLink problem={post.problem} />
            </p>
          ) : null}
          <EditablePostBody
            postId={post.id}
            body={post.body ?? ""}
            spoiler={post.spoiler}
            canEdit={post.canEdit}
            canDelete={post.canDelete}
          >
            <Markdown spoiler={post.spoiler}>{post.body ?? ""}</Markdown>
          </EditablePostBody>
        </>
      ) : (
        <div className="-my-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <AutomaticPostBody post={post} />
          {post.canHide ? (
            <div className="ml-auto">
              <ConfirmAction
                action={hidePostAction}
                fields={{ postId: post.id }}
                trigger="Hide"
                title="Hide this post?"
                description="It disappears from the group's feed for everyone and won't be posted again. Your progress doesn't change."
                confirmLabel="Hide post"
                pendingLabel="Hiding…"
              />
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}

function ProblemLink({ problem }: { problem: NonNullable<FeedItem["problem"]> }) {
  return (
    <>
      <a
        href={`https://leetcode.com/problems/${problem.leetcodeSlug}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-ink underline-offset-4 hover:underline"
      >
        {problem.title}
        <span className="sr-only"> (opens LeetCode in a new tab)</span>
      </a>
      <DifficultyPill difficulty={problem.difficulty} />
    </>
  );
}

/** A solve or a milestone, in one quiet line; the orange mark is progress data. */
function AutomaticPostBody({ post }: { post: FeedItem }) {
  const Icon = post.kind === "SOLVE" ? CircleCheck : Flag;
  return (
    <p className="flex flex-wrap items-center gap-2">
      <Icon aria-hidden className="size-4 flex-none text-brand" />
      {post.kind === "SOLVE" && post.problem ? (
        <>
          <span>Solved</span>
          <ProblemLink problem={post.problem} />
        </>
      ) : post.kind === "WEEK_DONE" ? (
        <span>
          Finished week {post.weekNumber} of{" "}
          <span className="font-medium">{post.roadmap?.title}</span>
        </span>
      ) : (
        <span>
          Finished every problem in <span className="font-medium">{post.roadmap?.title}</span>
        </span>
      )}
    </p>
  );
}
