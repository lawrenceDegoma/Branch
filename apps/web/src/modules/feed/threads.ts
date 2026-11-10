import "server-only";
import type { prisma } from "@branch/database";
import { photoSelect, shownPhoto } from "@/modules/profile/photo";

// Shaping comment rows into threads, shared by the post page (paged) and the feed (inline).

/** Replies shown under one comment; generous for a group of friends, but bounded. */
export const REPLIES_SHOWN = 100;

const commentInclude = { author: { select: { id: true, name: true, ...photoSelect } } } as const;

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

function toCommentItem(
  row: CommentRow,
  viewerId: string,
  isAdmin: boolean,
  blocked: ReadonlySet<string>,
) {
  const mine = row.authorId === viewerId;
  return {
    id: row.id,
    body: row.body,
    spoiler: row.spoiler,
    author: { id: row.author.id, name: row.author.name, photo: shownPhoto(row.author) },
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    canEdit: mine,
    canDelete: mine || isAdmin,
    /** The viewer blocked its author: shown folded. */
    blocked: blocked.has(row.authorId),
    /** Someone else's; the admin removes rather than reports. */
    canReport: !mine && !isAdmin,
    canBlock: !mine,
  };
}
export type CommentItem = ReturnType<typeof toCommentItem>;
export type CommentThread = CommentItem & { replies: CommentItem[] };

export function toThread(
  row: ThreadRow,
  viewerId: string,
  isAdmin: boolean,
  blocked: ReadonlySet<string>,
): CommentThread {
  return {
    ...toCommentItem(row, viewerId, isAdmin, blocked),
    replies: row.replies.map((reply) => toCommentItem(reply, viewerId, isAdmin, blocked)),
  };
}
