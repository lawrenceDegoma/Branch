import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { createTestUser } from "@/test/factories";
import { CHANGELOG } from "./entries";
import { dismissWhatsNew, whatsNewFor } from "./service";

async function person(joined: Date) {
  const user = await prisma.user.update({
    where: { id: (await createTestUser()).id },
    data: { createdAt: joined },
  });
  await prisma.profile.create({
    data: { userId: user.id, username: `p${user.id.slice(0, 8)}`, timezone: "UTC" },
  });
  return user;
}

const profileOf = (userId: string) => prisma.profile.findUniqueOrThrow({ where: { userId } });

describe("What's new", () => {
  it("shows updates since someone joined until they dismiss the card", async () => {
    const user = await person(new Date("2026-11-01T12:00:00Z"));
    expect(whatsNewFor(user, await profileOf(user.id))).toEqual(CHANGELOG);

    await dismissWhatsNew(user.id);
    const profile = await profileOf(user.id);
    expect(profile.changelogSeenId).toBe(CHANGELOG[0]!.id);
    expect(whatsNewFor(user, profile)).toEqual([]);
  });

  it("shows nothing from before someone joined", async () => {
    const user = await person(new Date("2026-11-08T12:00:00Z"));
    expect(whatsNewFor(user, await profileOf(user.id)).map((e) => e.date)).toEqual(
      CHANGELOG.filter((e) => e.date > "2026-11-08").map((e) => e.date),
    );
  });

  it("only stores entry IDs (database)", async () => {
    const user = await person(new Date());
    await expect(
      prisma.profile.update({ where: { userId: user.id }, data: { changelogSeenId: "<script>" } }),
    ).rejects.toThrow(/profile_changelog_seen_id/);
  });
});
