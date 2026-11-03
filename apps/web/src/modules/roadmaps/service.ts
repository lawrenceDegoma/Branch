import "server-only";
import { randomBytes } from "node:crypto";
import { prisma, type Difficulty, type Prisma, type Roadmap } from "@branch/database";
import { isForeignKeyViolation, isUniqueViolation } from "@/lib/db-errors";
import { DomainError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { parseLeetCodeSlug } from "./leetcode";
import {
  publishProblem,
  roadmapIdSchema,
  type DraftContent,
  type RoadmapDetailsInput,
} from "./schemas";

// Access: curated roadmaps are visible to every signed-in user; a custom roadmap to its owner and
// to members of a group whose plan uses one of its versions. Drafts are visible only to the owner.

const USER_PROBLEMS_PER_DAY = 50;
const notFound = () => new NotFoundError("We couldn't find that roadmap.");

type Db = typeof prisma | Prisma.TransactionClient;

async function findRoadmap(roadmapId: string): Promise<Roadmap | null> {
  if (!roadmapIdSchema.safeParse(roadmapId).success) return null;
  return prisma.roadmap.findUnique({ where: { id: roadmapId } });
}

async function usedByViewersGroup(userId: string, roadmapId: string): Promise<boolean> {
  const plan = await prisma.groupRoadmapPlan.findFirst({
    where: { roadmapVersion: { roadmapId }, group: { memberships: { some: { userId } } } },
    select: { id: true },
  });
  return plan !== null;
}

export async function requireViewableRoadmap(userId: string, roadmapId: string): Promise<Roadmap> {
  const roadmap = await findRoadmap(roadmapId);
  if (!roadmap) throw notFound();
  if (roadmap.kind === "CURATED" || roadmap.ownerId === userId) return roadmap;
  if (await usedByViewersGroup(userId, roadmap.id)) return roadmap;
  throw notFound();
}

export async function requireOwnedRoadmap(userId: string, roadmapId: string): Promise<Roadmap> {
  const roadmap = await requireViewableRoadmap(userId, roadmapId);
  if (roadmap.kind !== "CUSTOM" || roadmap.ownerId !== userId) {
    throw new ForbiddenError("Only the roadmap's owner can change it.");
  }
  return roadmap;
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

const problemSummary = { id: true, leetcodeSlug: true, title: true, difficulty: true } as const;
export type ProblemSummary = {
  id: string;
  leetcodeSlug: string;
  title: string;
  difficulty: Difficulty;
};

async function versionContent(db: Db, versionId: string) {
  const sections = await db.roadmapSection.findMany({
    where: { versionId },
    orderBy: { position: "asc" },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          problem: {
            select: {
              ...problemSummary,
              tags: { select: { tag: { select: { slug: true, name: true } } } },
            },
          },
        },
      },
    },
  });
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    items: section.items.map((item) => ({
      id: item.id,
      problem: {
        id: item.problem.id,
        leetcodeSlug: item.problem.leetcodeSlug,
        title: item.problem.title,
        difficulty: item.problem.difficulty,
        tags: item.problem.tags.map((t) => t.tag),
      },
    })),
  }));
}
export type VersionContent = Awaited<ReturnType<typeof versionContent>>;

async function publishedVersions(roadmapId: string) {
  return prisma.roadmapVersion.findMany({
    where: { roadmapId, publishedAt: { not: null } },
    orderBy: { number: "desc" },
    select: { id: true, number: true, publishedAt: true, _count: { select: { items: true } } },
  });
}

/** A roadmap with one published version's content (the latest unless `versionNumber` is given). */
export async function getRoadmapView(userId: string, roadmapId: string, versionNumber?: number) {
  const roadmap = await requireViewableRoadmap(userId, roadmapId);
  return buildView(roadmap, userId, versionNumber);
}

