import "server-only";
import { prisma } from "@branch/database";
import { DomainError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireMembership } from "@/modules/groups/access";
import {
  FEED_PAGE_SIZE,
  postIdSchema,
  REACTIONS,
  type CreatePostInput,
  type EditPostInput,
  type ReactionKindValue,
} from "./schemas";
import { threadInclude, toThread, type CommentThread } from "./threads";

// Posts belong to exactly one group. A feed is the union of the viewer's groups, so every read
// starts from the viewer's memberships, and every write checks membership of the post's group.

const POSTS_PER_MINUTE = 5;
/** Top-level comments shown inline under a feed post; the post's page pages through the rest. */
const FEED_THREADS = 20;

const postInclude = {
  author: { select: { id: true, name: true, profile: { select: { username: true } } } },
  group: { select: { id: true, name: true } },
  problem: { select: { id: true, title: true, leetcodeSlug: true, difficulty: true } },
  plan: {
    select: { roadmapVersion: { select: { roadmap: { select: { id: true, title: true } } } } },
  },
  _count: { select: { comments: true } },
} as const;

/** Automatic posts the author hid, or whose solve was undone, show to no one. */
const visible = { hiddenAt: null, withdrawnAt: null } as const;

async function loadPostView(postId: string, viewerId: string) {
  if (!postIdSchema.safeParse(postId).success) return null;
  const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude });
  if (!post) return null;
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: post.groupId, userId: viewerId } },
  });
  return membership ? { post, membership } : null;
}

/**
 * A post the viewer may see and respond to: in one of their groups, and not hidden or withdrawn.
 * Anything else is NotFound, so a post's existence never leaks.
 */
export async function requireVisiblePost(viewerId: string, postId: string) {
  const found = await loadPostView(postId, viewerId);
  if (!found || found.post.hiddenAt || found.post.withdrawnAt) {
    throw new NotFoundError("We couldn't find that post.");
  }
  return found;
}

export type ReactionSummary = { kind: ReactionKindValue; count: number; mine: boolean }[];

/** Counts of each reaction on each post, and which ones the viewer gave. Two queries per page. */
async function reactionSummaries(viewerId: string, postIds: string[]) {
  const [counts, mine] = await Promise.all([
    prisma.reaction.groupBy({
      by: ["postId", "kind"],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    }),
    prisma.reaction.findMany({
      where: { postId: { in: postIds }, userId: viewerId },
      select: { postId: true, kind: true },
    }),
  ]);
  const key = (postId: string, kind: string) => `${postId}:${kind}`;
  const countOf = new Map(counts.map((c) => [key(c.postId, c.kind), c._count._all]));
  const given = new Set(mine.map((m) => key(m.postId, m.kind)));
  return (postId: string): ReactionSummary =>
    REACTIONS.map(({ kind }) => ({
      kind,
      count: countOf.get(key(postId, kind)) ?? 0,
      mine: given.has(key(postId, kind)),
    }));
}

function toFeedItem(
  post: Awaited<ReturnType<typeof prisma.post.findMany<{ include: typeof postInclude }>>>[number],
  viewerId: string,
  adminGroupIds: ReadonlySet<string>,
  reactions: ReactionSummary,
) {
  const isAuthor = post.authorId === viewerId;
  const written = post.kind === "TEXT";
  return {
    id: post.id,
    kind: post.kind,
    /** Set for TEXT posts only. */
    body: post.body,
    spoiler: post.spoiler,
    createdAt: post.createdAt,
    editedAt: post.editedAt,
    author: { id: post.author.id, name: post.author.name, username: post.author.profile?.username },
    group: post.group,
    problem: post.problem,
    roadmap: post.plan?.roadmapVersion.roadmap ?? null,
    weekNumber: post.weekNumber,
    reactions,
    commentCount: post._count.comments,
    canEdit: written && isAuthor,
    // Automatic posts hold no member-written text to moderate; the author hides them instead.
    canDelete: written && (isAuthor || adminGroupIds.has(post.groupId)),
    canHide: !written && isAuthor,
  };
}
export type FeedItem = ReturnType<typeof toFeedItem> & {
  /** In a feed: the first top-level comments with their replies, shown inside the post. */
  threads?: CommentThread[];
};
export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

/**
 * Newest first across the viewer's groups, or one group when `groupId` is given (404 for a group
 * the viewer isn't in). Cursor pagination on the time-ordered post ID.
 */
