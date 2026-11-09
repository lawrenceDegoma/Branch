import { prisma } from "@branch/database";
import { syncCatalog } from "@branch/database/catalog-import";
import { beforeEach, describe, expect, it } from "vitest";
import { createPlan } from "@/modules/plans/service";
import { setCompletion } from "@/modules/progress/service";
import { setShareSolves } from "@/modules/profile/service";
import {
  createPublishedRoadmap,
  createTestGroup,
  createTestUser,
  testCatalog,
} from "@/test/factories";
import { badgesForGroup, syncBadges } from "./service";

const NOW = new Date("2026-11-03T20:00:00Z");

beforeEach(async () => {
  await syncCatalog(prisma, testCatalog, "SEED");
});

async function person(name: string) {
  const user = await createTestUser({ name });
  await prisma.profile.create({
    data: { userId: user.id, username: name.toLowerCase(), timezone: "UTC" },
  });
  return user;
}

const ids = (slugs: string[]) =>
  Promise.all(
    slugs.map(
      async (slug) =>
        (await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: slug } })).id,
    ),
  );

describe("badges", () => {
  it("are earned from progress and kept even if it's undone", async () => {
    const ada = await person("Ada");
    expect((await syncBadges([ada.id], NOW)).get(ada.id)).toEqual([]);
    const [twoSum] = await ids(["two-sum"]);
    await setCompletion(ada.id, twoSum!, true, NOW);
    expect((await syncBadges([ada.id], NOW)).get(ada.id)).toEqual([
      { kind: "FIRST_SOLVE", earnedAt: NOW },
    ]);
    await setCompletion(ada.id, twoSum!, false, NOW);
    expect((await syncBadges([ada.id], NOW)).get(ada.id)?.map((a) => a.kind)).toEqual([
      "FIRST_SOLVE",
    ]);
  });

  it("count finished weeks and roadmaps in the person's groups", async () => {
    const ada = await person("Ada");
    const group = await createTestGroup([{ userId: ada.id, role: "ADMIN" }]);
    const version = await createPublishedRoadmap();
    await createPlan(
      ada.id,
      group.id,
      {
        roadmapVersionId: version.id,
        startDate: "2026-11-02",
        pacing: { mode: "PER_WEEK", problemsPerWeek: 2 },
      },
      NOW,
    );
    const week1 = await ids(["two-sum", "valid-anagram"]);
    for (const id of week1) await setCompletion(ada.id, id, true, NOW);
    const kinds = (await syncBadges([ada.id], NOW)).get(ada.id)!.map((a) => a.kind);
    expect(kinds).toEqual(["FIRST_SOLVE", "WEEK_DONE"]);
  });

  it("show in a group only for people sharing their solves, never the private review badge", async () => {
    const [ada, grace] = await Promise.all([person("Ada"), person("Grace")]);
    const [twoSum] = await ids(["two-sum"]);
    for (const user of [ada, grace]) await setCompletion(user.id, twoSum!, true, NOW);
    await prisma.badgeAward.create({ data: { userId: grace.id, kind: "REVIEWS_25" } });
    await setShareSolves(grace.id, true);
    const shown = await badgesForGroup([{ userId: ada.id }, { userId: grace.id }]);
    expect(shown.get(ada.id)).toBeUndefined();
    expect(shown.get(grace.id)).toEqual(["First solve"]);
  });
});