async function buildView(roadmap: Roadmap, userId: string | null, versionNumber?: number) {
  const versions = await publishedVersions(roadmap.id);
  const selected = versionNumber ? versions.find((v) => v.number === versionNumber) : versions[0];
  if (versionNumber && !selected) throw notFound();
  const isOwner = roadmap.kind === "CUSTOM" && userId !== null && roadmap.ownerId === userId;
  const draft = isOwner
    ? await prisma.roadmapVersion.findFirst({
        where: { roadmapId: roadmap.id, publishedAt: null },
        select: { number: true },
      })
    : null;
  const owner = roadmap.ownerId
    ? await prisma.user.findUnique({ where: { id: roadmap.ownerId }, select: { name: true } })
    : null;
  return {
    roadmap: {
      id: roadmap.id,
      kind: roadmap.kind,
      title: roadmap.title,
      description: roadmap.description,
      sourceUrl: roadmap.sourceUrl,
      visibility: roadmap.visibility,
      shareToken: isOwner ? roadmap.shareToken : null,
      ownerName: owner?.name ?? null,
    },
    isOwner,
    hasDraft: draft !== null,
    versions: versions.map((v) => ({
      number: v.number,
      publishedAt: v.publishedAt!,
      problemCount: v._count.items,
    })),
    selectedVersion: selected
      ? { number: selected.number, publishedAt: selected.publishedAt! }
      : null,
    sections: selected ? await versionContent(prisma, selected.id) : [],
  };
}
export type RoadmapView = Awaited<ReturnType<typeof buildView>>;

/** A link-shared roadmap, for any signed-in user holding the token. */
export async function getSharedRoadmapView(userId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw notFound();
  const roadmap = await prisma.roadmap.findUnique({ where: { shareToken: token } });
  if (!roadmap || roadmap.visibility !== "LINK") throw notFound();
  return buildView(roadmap, userId);
}

export async function listRoadmapsForViewer(userId: string) {
  const latestPublished = {
    where: { publishedAt: { not: null } },
    orderBy: { number: "desc" as const },
    take: 1,
    select: { number: true, _count: { select: { items: true } } },
  };
  const [curated, mine, fromGroups] = await Promise.all([
    prisma.roadmap.findMany({
      where: { kind: "CURATED", versions: { some: { publishedAt: { not: null } } } },
      orderBy: { title: "asc" },
      include: { versions: latestPublished },
    }),
    prisma.roadmap.findMany({
      where: { kind: "CUSTOM", ownerId: userId },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: latestPublished,
        _count: { select: { versions: { where: { publishedAt: null } } } },
      },
    }),
    prisma.roadmap.findMany({
      where: {
        kind: "CUSTOM",
        NOT: { ownerId: userId },
        versions: { some: { plans: { some: { group: { memberships: { some: { userId } } } } } } },
      },
      orderBy: { title: "asc" },
      include: { versions: latestPublished, owner: { select: { name: true } } },
    }),
  ]);
  const summary = (r: {
    id: string;
    title: string;
    description: string | null;
    versions: { number: number; _count: { items: number } }[];
  }) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    latestVersion: r.versions[0]?.number ?? null,
    problemCount: r.versions[0]?._count.items ?? 0,
  });
  return {
    curated: curated.map(summary),
    mine: mine.map((r) => ({ ...summary(r), hasDraft: r._count.versions > 0 })),
    fromGroups: fromGroups.map((r) => ({ ...summary(r), ownerName: r.owner?.name ?? null })),
  };
}

// ---------------------------------------------------------------------------------------------
// Authoring
// ---------------------------------------------------------------------------------------------

export async function createCustomRoadmap(
  userId: string,
  details: RoadmapDetailsInput,
): Promise<{ id: string }> {
  return prisma.roadmap.create({
    data: { ...details, kind: "CUSTOM", ownerId: userId, versions: { create: { number: 1 } } },
    select: { id: true },
  });
}

export async function updateRoadmapDetails(
  userId: string,
  roadmapId: string,
  details: RoadmapDetailsInput,
) {
  await requireOwnedRoadmap(userId, roadmapId);
  await prisma.roadmap.update({ where: { id: roadmapId }, data: details });
}