export async function listFeed(
  viewerId: string,
  options: { groupId?: string; before?: string; limit?: number } = {},
): Promise<FeedPage> {
  const limit = options.limit ?? FEED_PAGE_SIZE;
  const memberships = await prisma.groupMembership.findMany({
    where: { userId: viewerId },
    select: { groupId: true, role: true },
  });
  if (options.groupId) await requireMembership(viewerId, options.groupId);
  const groupIds = options.groupId ? [options.groupId] : memberships.map((m) => m.groupId);
  if (groupIds.length === 0) return { items: [], nextCursor: null };

  const posts = await prisma.post.findMany({
    where: {
      groupId: { in: groupIds },
      ...visible,
      ...(options.before ? { id: { lt: options.before } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit + 1,
    include: {
      ...postInclude,
      comments: {
        where: { parentId: null },
        orderBy: { id: "asc" },
        take: FEED_THREADS,
        include: threadInclude,
      },
    },
  });
  const admin = new Set(memberships.filter((m) => m.role === "ADMIN").map((m) => m.groupId));
  const page = posts.slice(0, limit);
  const reactionsOf = await reactionSummaries(
    viewerId,
    page.map((post) => post.id),
  );
  return {
    items: page.map((post) => ({
      ...toFeedItem(post, viewerId, admin, reactionsOf(post.id)),
      threads: post.comments.map((c) => toThread(c, viewerId, admin.has(post.groupId))),
    })),
    nextCursor: posts.length > limit ? page.at(-1)!.id : null,
  };
}

/** One post, for its own page. */
export async function getPost(viewerId: string, postId: string): Promise<FeedItem> {
  const { post, membership } = await requireVisiblePost(viewerId, postId);
  const admin = new Set(membership.role === "ADMIN" ? [post.groupId] : []);
  const reactionsOf = await reactionSummaries(viewerId, [post.id]);
  return toFeedItem(post, viewerId, admin, reactionsOf(post.id));
}

/** Groups the viewer can post to, each with the problems its active plan assigns. */
export async function listComposerGroups(viewerId: string) {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId: viewerId },
    orderBy: { group: { name: "asc" } },
    select: {
      group: {
        select: {
          id: true,
          name: true,
          plans: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              assignments: {
                orderBy: [{ weekNumber: "asc" }, { roadmapItem: { position: "asc" } }],
                select: {
                  roadmapItem: { select: { problem: { select: { id: true, title: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
  return memberships.map(({ group }) => ({
    id: group.id,
    name: group.name,
    problems: (group.plans[0]?.assignments ?? []).map((a) => a.roadmapItem.problem),
  }));
}
export type ComposerGroup = Awaited<ReturnType<typeof listComposerGroups>>[number];

export async function createPost(authorId: string, input: CreatePostInput, now = new Date()) {
  await requireMembership(authorId, input.groupId);
  if (input.problemId) {
    const problem = await prisma.problem.findUnique({ where: { id: input.problemId } });
    if (!problem)
      throw new DomainError("UNKNOWN_PROBLEM", "Choose a problem from the list.", "problemId");
  }
  const recent = await prisma.post.count({
    where: { authorId, createdAt: { gt: new Date(now.getTime() - 60_000) } },
  });
  if (recent >= POSTS_PER_MINUTE) {
    throw new DomainError("RATE_LIMITED", "You're posting quickly. Wait a minute and try again.");
  }
  return prisma.post.create({
    data: {
      groupId: input.groupId,
      authorId,
      body: input.body,
      problemId: input.problemId,
      spoiler: input.spoiler,
      createdAt: now,
    },
  });
}

/** Only the author edits. Non-members get NotFound; other members get Forbidden. */
export async function editPost(
  viewerId: string,
  postId: string,
  input: EditPostInput,
  now = new Date(),
) {
  const found = await loadPostView(postId, viewerId);
  if (!found) throw new NotFoundError("We couldn't find that post.");
  if (found.post.authorId !== viewerId)
    throw new ForbiddenError("Only the author can edit a post.");
  if (found.post.kind !== "TEXT") throw new ForbiddenError("Automatic posts can't be edited.");
  return prisma.post.update({
    where: { id: postId },
    data: { body: input.body, spoiler: input.spoiler, editedAt: now },
  });
}

/** The author, or the group's admin (recorded in the audit log), may delete a post. */
export async function deletePost(viewerId: string, postId: string) {
  const found = await loadPostView(postId, viewerId);
  if (!found) throw new NotFoundError("We couldn't find that post.");
  const { post, membership } = found;
  const isAuthor = post.authorId === viewerId;
  if (post.kind !== "TEXT") {
    throw new ForbiddenError("Automatic posts can be hidden by their author, not deleted.");
  }
  if (!isAuthor && membership.role !== "ADMIN") {
    throw new ForbiddenError("Only the author or the group admin can delete a post.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.post.delete({ where: { id: postId } });
    if (!isAuthor) {
      await tx.groupAuditEvent.create({
        data: {
          groupId: post.groupId,
          action: "POST_REMOVED",
          actorId: viewerId,
          subjectUserId: post.authorId,
          metadata: { postId },
        },
      });
    }
  });
  return { groupId: post.groupId };
}

/**
 * The author hides one of their automatic posts. It stays hidden, and because the row remains,
 * solving the problem again never posts it anew. Hiding twice is harmless.
 */
export async function hidePost(viewerId: string, postId: string, now = new Date()) {
  const found = await loadPostView(postId, viewerId);
  if (!found) throw new NotFoundError("We couldn't find that post.");
  if (found.post.authorId !== viewerId) {
    throw new ForbiddenError("Only the author can hide a post.");
  }
  if (found.post.kind === "TEXT") {
    throw new ForbiddenError("Posts you wrote can be deleted instead.");
  }
  await prisma.post.updateMany({ where: { id: postId, hiddenAt: null }, data: { hiddenAt: now } });
  return { groupId: found.post.groupId };
}
