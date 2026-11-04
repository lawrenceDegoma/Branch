import Link from "next/link";
import { CommentForm } from "@/components/feed/comment-form";
import { CommentList } from "@/components/feed/comments";
import { PostCard } from "@/components/feed/post-card";
import { PageHeader } from "@/components/shell/page-header";
import { buttonVariants } from "@/components/ui/button";
import { orNotFound } from "@/lib/not-found";
import { requireViewer } from "@/modules/auth/session";
import { listComments } from "@/modules/feed/comments";
import { commentQuerySchema } from "@/modules/feed/schemas";
import { getPost } from "@/modules/feed/service";

export const metadata = { title: "Post" };

type Props = {
  params: Promise<{ postId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** One post with its comments. Members of the post's group only; anyone else gets the 404. */
export default async function PostPage({ params, searchParams }: Props) {
  const { user, profile } = await requireViewer();
  const { postId } = await params;
  const { after } = commentQuerySchema.parse(await searchParams);
  const post = await orNotFound(getPost(user.id, postId));
  const comments = await listComments(user.id, post.id, { after });
  const now = new Date();
  const total = post.commentCount;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Post"
        description={
          <>
            In{" "}
            <Link
              href={`/groups/${post.group.id}`}
              className="font-medium text-ink underline-offset-4 hover:underline"
            >
              {post.group.name}
            </Link>
          </>
        }
      />
      <div className="flex flex-col gap-6">
        <PostCard
          post={post}
          now={now}
          timeZone={profile.timezone}
          showGroup={false}
          linkComments={false}
          returnTo={`/groups/${post.group.id}`}
        />
        <section id="comments" aria-labelledby="comments-heading" className="flex flex-col gap-4">
          <h2 id="comments-heading" tabIndex={-1} className="text-base font-medium">
            Comments{total > 0 ? <span className="text-ink-muted tabular"> {total}</span> : null}
          </h2>
          {after ? (
            <Link
              href={`/posts/${post.id}#comments`}
              className={buttonVariants({ variant: "outline", className: "self-start" })}
            >
              Earlier comments
            </Link>
          ) : null}
          {comments.items.length > 0 ? (
            <CommentList
              postId={post.id}
              threads={comments.items}
              now={now}
              timeZone={profile.timezone}
            />
          ) : after ? null : (
            <p className="text-ink-muted">No comments yet. Start the conversation.</p>
          )}
          {comments.nextCursor ? (
            <Link
              href={`/posts/${post.id}?after=${comments.nextCursor}#comments`}
              className={buttonVariants({ variant: "outline", className: "self-start" })}
            >
              Later comments
            </Link>
          ) : null}
          <div className="rounded-xl bg-surface p-4">
            <CommentForm postId={post.id} label="Add a comment" submitLabel="Comment" />
          </div>
        </section>
      </div>
    </div>
  );
}
