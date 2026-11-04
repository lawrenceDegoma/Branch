import "server-only";
import { prisma } from "@branch/database";
import { DomainError, ForbiddenError, NotFoundError } from "@/lib/errors";
import {
  COMMENT_PAGE_SIZE,
  commentIdSchema,
  type CreateCommentInput,
  type EditCommentInput,
} from "./schemas";
import { requireVisiblePost } from "./service";

// Comments live on a post and are visible exactly when the post is: to members of its group,
// while it isn't hidden or withdrawn. Two levels: top-level comments, and replies filed under one
// (a database trigger enforces it). Deleting a comment that has replies keeps a placeholder so
// the replies stay in context.

const COMMENTS_PER_MINUTE = 10;
/** Replies shown under one comment; generous for a group of friends, but bounded. */
const REPLIES_SHOWN = 100;

const commentInclude = { author: { select: { id: true, name: true } } } as const;
type CommentRow = Awaited<
  ReturnType<typeof prisma.comment.findMany<{ include: typeof commentInclude }>>
>[number];

function toCommentItem(row: CommentRow, viewerId: string, isAdmin: boolean) {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    deleted,
    // A deleted comment keeps nothing of its author's but its place in the thread.
    body: deleted ? null : row.body,
    spoiler: row.spoiler,
    author: deleted ? null : row.author,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    canEdit: !deleted && row.authorId === viewerId,
    canDelete: !deleted && (row.authorId === viewerId || isAdmin),
  };
}
export type CommentItem = ReturnType<typeof toCommentItem>;
export type CommentThread = CommentItem & { replies: CommentItem[] };

/** Top-level comments oldest first, each with its replies; paged by `after` (a comment ID). */
export async function listComments(
  viewerId: string,
  postId: string,
  options: { after?: string; limit?: number } = {},
): Promise<{ items: CommentThread[]; nextCursor: string | null }> {
  const { membership } = await requireVisiblePost(viewerId, postId);
  const isAdmin = membership.role === "ADMIN";
  const limit = options.limit ?? COMMENT_PAGE_SIZE;
  const rows = await prisma.comment.findMany({
    where: { postId, parentId: null, ...(options.after ? { id: { gt: options.after } } : {}) },
    orderBy: { id: "asc" },
    take: limit + 1,
    include: {
      ...commentInclude,
      replies: { orderBy: { id: "asc" }, take: REPLIES_SHOWN, include: commentInclude },
    },
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((row) => ({
      ...toCommentItem(row, viewerId, isAdmin),
      replies: row.replies.map((reply) => toCommentItem(reply, viewerId, isAdmin)),
    })),
    nextCursor: rows.length > limit ? page.at(-1)!.id : null,
  };
}

export async function createComment(authorId: string, input: CreateCommentInput, now = new Date()) {
  await requireVisiblePost(authorId, input.postId);
  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.postId !== input.postId) {
      throw new NotFoundError("We couldn't find that comment.");
    }
    // Two levels: a reply to a reply joins the same thread.
    parentId = parent.parentId ?? parent.id;
  }
  const recent = await prisma.comment.count({
    where: { authorId, createdAt: { gt: new Date(now.getTime() - 60_000) } },
  });
  if (recent >= COMMENTS_PER_MINUTE) {
    throw new DomainError(
      "RATE_LIMITED",
      "You're commenting quickly. Wait a minute and try again.",
    );
  }
  return prisma.comment.create({
    data: {
      postId: input.postId,
      authorId,
      parentId,
      body: input.body,
      spoiler: input.spoiler,
      createdAt: now,
    },
  });
}

/** A live comment with its post's visibility and the viewer's membership checked. */
async function requireVisibleComment(viewerId: string, commentId: string) {
  if (!commentIdSchema.safeParse(commentId).success) {
    throw new NotFoundError("We couldn't find that comment.");
  }
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.deletedAt) throw new NotFoundError("We couldn't find that comment.");
  try {
    const { post, membership } = await requireVisiblePost(viewerId, comment.postId);
    return { comment, post, membership };
  } catch (error) {
    if (error instanceof NotFoundError) throw new NotFoundError("We couldn't find that comment.");
    throw error;
  }
}

/** Only the author edits. Non-members get NotFound; other members get Forbidden. */
export async function editComment(
  viewerId: string,
  commentId: string,
  input: EditCommentInput,
  now = new Date(),
) {
  const { comment } = await requireVisibleComment(viewerId, commentId);
  if (comment.authorId !== viewerId) {
    throw new ForbiddenError("Only the author can edit a comment.");
  }
  return prisma.comment.update({
    where: { id: commentId },
    data: { body: input.body, spoiler: input.spoiler, editedAt: now },
  });
}

/**
 * The author, or the group's admin (recorded in the audit log), deletes a comment. One with
 * replies becomes a placeholder; one without is removed, along with a placeholder parent it
 * leaves with no replies.
 */
export async function deleteComment(viewerId: string, commentId: string, now = new Date()) {
  const { comment, post, membership } = await requireVisibleComment(viewerId, commentId);
  const isAuthor = comment.authorId === viewerId;
  if (!isAuthor && membership.role !== "ADMIN") {
    throw new ForbiddenError("Only the author or the group admin can delete a comment.");
  }
  await prisma.$transaction(async (tx) => {
    const replies = await tx.comment.count({ where: { parentId: commentId } });
    if (replies > 0) {
      await tx.comment.update({
        where: { id: commentId },
        data: { body: null, deletedAt: now },
      });
    } else {
      await tx.comment.delete({ where: { id: commentId } });
      if (comment.parentId) {
        await tx.comment.deleteMany({
          where: { id: comment.parentId, deletedAt: { not: null }, replies: { none: {} } },
        });
      }
    }
    if (!isAuthor) {
      await tx.groupAuditEvent.create({
        data: {
          groupId: post.groupId,
          action: "COMMENT_REMOVED",
          actorId: viewerId,
          subjectUserId: comment.authorId,
          metadata: { postId: post.id, commentId },
        },
      });
    }
  });
  return { postId: post.id };
}
