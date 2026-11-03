import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { createTestUser } from "@/test/factories";
import { hashInviteToken } from "./invite-token";
import {
  acceptInvite,
  createGroup,
  createInvite,
  deleteGroup,
  getGroupOverview,
  leaveGroup,
  listActiveInvites,
  listAuditEvents,
  listGroupsForUser,
  previewInvite,
  removeMember,
  revokeInvite,
  transferAdmin,
  updateGroup,
} from "./service";

const details = { name: "Night owls", description: null, timezone: "America/Chicago" };
const weekLong = { expiresInDays: 7, maxUses: null };

async function groupWith(memberCount = 1) {
  const admin = await createTestUser({ name: "Admin" });
  const { id: groupId } = await createGroup(admin.id, details);
  const members = [];
  for (let i = 0; i < memberCount; i++) {
    const member = await createTestUser({ name: `Member ${i}` });
    const { token } = await createInvite(admin.id, groupId, weekLong);
    await acceptInvite(member.id, token);
    members.push(member);
  }
  return { admin, groupId, members };
}

const roleOf = async (groupId: string, userId: string) =>
  (await prisma.groupMembership.findUnique({ where: { groupId_userId: { groupId, userId } } }))
    ?.role ?? null;

describe("creating groups", () => {
  it("makes the creator the admin and records it", async () => {
    const user = await createTestUser();
    const { id } = await createGroup(user.id, details);
    expect(await roleOf(id, user.id)).toBe("ADMIN");
    expect(await listGroupsForUser(user.id)).toMatchObject([
      { id, name: "Night owls", memberCount: 1, role: "ADMIN" },
    ]);
    expect(await prisma.groupAuditEvent.findMany({ where: { groupId: id } })).toMatchObject([
      { action: "GROUP_CREATED", actorId: user.id },
    ]);
  });
});

