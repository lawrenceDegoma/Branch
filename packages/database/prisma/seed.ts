// Development seed: catalog, sample roadmap, two dev accounts, and one group. Idempotent.
// Usage: pnpm db:seed   (loads the root .env; refuses to run when NODE_ENV=production)
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { catalogSchema, roadmapDefinitionSchema } from "@branch/shared/catalog";
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
    const existingGroup = await prisma.group.findFirst({
      where: {
        name: "Interview prep crew",
        memberships: { some: { userId: ada.id, role: "ADMIN" } },
      },
    });
    if (!existingGroup) {
      await prisma.group.create({
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
