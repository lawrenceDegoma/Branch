import "server-only";
import { prisma, type GroupMembership } from "@branch/database";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { groupIdSchema } from "./schemas";

// Group authorization. Non-members get NotFound (never Forbidden) so private groups cannot be
// probed; members get Forbidden only for admin-only actions.

export async function findMembership(
  userId: string,
  groupId: string,
): Promise<GroupMembership | null> {
  if (!groupIdSchema.safeParse(groupId).success) return null;
  return prisma.groupMembership.findUnique({ where: { groupId_userId: { groupId, userId } } });
}

export async function requireMembership(userId: string, groupId: string): Promise<GroupMembership> {
  const membership = await findMembership(userId, groupId);
  if (!membership) throw new NotFoundError("We couldn't find that group.");
  return membership;
}

export async function requireAdmin(userId: string, groupId: string): Promise<GroupMembership> {
  const membership = await requireMembership(userId, groupId);
  if (membership.role !== "ADMIN") throw new ForbiddenError("Only the group admin can do that.");
  return membership;
}
