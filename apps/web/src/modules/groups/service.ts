import "server-only";
import { prisma, type GroupRole } from "@branch/database";
import { isUniqueViolation } from "@/lib/db-errors";
import { DomainError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireAdmin, requireMembership } from "./access";
import {
  generateInviteToken,
  hashInviteToken,
  inviteStatus,
  inviteStatusMessage,
  isWellFormedInviteToken,
  type InviteStatus,
} from "./invite-token";
import type { GroupDetailsInput, InviteOptionsInput } from "./schemas";

// Every function takes the acting user's ID from the session and authorizes it here.

const INVITES_PER_HOUR = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------------

export async function listGroupsForUser(userId: string) {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { memberships: true } },
        },
      },
    },
  });
  return memberships.map(({ role, group }) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    memberCount: group._count.memberships,
    role,
  }));
}

export async function getGroupOverview(userId: string, groupId: string) {
  const membership = await requireMembership(userId, groupId);
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      memberships: {
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        include: {
          user: { select: { id: true, name: true, profile: { select: { username: true } } } },
        },
      },
    },
  });
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    timezone: group.timezone,
    viewerRole: membership.role,
    members: group.memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      username: m.user.profile?.username ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  };
}

export async function listActiveInvites(userId: string, groupId: string) {
  await requireAdmin(userId, groupId);
  const invites = await prisma.groupInvite.findMany({
    where: { groupId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return invites
    .filter((invite) => inviteStatus(invite) === "active")
    .map((invite) => ({
      id: invite.id,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      useCount: invite.useCount,
      createdByName: invite.createdBy?.name ?? null,
    }));
}

export async function listAuditEvents(userId: string, groupId: string, limit = 20) {
  await requireAdmin(userId, groupId);
  return prisma.groupAuditEvent.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { name: true } }, subjectUser: { select: { name: true } } },
  });
}

export type InvitePreview =
  | { status: "invalid" }
  | {
      status: InviteStatus;
      group: { id: string; name: string; memberCount: number };
      invitedBy: string | null;
    };

/** What an invite link shows before joining. The token itself is the capability. */
export async function previewInvite(token: string): Promise<InvitePreview> {
  if (!isWellFormedInviteToken(token)) return { status: "invalid" };
  const invite = await prisma.groupInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      createdBy: { select: { name: true } },
      group: { select: { id: true, name: true, _count: { select: { memberships: true } } } },
    },
  });
  if (!invite) return { status: "invalid" };
  return {
    status: inviteStatus(invite),
    group: {
      id: invite.group.id,
      name: invite.group.name,
      memberCount: invite.group._count.memberships,
    },
    invitedBy: invite.createdBy?.name ?? null,
  };
}

// ---------------------------------------------------------------------------------------------
// Group lifecycle
// ---------------------------------------------------------------------------------------------

export async function createGroup(
  userId: string,
  input: GroupDetailsInput,
): Promise<{ id: string }> {
  return prisma.group.create({
    data: {
      ...input,
      createdById: userId,
      memberships: { create: { userId, role: "ADMIN" } },
      auditEvents: { create: { action: "GROUP_CREATED", actorId: userId } },
    },
    select: { id: true },
  });
}

export async function updateGroup(userId: string, groupId: string, input: GroupDetailsInput) {
  await requireAdmin(userId, groupId);
  await prisma.$transaction([
    prisma.group.update({ where: { id: groupId }, data: input }),
    prisma.groupAuditEvent.create({ data: { groupId, action: "GROUP_UPDATED", actorId: userId } }),
  ]);
}

export async function deleteGroup(userId: string, groupId: string, confirmName: string) {
  await requireAdmin(userId, groupId);
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true },
  });
  if (confirmName.trim() !== group.name) {
    throw new DomainError(
      "CONFIRMATION_MISMATCH",
      "Type the group's name exactly to confirm.",
      "confirmName",
    );
  }
  await prisma.group.delete({ where: { id: groupId } });
  // The group's audit trail is deleted with it; keep a record in the server log.
  logger.info("group deleted", { groupId, actorId: userId });
}

// ---------------------------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------------------------

