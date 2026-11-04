import { prisma } from "@branch/database";
import { createPasswordResetLink } from "@branch/database/password-reset";
import { describe, expect, it } from "vitest";

const now = new Date("2026-11-03T12:00:00Z");

async function user(email: string) {
  return prisma.user.create({ data: { id: crypto.randomUUID(), name: "Ada", email } });
}

describe("createPasswordResetLink", () => {
  it("stores a one-hour token in Better Auth's format and links to the reset page", async () => {
    const ada = await user("ada@example.test");
    const link = await createPasswordResetLink(prisma, " ADA@example.test ", "https://b.test", now);
    expect(link?.expiresAt).toEqual(new Date("2026-11-03T13:00:00Z"));
    const url = new URL(link!.url);
    expect(url.origin + url.pathname).toBe("https://b.test/reset-password");
    const token = url.searchParams.get("token")!;
    expect(token.length).toBeGreaterThanOrEqual(43);
    const row = await prisma.verification.findFirstOrThrow({
      where: { identifier: `reset-password:${token}` },
    });
    expect(row.value).toBe(ada.id);
  });

  it("issues a fresh token each time and nothing for unknown emails", async () => {
    await user("ada@example.test");
    const a = await createPasswordResetLink(prisma, "ada@example.test", "https://b.test", now);
    const b = await createPasswordResetLink(prisma, "ada@example.test", "https://b.test", now);
    expect(a!.url).not.toBe(b!.url);
    expect(
      await createPasswordResetLink(prisma, "nobody@example.test", "https://b.test"),
    ).toBeNull();
  });
});