export async function getDraft(userId: string, roadmapId: string) {
  const roadmap = await requireOwnedRoadmap(userId, roadmapId);
  const draft = await prisma.roadmapVersion.findFirst({ where: { roadmapId, publishedAt: null } });
  const latest = await prisma.roadmapVersion.findFirst({
    where: { roadmapId, publishedAt: { not: null } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return {
    roadmap: { id: roadmap.id, title: roadmap.title },
    latestPublishedNumber: latest?.number ?? null,
    draft: draft
      ? {
          number: draft.number,
          sections: (await versionContent(prisma, draft.id)).map((s) => ({
            title: s.title,
            problems: s.items.map((i) => ({
              id: i.problem.id,
              leetcodeSlug: i.problem.leetcodeSlug,
              title: i.problem.title,
              difficulty: i.problem.difficulty,
            })),
          })),
        }
      : null,
  };
}

/** Opens a draft for editing, copied from the latest published version. Idempotent. */
export async function startDraft(userId: string, roadmapId: string): Promise<void> {
  await requireOwnedRoadmap(userId, roadmapId);
  try {
    await prisma.$transaction(async (tx) => {
      if (await tx.roadmapVersion.findFirst({ where: { roadmapId, publishedAt: null } })) return;
      const latest = await tx.roadmapVersion.findFirst({
        where: { roadmapId },
        orderBy: { number: "desc" },
      });
      const draft = await tx.roadmapVersion.create({
        data: { roadmapId, number: (latest?.number ?? 0) + 1 },
      });
      if (!latest?.publishedAt) return;
      const sections = await tx.roadmapSection.findMany({
        where: { versionId: latest.id },
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" } } },
      });
      await writeContent(tx, draft.id, {
        sections: sections.map((s) => ({
          title: s.title,
          problemIds: s.items.map((i) => i.problemId),
        })),
      });
    });
  } catch (error) {
    // Another tab opened the draft at the same moment.
    if (!isUniqueViolation(error)) throw error;
  }
}

async function writeContent(
  tx: Prisma.TransactionClient,
  versionId: string,
  content: DraftContent,
) {
  for (const [position, section] of content.sections.entries()) {
    const saved = await tx.roadmapSection.create({
      data: { versionId, position, title: section.title },
    });
    await tx.roadmapItem.createMany({
      data: section.problemIds.map((problemId, index) => ({
        versionId,
        sectionId: saved.id,
        problemId,
        position: index,
      })),
    });
  }
}

async function replaceDraftContent(
  tx: Prisma.TransactionClient,
  roadmapId: string,
  content: DraftContent,
) {
  const draft = await tx.roadmapVersion.findFirst({ where: { roadmapId, publishedAt: null } });
  if (!draft)
    throw new DomainError("NO_DRAFT", "This draft was published or discarded. Reload to continue.");
  const ids = content.sections.flatMap((s) => s.problemIds);
  if (new Set(ids).size !== ids.length) {
    throw new DomainError("DUPLICATE_PROBLEM", "A problem can appear only once in a roadmap.");
  }
  if ((await tx.problem.count({ where: { id: { in: ids } } })) !== ids.length) {
    throw new DomainError(
      "UNKNOWN_PROBLEM",
      "One of these problems no longer exists. Reload and try again.",
    );
  }
  await tx.roadmapSection.deleteMany({ where: { versionId: draft.id } });
  await writeContent(tx, draft.id, content);
  await tx.roadmap.update({ where: { id: roadmapId }, data: { updatedAt: new Date() } });
  return draft;
}

export async function saveDraft(
  userId: string,
  roadmapId: string,
  content: DraftContent,
): Promise<void> {
  await requireOwnedRoadmap(userId, roadmapId);
  await prisma.$transaction((tx) => replaceDraftContent(tx, roadmapId, content));
}

/** Saves and publishes the draft. The published version can never change afterwards. */
export async function publishDraft(
  userId: string,
  roadmapId: string,
  content: DraftContent,
): Promise<number> {
  await requireOwnedRoadmap(userId, roadmapId);
  const problem = publishProblem(content);
  if (problem) throw new DomainError("NOT_PUBLISHABLE", problem);
  return prisma.$transaction(async (tx) => {
    const draft = await replaceDraftContent(tx, roadmapId, content);
    await tx.roadmapVersion.update({ where: { id: draft.id }, data: { publishedAt: new Date() } });
    return draft.number;
  });
}

export async function discardDraft(userId: string, roadmapId: string): Promise<void> {
  await requireOwnedRoadmap(userId, roadmapId);
  await prisma.roadmapVersion.deleteMany({ where: { roadmapId, publishedAt: null } });
}

export async function deleteRoadmap(userId: string, roadmapId: string): Promise<void> {
  await requireOwnedRoadmap(userId, roadmapId);
  try {
    await prisma.roadmap.delete({ where: { id: roadmapId } });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new DomainError(
        "ROADMAP_IN_USE",
        "A group's plan uses this roadmap, so it can't be deleted.",
      );
    }
    throw error;
  }
}

export async function setLinkSharing(
  userId: string,
  roadmapId: string,
  enabled: boolean,
): Promise<void> {
  const roadmap = await requireOwnedRoadmap(userId, roadmapId);
  if (enabled === (roadmap.visibility === "LINK")) return;
  await prisma.roadmap.update({
    where: { id: roadmapId },
    data: enabled
      ? { visibility: "LINK", shareToken: randomBytes(24).toString("base64url") }
      : { visibility: "PRIVATE", shareToken: null },
  });
}

// ---------------------------------------------------------------------------------------------
// Problem catalog
// ---------------------------------------------------------------------------------------------

export async function searchProblems(query: string, limit = 8): Promise<ProblemSummary[]> {
  const text = query.trim();
  if (text.length < 2) return [];
  const slug = parseLeetCodeSlug(text);
  const results = await prisma.problem.findMany({
    where: {
      OR: [
        { title: { contains: text, mode: "insensitive" } },
        { leetcodeSlug: { contains: slug ?? text.toLowerCase().replace(/\s+/g, "-") } },
      ],
    },
    orderBy: { title: "asc" },
    take: limit,
    select: problemSummary,
  });
  // An exact slug match (someone pasted a URL) goes first.
  return results.sort((a, b) => Number(b.leetcodeSlug === slug) - Number(a.leetcodeSlug === slug));
}

export type LeetCodeLookup =
  { status: "found"; problem: ProblemSummary } | { status: "needs-details"; slug: string };

/**
 * Finds a catalog problem by LeetCode URL or slug. When it isn't in the catalog yet and details
 * are given, adds it as a user-submitted problem (source USER).
 */
export async function findOrAddLeetCodeProblem(
  userId: string,
  input: string,
  details?: { title: string; difficulty: Difficulty },
): Promise<LeetCodeLookup> {
  const slug = parseLeetCodeSlug(input);
  if (!slug) {
    throw new DomainError(
      "INVALID_LEETCODE_URL",
      "Paste a LeetCode problem link, like leetcode.com/problems/two-sum/.",
      "url",
    );
  }
  const existing = await prisma.problem.findUnique({
    where: { leetcodeSlug: slug },
    select: problemSummary,
  });
  if (existing) return { status: "found", problem: existing };
  if (!details) return { status: "needs-details", slug };

  const added = await prisma.problem.count({
    where: { createdById: userId, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (added >= USER_PROBLEMS_PER_DAY) {
    throw new DomainError(
      "RATE_LIMITED",
      "You've added a lot of problems today. Try again tomorrow.",
    );
  }
  try {
    const problem = await prisma.problem.create({
      data: {
        leetcodeSlug: slug,
        title: details.title,
        difficulty: details.difficulty,
        source: "USER",
        createdById: userId,
      },
      select: problemSummary,
    });
    return { status: "found", problem };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Someone added the same problem at the same moment.
    return {
      status: "found",
      problem: await prisma.problem.findUniqueOrThrow({
        where: { leetcodeSlug: slug },
        select: problemSummary,
      }),
    };
  }
}