/** Creates an invite and returns its token. The token is shown once; only its hash is stored. */
export async function createInvite(
  userId: string,
  groupId: string,
  options: InviteOptionsInput,
): Promise<{ token: string; expiresAt: Date }> {
  await requireAdmin(userId, groupId);
  const recent = await prisma.groupInvite.count({
    where: {
      groupId,
      createdById: userId,
      createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recent >= INVITES_PER_HOUR) {
    throw new DomainError("RATE_LIMITED", "That's a lot of invites. Try again in an hour.");
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + options.expiresInDays * DAY_MS);
  await prisma.$transaction(async (tx) => {
    const invite = await tx.groupInvite.create({
      data: {
        groupId,
        tokenHash: hashInviteToken(token),
        createdById: userId,
        expiresAt,
        maxUses: options.maxUses,
      },
    });
    await tx.groupAuditEvent.create({
      data: {
        groupId,
        action: "INVITE_CREATED",
        actorId: userId,
        metadata: { inviteId: invite.id },
      },
    });
  });
  return { token, expiresAt };
}

export async function revokeInvite(userId: string, groupId: string, inviteId: string) {
  await requireAdmin(userId, groupId);
  await prisma.$transaction(async (tx) => {
    // Scoped to the group, so an admin of one group cannot revoke another group's invite.
    const result = await tx.groupInvite.updateMany({
      where: { id: inviteId, groupId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundError("That invite no longer exists.");
    await tx.groupAuditEvent.create({
      data: { groupId, action: "INVITE_REVOKED", actorId: userId, metadata: { inviteId } },
    });
  });
}

/**
 * Joins the group behind an invite. Idempotent for existing members (no use is consumed).
 * Claiming a use is a single conditional update, so a limited invite cannot be over-used by
 * concurrent joins.
 */
export async function acceptInvite(
  userId: string,
  token: string,
): Promise<{ groupId: string; alreadyMember: boolean }> {
  const invalid = new DomainError(
    "INVITE_INVALID",
    "This invite link isn't valid. Check that you copied all of it.",
  );
  if (!isWellFormedInviteToken(token)) throw invalid;
  const invite = await prisma.groupInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
  });
  if (!invite) throw invalid;

  const { groupId } = invite;
  const existing = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (existing) return { groupId, alreadyMember: true };

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.groupInvite.updateMany({
        where: {
          id: invite.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          OR: [{ maxUses: null }, { useCount: { lt: prisma.groupInvite.fields.maxUses } }],
        },
        data: { useCount: { increment: 1 } },
      });
      if (claimed.count === 0) {
        const current = await tx.groupInvite.findUniqueOrThrow({ where: { id: invite.id } });
        const status = inviteStatus(current);
        throw new DomainError(
          "INVITE_UNAVAILABLE",
          status === "active" ? invalid.message : inviteStatusMessage[status],
        );
      }
      await tx.groupMembership.create({ data: { groupId, userId, role: "MEMBER" } });
      await tx.groupAuditEvent.create({
        data: {
          groupId,
          action: "MEMBER_JOINED",
          actorId: userId,
          subjectUserId: userId,
          metadata: { inviteId: invite.id },
        },
      });
    });
  } catch (error) {
    // A concurrent join by the same user won the race; the transaction rolled back its use.
    if (isUniqueViolation(error)) return { groupId, alreadyMember: true };
    throw error;
  }
  return { groupId, alreadyMember: false };
}

// ---------------------------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------------------------

export async function leaveGroup(userId: string, groupId: string) {
  const membership = await requireMembership(userId, groupId);
  if (membership.role === "ADMIN") {
    const members = await prisma.groupMembership.count({ where: { groupId } });
    throw new DomainError(
      "ADMIN_CANNOT_LEAVE",
      members > 1
        ? "Make someone else the admin before you leave."
        : "You're the only member. Delete the group instead.",
    );
  }
  await prisma.$transaction([
    prisma.groupMembership.delete({ where: { groupId_userId: { groupId, userId } } }),
    prisma.groupAuditEvent.create({
      data: { groupId, action: "MEMBER_LEFT", actorId: userId, subjectUserId: userId },
    }),
  ]);
}

export async function removeMember(adminId: string, groupId: string, memberId: string) {
  await requireAdmin(adminId, groupId);
  if (memberId === adminId) {
    throw new DomainError(
      "CANNOT_REMOVE_SELF",
      "You can't remove yourself. Transfer admin or delete the group.",
    );
  }
  await prisma.$transaction(async (tx) => {
    const result = await tx.groupMembership.deleteMany({ where: { groupId, userId: memberId } });
    if (result.count === 0) throw new NotFoundError("That person isn't in this group.");
    await tx.groupAuditEvent.create({
      data: { groupId, action: "MEMBER_REMOVED", actorId: adminId, subjectUserId: memberId },
    });
  });
}

/** Hands the admin role to another member in one transaction; the group always has one admin. */
export async function transferAdmin(adminId: string, groupId: string, newAdminId: string) {
  await requireMembership(adminId, groupId);
  if (newAdminId === adminId) {
    throw new DomainError("ALREADY_ADMIN", "You're already the admin.");
  }
  await prisma.$transaction(async (tx) => {
    const target = await tx.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId: newAdminId } },
    });
    if (!target) throw new NotFoundError("That person isn't in this group.");
    // Demote first (the one-admin index allows a single ADMIN row); the role check happens in the
    // same statement, so a concurrent transfer cannot leave two admins or none.
    const demoted = await tx.groupMembership.updateMany({
      where: { groupId, userId: adminId, role: "ADMIN" satisfies GroupRole },
      data: { role: "MEMBER" },
    });
    if (demoted.count === 0) throw new ForbiddenError("Only the group admin can do that.");
    await tx.groupMembership.update({
      where: { groupId_userId: { groupId, userId: newAdminId } },
      data: { role: "ADMIN" },
    });
    await tx.groupAuditEvent.create({
      data: { groupId, action: "ADMIN_TRANSFERRED", actorId: adminId, subjectUserId: newAdminId },
    });
  });
}
