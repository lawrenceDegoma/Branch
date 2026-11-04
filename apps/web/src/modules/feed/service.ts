import "server-only";
import { prisma } from "@branch/database";
import { DomainError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireMembership } from "@/modules/groups/access";
import { FEED_PAGE_SIZE, type CreatePostInput, type EditPostInput } from "./schemas";

// Posts belong to exactly one group. A feed is the union of the viewer's groups, so every read
// starts from the viewer's memberships, and every write checks membership of the post's group.

const POSTS_PER_MINUTE = 5;

const postInclude = {
  author: { select: { id: true, name: true, profile: { select: { username: true } } } },
  group: { select: { id: true, name: true } },
  problem: { select: { id: true, title: true, leetcodeSlug: true, difficulty: true } },
} as const;

async function loadPostView(postId: string, viewerId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, include: postInclude });
  if (!post) return null;
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: post.groupId, userId: viewerId } },
  });
  return membership ? { post, membership } : null;
}

function toFeedItem(
  post: Awaited<ReturnType<typeof prisma.post.findMany<{ include: typeof postInclude }>>>[number],
  viewerId: string,
  adminGroupIds: ReadonlySet<string>,
) {
  const isAuthor = post.authorId === viewerId;
  return {
    id: post.id,
    body: post.body,
    spoiler: post.spoiler,
    createdAt: post.createdAt,
    editedAt: post.editedAt,
    author: { id: post.author.id, name: post.author.name, username: post.author.profile?.username },
    group: post.group,
    problem: post.problem,
    canEdit: isAuthor,
    canDelete: isAuthor || adminGroupIds.has(post.groupId),
  };
}
export type FeedItem = ReturnType<typeof toFeedItem>;
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
      ...(options.before ? { id: { lt: options.before } } : {}),
    },
    orderBy: { id: "desc" },
    take: limit + 1,
    include: postInclude,
  });
  const admin = new Set(memberships.filter((m) => m.role === "ADMIN").map((m) => m.groupId));
  const page = posts.slice(0, limit);
  return {
    items: page.map((post) => toFeedItem(post, viewerId, admin)),
    nextCursor: posts.length > limit ? page.at(-1)!.id : null,
  };
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
