import { randomUUID } from "node:crypto";
import { prisma, type GroupRole } from "@branch/database";
import { importCuratedRoadmap, syncCatalog } from "@branch/database/catalog-import";
import type { Catalog, RoadmapDefinition } from "@branch/shared/catalog";

/** Creates a user row directly, bypassing Better Auth, for service-level tests. */
export async function createTestUser(overrides: { name?: string; email?: string } = {}) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `user-${id}@example.test`,
    },
  });
}

export async function createTestGroup(
  members: { userId: string; role: GroupRole }[],
  overrides: { name?: string; timezone?: string } = {},
) {
  return prisma.group.create({
    data: {
      name: overrides.name ?? "Study group",
      timezone: overrides.timezone ?? "America/New_York",
      memberships: { create: members },
    },
  });
}

export const testCatalog: Catalog = {
  tags: [
    { slug: "arrays-hashing", name: "Arrays & Hashing" },
    { slug: "stack", name: "Stack" },
  ],
  problems: [
    {
      slug: "two-sum",
      title: "Two Sum",
      difficulty: "EASY",
      premium: false,
      tags: ["arrays-hashing"],
    },
    {
      slug: "valid-anagram",
      title: "Valid Anagram",
      difficulty: "EASY",
      premium: false,
      tags: ["arrays-hashing"],
    },
    {
      slug: "group-anagrams",
      title: "Group Anagrams",
      difficulty: "MEDIUM",
      premium: false,
      tags: ["arrays-hashing"],
    },
    {
      slug: "valid-parentheses",
      title: "Valid Parentheses",
      difficulty: "EASY",
      premium: false,
      tags: ["stack"],
    },
    {
      slug: "min-stack",
      title: "Min Stack",
      difficulty: "MEDIUM",
      premium: false,
      tags: ["stack"],
    },
  ],
};

export function testRoadmapDefinition(
  overrides: Partial<RoadmapDefinition> = {},
): RoadmapDefinition {
  return {
    slug: "test-roadmap",
    title: "Test roadmap",
    sections: [
      { title: "Arrays", problems: ["two-sum", "valid-anagram"] },
      { title: "Stack", problems: ["valid-parentheses"] },
    ],
    ...overrides,
  };
}

/** Seeds the test catalog and imports a published curated roadmap; returns its version. */
export async function createPublishedRoadmap(definition = testRoadmapDefinition()) {
  await syncCatalog(prisma, testCatalog, "SEED");
  const { roadmapId, versionNumber } = await importCuratedRoadmap(prisma, definition);
  return prisma.roadmapVersion.findUniqueOrThrow({
    where: { roadmapId_number: { roadmapId, number: versionNumber } },
    include: {
      items: { include: { problem: true }, orderBy: [{ sectionId: "asc" }, { position: "asc" }] },
    },
  });
}
