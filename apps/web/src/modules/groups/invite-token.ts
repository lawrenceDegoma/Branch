import { createHash, randomBytes } from "node:crypto";

// 256 bits of randomness, URL-safe. Only the SHA-256 hash is stored, so a database leak does not
// reveal working invite links.
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isWellFormedInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type InviteStatus = "active" | "expired" | "revoked" | "used-up";

export function inviteStatus(
  invite: { expiresAt: Date; revokedAt: Date | null; maxUses: number | null; useCount: number },
  now = new Date(),
): InviteStatus {
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt <= now) return "expired";
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return "used-up";
  return "active";
}

export const inviteStatusMessage: Record<Exclude<InviteStatus, "active">, string> = {
  expired: "This invite link has expired. Ask the group admin for a new one.",
  revoked: "This invite link was turned off. Ask the group admin for a new one.",
  "used-up": "This invite link has reached its limit. Ask the group admin for a new one.",
};
