import "server-only";
import { prisma } from "@branch/database";
import { DomainError, NotFoundError } from "@/lib/errors";
import { photoSelect, shownPhoto } from "@/modules/profile/photo";
import { userIdSchema } from "./schemas";

// Blocking is personal and silent (owner decision, 2026-11-09): the blocker stops seeing the
// blocked person's posts, comments, and reactions (folded, with Show), and the blocked person
// can't comment on the blocker's posts or reply to their comments. Nobody leaves a group, and
// group progress stays visible to both: the shared plan needs it.

const notFound = () => new NotFoundError("We couldn't find that person.");

/** The people `viewerId` has blocked; one indexed lookup, used by every read that shows content. */
export async function blockedIds(viewerId: string): Promise<ReadonlySet<string>> {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: viewerId },
    select: { blockedId: true },
  });
  return new Set(rows.map((row) => row.blockedId));
}

/** Whether `blockerId` has blocked `otherId`. */
export async function hasBlocked(blockerId: string, otherId: string): Promise<boolean> {
  if (blockerId === otherId) return false;
  const row = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId: otherId } },
    select: { blockerId: true },
  });
  return row !== null;
}

/** Blocks someone the person shares a group with (anyone else is NotFound). Idempotent. */
export async function blockUser(blockerId: string, blockedId: string) {
  if (!userIdSchema.safeParse(blockedId).success) throw notFound();
  if (blockedId === blockerId) throw new DomainError("SELF", "You can't block yourself.");
  const shared = await prisma.groupMembership.findFirst({
    where: { userId: blockedId, group: { memberships: { some: { userId: blockerId } } } },
    select: { userId: true },
  });
  if (!shared) throw notFound();
  await prisma.userBlock.createMany({ data: [{ blockerId, blockedId }], skipDuplicates: true });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  if (!userIdSchema.safeParse(blockedId).success) throw notFound();
  const { count } = await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  if (count === 0) throw notFound();
}

/** Settings → Blocked people. */
export async function listBlocked(blockerId: string) {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      blocked: { select: { id: true, name: true, ...photoSelect } },
    },
  });
  return rows.map(({ createdAt, blocked }) => ({
    id: blocked.id,
    name: blocked.name,
    photo: shownPhoto(blocked),
    since: createdAt,
  }));
}
