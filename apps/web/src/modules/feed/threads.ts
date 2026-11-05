import "server-only";
import type { prisma } from "@branch/database";

// Shaping comment rows into threads, shared by the post page (paged) and the feed (inline).

/** Replies shown under one comment; generous for a group of friends, but bounded. */
export const REPLIES_SHOWN = 100;

const commentInclude = { author: { select: { id: true, name: true } } } as const;

/** Prisma include for a top-level comment with its replies. */
export const threadInclude = {
  ...commentInclude,
  replies: { orderBy: { id: "asc" }, take: REPLIES_SHOWN, include: commentInclude },
} as const;

type CommentRow = Awaited<
  ReturnType<typeof prisma.comment.findMany<{ include: typeof commentInclude }>>
>[number];
type ThreadRow = Awaited<
  ReturnType<typeof prisma.comment.findMany<{ include: typeof threadInclude }>>
>[number];

function toCommentItem(row: CommentRow, viewerId: string, isAdmin: boolean) {
  return {
    id: row.id,
    body: row.body,
    spoiler: row.spoiler,
    author: row.author,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    canEdit: row.authorId === viewerId,
    canDelete: row.authorId === viewerId || isAdmin,
  };
}
export type CommentItem = ReturnType<typeof toCommentItem>;
export type CommentThread = CommentItem & { replies: CommentItem[] };

export function toThread(row: ThreadRow, viewerId: string, isAdmin: boolean): CommentThread {
  return {
    ...toCommentItem(row, viewerId, isAdmin),
    replies: row.replies.map((reply) => toCommentItem(reply, viewerId, isAdmin)),
  };
}
