// Development seed: catalog, sample roadmap, two dev accounts, one group with a plan, and some
// progress. Idempotent.
// Usage: pnpm db:seed   (loads the root .env; refuses to run when NODE_ENV=production)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { addDays, dateInTimeZone, isoWeekday, toDbDate } from "@branch/shared/calendar";
import { catalogSchema, roadmapDefinitionSchema } from "@branch/shared/catalog";
import { generateAssignments } from "@branch/shared/schedule";
import { hashPassword } from "better-auth/crypto";
import { importCuratedRoadmap, syncCatalog } from "../src/catalog-import";
import { createPrismaClient } from "../src/index";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed development data in production.");
}

export const DEV_PASSWORD = "branch-dev-password";

const devUsers = [
  {
    id: "dev-user-ada",
    name: "Ada Lovelace",
    email: "ada@example.test",
    username: "ada",
    timezone: "Europe/London",
  },
  {
    id: "dev-user-grace",
    name: "Grace Hopper",
    email: "grace@example.test",
    username: "grace",
    timezone: "America/New_York",
  },
] as const;

const dataDir = path.join(import.meta.dirname, "data");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));

async function main() {
  const prisma = createPrismaClient();
  try {
    const catalog = catalogSchema.parse(readJson(path.join(dataDir, "catalog.json")));
    const synced = await syncCatalog(prisma, catalog, "SEED");
    console.log(`Catalog: ${synced.problems} problems, ${synced.tags} tags`);

    const roadmapDir = path.join(dataDir, "roadmaps");
    for (const file of readdirSync(roadmapDir)
      .filter((f) => f.endsWith(".json"))
      .sort()) {
      const definition = roadmapDefinitionSchema.parse(readJson(path.join(roadmapDir, file)));
      const result = await importCuratedRoadmap(prisma, definition);
      console.log(
        `Roadmap ${definition.slug}: version ${result.versionNumber}${result.created ? " (new)" : ""}`,
      );
    }

    const passwordHash = await hashPassword(DEV_PASSWORD);
    for (const user of devUsers) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: true,
          accounts: {
            create: {
              id: `${user.id}-credential`,
              accountId: user.id,
              providerId: "credential",
              password: passwordHash,
            },
          },
          profile: { create: { username: user.username, timezone: user.timezone } },
        },
      });
    }
    console.log(
      `Dev accounts: ${devUsers.map((u) => u.email).join(", ")} (password: ${DEV_PASSWORD})`,
    );

    const [ada, grace] = devUsers;
    let group = await prisma.group.findFirst({
      where: {
        name: "Interview prep crew",
        memberships: { some: { userId: ada.id, role: "ADMIN" } },
      },
    });
    if (!group) {
      group = await prisma.group.create({
        data: {
          name: "Interview prep crew",
          description: "Weekly practice before fall interviews.",
          timezone: "America/New_York",
          createdById: ada.id,
          memberships: {
            create: [
              { userId: ada.id, role: "ADMIN" },
              { userId: grace.id, role: "MEMBER" },
            ],
          },
          auditEvents: {
            create: [
              { action: "GROUP_CREATED", actorId: ada.id },
              { action: "MEMBER_JOINED", actorId: grace.id, subjectUserId: grace.id },
            ],
          },
        },
      });
    }
    console.log('Group: "Interview prep crew" (Ada admin, Grace member)');

    // A plan on the sample roadmap that started last Monday, so week 2 is in progress.
    if (
      !(await prisma.groupRoadmapPlan.findFirst({ where: { groupId: group.id, status: "ACTIVE" } }))
    ) {
      const version = await prisma.roadmapVersion.findFirstOrThrow({
        where: { roadmap: { slug: "starter-sample" }, publishedAt: { not: null } },
        orderBy: { number: "desc" },
        include: {
          sections: {
            orderBy: { position: "asc" },
            include: { items: { orderBy: { position: "asc" } } },
          },
        },
      });
      const today = dateInTimeZone(new Date(), group.timezone);
      const startDate = addDays(today, -(isoWeekday(today) - 1) - 7); // Monday of last week
      const assignments = generateAssignments(
        version.sections.map((s) => ({ itemIds: s.items.map((i) => i.id) })),
        { mode: "PER_WEEK", problemsPerWeek: 4 },
      );
      await prisma.$transaction(async (tx) => {
        const plan = await tx.groupRoadmapPlan.create({
          data: {
            groupId: group.id,
            roadmapVersionId: version.id,
            startDate: toDbDate(startDate),
            pacing: "PER_WEEK",
            problemsPerWeek: 4,
            createdById: ada.id,
          },
        });
        await tx.weeklyAssignment.createMany({
          data: assignments.map((a) => ({
            planId: plan.id,
            versionId: version.id,
            roadmapItemId: a.itemId,
            weekNumber: a.weekNumber,
          })),
        });
      });
    }
    console.log("Plan: Starter sample, 4 problems a week, started last Monday");

    // Some progress, so Home and the branch graph have something to show: Ada has one problem
    // left over from week 1; Grace has finished week 1, is halfway through week 2, and has
    // solved one problem ahead.
    const plan = await prisma.groupRoadmapPlan.findFirstOrThrow({
      where: { groupId: group.id, status: "ACTIVE" },
      include: {
        assignments: {
          orderBy: [{ weekNumber: "asc" }, { roadmapItem: { position: "asc" } }],
          include: { roadmapItem: { select: { problemId: true } } },
        },
      },
    });
    const week = (n: number) =>
      plan.assignments.filter((a) => a.weekNumber === n).map((a) => a.roadmapItem.problemId);
    const solved = {
      [ada.id]: week(1).slice(0, 3),
      [grace.id]: [...week(1), ...week(2).slice(0, 2), ...week(3).slice(0, 1)],
    };
    await prisma.problemCompletion.createMany({
      data: Object.entries(solved).flatMap(([userId, problemIds]) =>
        problemIds.map((problemId) => ({
          userId,
          problemId,
          source: "MANUAL" as const,
          completedAt: new Date(),
        })),
      ),
      skipDuplicates: true,
    });
    console.log("Progress: Ada 3 solved (1 in backlog), Grace 7 solved (1 ahead)");

    // Every solved problem has a review schedule (the app creates it with the completion). Ada's
    // are due today, so the Review page has something to show; Grace's come up over the next days.
    await prisma.reviewSchedule.createMany({
      data: devUsers.flatMap((user) =>
        (solved[user.id] ?? []).map((problemId, index) => ({
          userId: user.id,
          problemId,
          dueOn: toDbDate(
            addDays(dateInTimeZone(new Date(), user.timezone), user.id === ada.id ? 0 : index + 1),
          ),
          intervalDays: 3,
          ease: 250,
        })),
      ),
      skipDuplicates: true,
    });
    console.log("Reviews: Ada 3 due today, Grace 1 a day from tomorrow");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
