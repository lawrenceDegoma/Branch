import Link from "next/link";
import { PostComments } from "@/components/feed/comments";
import { PostCard } from "@/components/feed/post-card";
import { PageHeader } from "@/components/shell/page-header";
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

/**
 * One post with its comments open: the permalink, and where a long thread pages. Members of the
 * post's group only; anyone else gets the 404.
 */
export default async function PostPage({ params, searchParams }: Props) {
  const { user, profile } = await requireViewer();
  const { postId } = await params;
  const { after } = commentQuerySchema.parse(await searchParams);
  const post = await orNotFound(getPost(user.id, postId));
  const comments = await listComments(user.id, post.id, { after });
  const now = new Date();

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
      <PostCard
        post={post}
        now={now}
        timeZone={profile.timezone}
        showGroup={false}
        commentsOpen
        returnTo={`/groups/${post.group.id}`}
        comments={
          <PostComments
            postId={post.id}
            threads={comments.items}
            total={post.commentCount}
            earlier={after ? `/posts/${post.id}` : undefined}
            later={
              comments.nextCursor ? `/posts/${post.id}?after=${comments.nextCursor}` : undefined
            }
            now={now}
            timeZone={profile.timezone}
          />
        }
      />
    </div>
  );
}
