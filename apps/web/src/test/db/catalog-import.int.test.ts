import { prisma } from "@branch/database";
import { importCuratedRoadmap, syncCatalog } from "@branch/database/catalog-import";
import { describe, expect, it } from "vitest";
import { testCatalog, testRoadmapDefinition } from "@/test/factories";

async function versionSlugs(roadmapId: string, number: number) {
  const items = await prisma.roadmapItem.findMany({
    where: { version: { roadmapId, number } },
    orderBy: [{ section: { position: "asc" } }, { position: "asc" }],
    include: { problem: true },
  });
  return items.map((i) => i.problem.leetcodeSlug);
}

describe("syncCatalog", () => {
  it("is idempotent and replaces problem tags", async () => {
    await syncCatalog(prisma, testCatalog, "SEED");
    await syncCatalog(prisma, testCatalog, "SEED");
    expect(await prisma.problem.count()).toBe(testCatalog.problems.length);

    const retagged = {
      ...testCatalog,
      problems: testCatalog.problems.map((p) =>
        p.slug === "two-sum" ? { ...p, tags: ["stack"] } : p,
      ),
    };
    await syncCatalog(prisma, retagged, "SEED");
    const twoSum = await prisma.problem.findUniqueOrThrow({
      where: { leetcodeSlug: "two-sum" },
      include: { tags: { include: { tag: true } } },
    });
    expect(twoSum.tags.map((t) => t.tag.slug)).toEqual(["stack"]);
  });
});

describe("importCuratedRoadmap", () => {
  it("creates version 1, then ignores an unchanged re-import", async () => {
    await syncCatalog(prisma, testCatalog, "SEED");
    const first = await importCuratedRoadmap(prisma, testRoadmapDefinition());
    const again = await importCuratedRoadmap(prisma, testRoadmapDefinition());
    expect(first).toMatchObject({ versionNumber: 1, created: true });
    expect(again).toMatchObject({ versionNumber: 1, created: false });
    expect(await prisma.roadmapVersion.count()).toBe(1);
  });

  it("publishes changed content as a new version and leaves the old one intact", async () => {
    await syncCatalog(prisma, testCatalog, "SEED");
    const { roadmapId } = await importCuratedRoadmap(prisma, testRoadmapDefinition());
    const changed = testRoadmapDefinition({
      sections: [{ title: "Arrays", problems: ["two-sum", "group-anagrams"] }],
    });
    const second = await importCuratedRoadmap(prisma, changed);

    expect(second).toMatchObject({ versionNumber: 2, created: true });
    expect(await versionSlugs(roadmapId, 1)).toEqual([
      "two-sum",
      "valid-anagram",
      "valid-parentheses",
    ]);
    expect(await versionSlugs(roadmapId, 2)).toEqual(["two-sum", "group-anagrams"]);
  });

  it("rejects unknown problems without creating anything", async () => {
    await syncCatalog(prisma, testCatalog, "SEED");
    const definition = testRoadmapDefinition({
      sections: [{ title: "X", problems: ["not-in-catalog"] }],
    });
    await expect(importCuratedRoadmap(prisma, definition)).rejects.toThrow(/not-in-catalog/);
    expect(await prisma.roadmap.count()).toBe(0);
  });
});
