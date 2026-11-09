import { randomUUID } from "node:crypto";
import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { createTestUser } from "@/test/factories";
import { finishMove, signInMethods } from "./accounts";

async function addAccount(userId: string, providerId: string) {
  await prisma.account.create({
    data: { id: randomUUID(), userId, providerId, accountId: randomUUID() },
  });
}

describe("moving a password account to a provider", () => {
  it("switches the password off once a provider is connected, keeping the account", async () => {
    const user = await createTestUser();
    await addAccount(user.id, "credential");
    await prisma.profile.create({ data: { userId: user.id, username: "mover", timezone: "UTC" } });

    // Nothing to finish until a provider is connected: the password is their only way in.
    expect(await finishMove(user.id)).toBe(false);
    expect(await signInMethods(user.id)).toEqual({ password: true, providers: [] });

    await addAccount(user.id, "github");
    expect(await finishMove(user.id)).toBe(true);
    expect(await signInMethods(user.id)).toEqual({ password: false, providers: ["github"] });
    expect(await prisma.profile.findUnique({ where: { userId: user.id } })).not.toBeNull();
    // Done once; again is a no-op.
    expect(await finishMove(user.id)).toBe(false);
  });

  it("leaves accounts that never had a password alone", async () => {
    const user = await createTestUser();
    await addAccount(user.id, "google");
    expect(await finishMove(user.id)).toBe(false);
    expect(await signInMethods(user.id)).toEqual({ password: false, providers: ["google"] });
  });

  it("ignores unknown providers", async () => {
    const user = await createTestUser();
    await addAccount(user.id, "credential");
    await addAccount(user.id, "someone-else");
    expect(await finishMove(user.id)).toBe(false);
    expect((await signInMethods(user.id)).password).toBe(true);
  });
});
