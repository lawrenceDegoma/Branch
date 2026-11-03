import { describe, expect, it } from "vitest";
import {
  generateInviteToken,
  hashInviteToken,
  inviteStatus,
  isWellFormedInviteToken,
} from "./invite-token";

const now = new Date("2026-11-03T12:00:00Z");
const active = {
  expiresAt: new Date("2026-11-10T00:00:00Z"),
  revokedAt: null,
  maxUses: null,
  useCount: 0,
};

describe("invite tokens", () => {
  it("generates unique, well-formed tokens", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateInviteToken));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(isWellFormedInviteToken(token)).toBe(true);
  });

  it("hashes deterministically without containing the token", () => {
    const token = generateInviteToken();
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(token)).not.toContain(token);
  });

  it("rejects malformed tokens", () => {
    expect(isWellFormedInviteToken("short")).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}!`)).toBe(false);
  });
});

describe("inviteStatus", () => {
  it("is active before expiry with uses left", () => {
    expect(inviteStatus({ ...active, maxUses: 3, useCount: 2 }, now)).toBe("active");
  });

  it("reports expiry at the exact boundary", () => {
    expect(inviteStatus({ ...active, expiresAt: now }, now)).toBe("expired");
  });

  it("reports used-up and revoked invites, revoked first", () => {
    expect(inviteStatus({ ...active, maxUses: 1, useCount: 1 }, now)).toBe("used-up");
    expect(inviteStatus({ ...active, maxUses: 1, useCount: 1, revokedAt: now }, now)).toBe(
      "revoked",
    );
  });
});
