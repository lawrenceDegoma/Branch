import type { PrismaClient } from "./generated/prisma/client";

/**
 * Empties every application table. Refuses to run unless the connected database name ends in
 * "_test", so it can never wipe development or production data.
 */
export async function resetTestDatabase(prisma: PrismaClient): Promise<void> {
  const [row] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  const name = row?.name ?? "";
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset database "${name}": test databases must end in "_test".`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list.join(", ")} RESTART IDENTITY CASCADE`);
}
