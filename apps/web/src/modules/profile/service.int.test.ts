import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/errors";
import { createTestUser } from "@/test/factories";
import { onboardingSchema, profileUpdateSchema } from "./schemas";
import { createProfile, getProfile, setAppearance, updateProfile } from "./service";

const onboarding = (username: string) =>
  onboardingSchema.parse({ username, timezone: "America/New_York" });

describe("profile service", () => {
  it("creates a profile with default appearance", async () => {
    const user = await createTestUser();
    const profile = await createProfile(user.id, onboarding("ada"));
    expect(profile).toMatchObject({
      username: "ada",
      timezone: "America/New_York",
      appearance: "SYSTEM",
    });
    expect(await getProfile(user.id)).toMatchObject({ username: "ada" });
  });

  it("treats usernames case-insensitively", async () => {
    const [a, b] = await Promise.all([createTestUser(), createTestUser()]);
    await createProfile(a.id, onboarding("Ada"));
    await expect(createProfile(b.id, onboarding("ADA"))).rejects.toMatchObject({
      code: "USERNAME_TAKEN",
      field: "username",
    });
  });

  it("lets exactly one of two concurrent claims on a username succeed", async () => {
    const [a, b] = await Promise.all([createTestUser(), createTestUser()]);
    const results = await Promise.allSettled([
      createProfile(a.id, onboarding("grace")),
      createProfile(b.id, onboarding("grace")),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(DomainError);
  });

  it("refuses a second profile for the same user", async () => {
    const user = await createTestUser();
    await createProfile(user.id, onboarding("linus"));
    await expect(createProfile(user.id, onboarding("linus2"))).rejects.toMatchObject({
      code: "PROFILE_EXISTS",
    });
  });

  it("updates name and profile together, touching only the caller", async () => {
    const [me, other] = await Promise.all([
      createTestUser({ name: "Me" }),
      createTestUser({ name: "Other" }),
    ]);
    await createProfile(me.id, onboarding("me-user"));
    await createProfile(other.id, onboarding("other-user"));

    await updateProfile(
      me.id,
      profileUpdateSchema.parse({
        name: "Margaret",
        username: "margaret",
        bio: "  ",
        timezone: "UTC",
      }),
    );

    const mine = await prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      include: { profile: true },
    });
    expect(mine.name).toBe("Margaret");
    expect(mine.profile).toMatchObject({ username: "margaret", bio: null, timezone: "UTC" });
    const theirs = await prisma.user.findUniqueOrThrow({
      where: { id: other.id },
      include: { profile: true },
    });
    expect(theirs).toMatchObject({ name: "Other", profile: { username: "other-user" } });
  });

  it("rolls back the name change when the new username is taken", async () => {
    const [me, other] = await Promise.all([createTestUser({ name: "Me" }), createTestUser()]);
    await createProfile(me.id, onboarding("me-user"));
    await createProfile(other.id, onboarding("taken"));

    await expect(
      updateProfile(
        me.id,
        profileUpdateSchema.parse({ name: "New", username: "taken", bio: "", timezone: "UTC" }),
      ),
    ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).toMatchObject({
      name: "Me",
    });
  });

  it("persists appearance", async () => {
    const user = await createTestUser();
    await createProfile(user.id, onboarding("night-owl"));
    await setAppearance(user.id, "DARK");
    expect(await getProfile(user.id)).toMatchObject({ appearance: "DARK" });
  });

  describe("database constraints", () => {
    it("rejects malformed usernames even when the application is bypassed", async () => {
      const user = await createTestUser();
      await expect(
        prisma.profile.create({ data: { userId: user.id, username: "Bad Name", timezone: "UTC" } }),
      ).rejects.toThrow();
    });

    it("rejects bios over 280 characters", async () => {
      const user = await createTestUser();
      await expect(
        prisma.profile.create({
          data: { userId: user.id, username: "verbose", timezone: "UTC", bio: "x".repeat(281) },
        }),
      ).rejects.toThrow();
    });

    it("deletes the profile with its user", async () => {
      const user = await createTestUser();
      await createProfile(user.id, onboarding("ephemeral"));
      await prisma.user.delete({ where: { id: user.id } });
      expect(await getProfile(user.id)).toBeNull();
    });
  });
});