describe("group privacy", () => {
  it("hides a group from non-members as not found", async () => {
    const { groupId } = await groupWith(0);
    const outsider = await createTestUser();
    await expect(getGroupOverview(outsider.id, groupId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(createInvite(outsider.id, groupId, weekLong)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(updateGroup(outsider.id, groupId, details)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(listAuditEvents(outsider.id, groupId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await listGroupsForUser(outsider.id)).toEqual([]);
  });

  it("treats malformed group IDs as not found", async () => {
    const user = await createTestUser();
    await expect(getGroupOverview(user.id, "not-a-uuid")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets members read but not administer", async () => {
    const { groupId, members } = await groupWith(1);
    const member = members[0]!;
    const overview = await getGroupOverview(member.id, groupId);
    expect(overview.viewerRole).toBe("MEMBER");
    expect(overview.members).toHaveLength(2);
    for (const attempt of [
      () => createInvite(member.id, groupId, weekLong),
      () => updateGroup(member.id, groupId, details),
      () => listActiveInvites(member.id, groupId),
      () => listAuditEvents(member.id, groupId),
      () => deleteGroup(member.id, groupId, "Night owls"),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});

describe("invites", () => {
  it("stores only a hash of the token", async () => {
    const { admin, groupId } = await groupWith(0);
    const { token } = await createInvite(admin.id, groupId, weekLong);
    const invite = await prisma.groupInvite.findFirstOrThrow({ where: { groupId } });
    expect(invite.tokenHash).toBe(hashInviteToken(token));
    expect(JSON.stringify(invite)).not.toContain(token);
  });

  it("previews without joining, and joins once", async () => {
    const { admin, groupId } = await groupWith(0);
    const { token } = await createInvite(admin.id, groupId, weekLong);
    expect(await previewInvite(token)).toMatchObject({
      status: "active",
      group: { id: groupId, name: "Night owls", memberCount: 1 },
      invitedBy: "Admin",
    });

    const friend = await createTestUser();
    expect(await acceptInvite(friend.id, token)).toEqual({ groupId, alreadyMember: false });
    expect(await acceptInvite(friend.id, token)).toEqual({ groupId, alreadyMember: true });
    expect(await roleOf(groupId, friend.id)).toBe("MEMBER");
    expect((await prisma.groupInvite.findFirstOrThrow({ where: { groupId } })).useCount).toBe(1);
  });

  it("reports unknown and malformed tokens as invalid", async () => {
    const user = await createTestUser();
    expect(await previewInvite("garbage")).toEqual({ status: "invalid" });
    expect(await previewInvite("a".repeat(43))).toEqual({ status: "invalid" });
    await expect(acceptInvite(user.id, "a".repeat(43))).rejects.toMatchObject({
      code: "INVITE_INVALID",
    });
  });

  it("refuses expired, revoked, and used-up invites", async () => {
    const { admin, groupId } = await groupWith(0);
    const user = await createTestUser();

    const expired = await createInvite(admin.id, groupId, weekLong);
    await prisma.groupInvite.updateMany({
      where: { tokenHash: hashInviteToken(expired.token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(acceptInvite(user.id, expired.token)).rejects.toThrow(/expired/);

    const revoked = await createInvite(admin.id, groupId, weekLong);
    const [active] = await listActiveInvites(admin.id, groupId);
    await revokeInvite(admin.id, groupId, active!.id);
    await expect(acceptInvite(user.id, revoked.token)).rejects.toThrow(/turned off/);

    const single = await createInvite(admin.id, groupId, { expiresInDays: 1, maxUses: 1 });
    await acceptInvite((await createTestUser()).id, single.token);
    await expect(acceptInvite(user.id, single.token)).rejects.toThrow(/limit/);
    expect(await roleOf(groupId, user.id)).toBeNull();
  });

  it("never over-uses a limited invite under concurrent joins", async () => {
    const { admin, groupId } = await groupWith(0);
    const { token } = await createInvite(admin.id, groupId, { expiresInDays: 1, maxUses: 1 });
    const users = await Promise.all([createTestUser(), createTestUser(), createTestUser()]);
    const results = await Promise.allSettled(users.map((u) => acceptInvite(u.id, token)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.groupMembership.count({ where: { groupId } })).toBe(2);
  });

  it("only lets a group's admin revoke its invites", async () => {
    const a = await groupWith(0);
    const b = await groupWith(0);
    await createInvite(a.admin.id, a.groupId, weekLong);
    const [invite] = await listActiveInvites(a.admin.id, a.groupId);
    await expect(revokeInvite(b.admin.id, b.groupId, invite!.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(revokeInvite(b.admin.id, a.groupId, invite!.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await listActiveInvites(a.admin.id, a.groupId)).toHaveLength(1);
  });

  it("limits how many invites an admin creates per hour", async () => {
    const { admin, groupId } = await groupWith(0);
    for (let i = 0; i < 20; i++) await createInvite(admin.id, groupId, weekLong);
    await expect(createInvite(admin.id, groupId, weekLong)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});

describe("membership changes", () => {
  it("lets a member leave, and records it", async () => {
    const { groupId, members } = await groupWith(1);
    await leaveGroup(members[0]!.id, groupId);
    expect(await roleOf(groupId, members[0]!.id)).toBeNull();
    await expect(getGroupOverview(members[0]!.id, groupId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("stops the admin from leaving a group without handing over", async () => {
    const solo = await groupWith(0);
    await expect(leaveGroup(solo.admin.id, solo.groupId)).rejects.toThrow(/Delete the group/);
    const shared = await groupWith(1);
    await expect(leaveGroup(shared.admin.id, shared.groupId)).rejects.toThrow(
      /someone else the admin/,
    );
  });

  it("lets the admin remove members, but not themselves", async () => {
    const { admin, groupId, members } = await groupWith(2);
    await removeMember(admin.id, groupId, members[0]!.id);
    expect(await roleOf(groupId, members[0]!.id)).toBeNull();
    await expect(removeMember(admin.id, groupId, admin.id)).rejects.toMatchObject({
      code: "CANNOT_REMOVE_SELF",
    });
    await expect(removeMember(members[1]!.id, groupId, admin.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(removeMember(admin.id, groupId, members[0]!.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("transfers admin atomically", async () => {
    const { admin, groupId, members } = await groupWith(1);
    const member = members[0]!;
    await transferAdmin(admin.id, groupId, member.id);
    expect(await roleOf(groupId, admin.id)).toBe("MEMBER");
    expect(await roleOf(groupId, member.id)).toBe("ADMIN");
    await expect(transferAdmin(admin.id, groupId, member.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const audit = await listAuditEvents(member.id, groupId);
    expect(audit[0]).toMatchObject({
      action: "ADMIN_TRANSFERRED",
      actorId: admin.id,
      subjectUserId: member.id,
    });
  });

  it("keeps exactly one admin when transfers race", async () => {
    const { admin, groupId, members } = await groupWith(2);
    await Promise.allSettled(members.map((m) => transferAdmin(admin.id, groupId, m.id)));
    expect(await prisma.groupMembership.count({ where: { groupId, role: "ADMIN" } })).toBe(1);
  });

  it("refuses to transfer admin to a non-member", async () => {
    const { admin, groupId } = await groupWith(0);
    const outsider = await createTestUser();
    await expect(transferAdmin(admin.id, groupId, outsider.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await roleOf(groupId, admin.id)).toBe("ADMIN");
  });
});

describe("administration", () => {
  it("updates details and records it", async () => {
    const { admin, groupId } = await groupWith(0);
    await updateGroup(admin.id, groupId, {
      ...details,
      name: "Early birds",
      timezone: "Asia/Tokyo",
    });
    expect(await prisma.group.findUniqueOrThrow({ where: { id: groupId } })).toMatchObject({
      name: "Early birds",
      timezone: "Asia/Tokyo",
    });
    expect((await listAuditEvents(admin.id, groupId))[0]).toMatchObject({
      action: "GROUP_UPDATED",
    });
  });

  it("deletes only with the exact name, removing memberships and invites", async () => {
    const { admin, groupId } = await groupWith(1);
    await createInvite(admin.id, groupId, weekLong);
    await expect(deleteGroup(admin.id, groupId, "night owls")).rejects.toMatchObject({
      code: "CONFIRMATION_MISMATCH",
      field: "confirmName",
    });
    await deleteGroup(admin.id, groupId, " Night owls ");
    expect(await prisma.group.count({ where: { id: groupId } })).toBe(0);
    expect(await prisma.groupMembership.count({ where: { groupId } })).toBe(0);
    expect(await prisma.groupInvite.count({ where: { groupId } })).toBe(0);
  });
});
