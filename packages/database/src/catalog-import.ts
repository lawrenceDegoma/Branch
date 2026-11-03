import type { Catalog, RoadmapDefinition } from "@branch/shared/catalog";
import type { Prisma, PrismaClient, ProblemSource } from "./generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Upserts tags and problems by slug and replaces each listed problem's tags. Idempotent. */
export async function syncCatalog(
  prisma: PrismaClient,
  catalog: Catalog,
  source: Extract<ProblemSource, "SEED" | "CURATED">,
): Promise<{ problems: number; tags: number }> {
  await prisma.$transaction(async (tx) => {
    for (const tag of catalog.tags) {
      await tx.tag.upsert({ where: { slug: tag.slug }, update: { name: tag.name }, create: tag });
    }
    const tagIds = new Map(
      (await tx.tag.findMany({ select: { id: true, slug: true } })).map((t) => [t.slug, t.id]),
    );
    for (const problem of catalog.problems) {
      const saved = await tx.problem.upsert({
        where: { leetcodeSlug: problem.slug },
        update: { title: problem.title, difficulty: problem.difficulty },
        create: {
          leetcodeSlug: problem.slug,
          title: problem.title,
          difficulty: problem.difficulty,
          source,
        },
      });
      await tx.problemTag.deleteMany({ where: { problemId: saved.id } });
      await tx.problemTag.createMany({
        data: problem.tags.map((slug) => ({ problemId: saved.id, tagId: tagIds.get(slug)! })),
      });
    }
  });
  return { problems: catalog.problems.length, tags: catalog.tags.length };
}

/** The ordered content of a version, for comparing against a definition. */
function contentKey(sections: { title: string; problems: string[] }[]): string {
  return JSON.stringify(sections.map((s) => [s.title, s.problems]));
}

async function latestPublishedContent(db: Db, roadmapId: string) {
  const version = await db.roadmapVersion.findFirst({
    where: { roadmapId, publishedAt: { not: null } },
    orderBy: { number: "desc" },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          items: {
            orderBy: { position: "asc" },
            include: { problem: { select: { leetcodeSlug: true } } },
          },
        },
      },
    },
  });
  if (!version) return null;
  return {
    number: version.number,
    key: contentKey(
      version.sections.map((s) => ({
        title: s.title,
        problems: s.items.map((i) => i.problem.leetcodeSlug),
      })),
    ),
  };
}

export type ImportResult = { roadmapId: string; versionNumber: number; created: boolean };

/**
 * Imports a curated roadmap definition. Unchanged content is a no-op; changed content becomes a
 * new published version, leaving earlier versions (and the plans that use them) untouched.
 * Every problem must already exist in the catalog.
 */
export async function importCuratedRoadmap(
  prisma: PrismaClient,
  definition: RoadmapDefinition,
): Promise<ImportResult> {
  return prisma.$transaction(async (tx) => {
    const slugs = definition.sections.flatMap((s) => s.problems);
    const problems = await tx.problem.findMany({
      where: { leetcodeSlug: { in: slugs } },
      select: { id: true, leetcodeSlug: true },
    });
    const problemIds = new Map(problems.map((p) => [p.leetcodeSlug, p.id]));
    const missing = slugs.filter((slug) => !problemIds.has(slug));
    if (missing.length > 0) {
      throw new Error(
        `Roadmap "${definition.slug}" references unknown problems: ${missing.join(", ")}`,
      );
    }

    const details = {
      title: definition.title,
      description: definition.description ?? null,
      sourceUrl: definition.sourceUrl ?? null,
    };
    const roadmap = await tx.roadmap.upsert({
      where: { slug: definition.slug },
      update: details,
      create: { ...details, slug: definition.slug, kind: "CURATED" },
    });

    const latest = await latestPublishedContent(tx, roadmap.id);
    if (latest?.key === contentKey(definition.sections)) {
      return { roadmapId: roadmap.id, versionNumber: latest.number, created: false };
    }

    const number = (latest?.number ?? 0) + 1;
    // Built as a draft, then published, so the immutability triggers allow the inserts.
    const version = await tx.roadmapVersion.create({ data: { roadmapId: roadmap.id, number } });
    for (const [sectionPosition, section] of definition.sections.entries()) {
      const savedSection = await tx.roadmapSection.create({
        data: { versionId: version.id, position: sectionPosition, title: section.title },
      });
      await tx.roadmapItem.createMany({
        data: section.problems.map((slug, position) => ({
          versionId: version.id,
          sectionId: savedSection.id,
          problemId: problemIds.get(slug)!,
          position,
        })),
      });
    }
    await tx.roadmapVersion.update({
      where: { id: version.id },
      data: { publishedAt: new Date() },
    });
    return { roadmapId: roadmap.id, versionNumber: number, created: true };
  });
}
