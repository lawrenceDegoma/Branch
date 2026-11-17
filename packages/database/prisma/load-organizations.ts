// Loads the school and company lists in prisma/data/organizations. Safe in any environment:
// idempotent, creates no accounts, and never deletes an organization.
//
//   pnpm db:load-organizations     (production: DATABASE_URL=<direct> pnpm db:load-organizations)
import { createPrismaClient } from "../src/index";
import { readOrganizationLists, syncOrganizations } from "../src/organization-import";

async function main() {
  const prisma = createPrismaClient();
  try {
    const result = await syncOrganizations(prisma, readOrganizationLists());
    console.log(
      `Organizations: ${result.schools} schools, ${result.companies} companies (${result.changed} added or changed)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // P2010 with 42P01, or P2021: the table is missing, so this database hasn't been migrated.
  const message = String((error as { message?: string }).message ?? "");
  if ((error as { code?: string }).code === "P2021" || message.includes("42P01")) {
    console.error(
      "This database has no organization table yet. Run `pnpm db:deploy` with the same DATABASE_URL first.",
    );
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
