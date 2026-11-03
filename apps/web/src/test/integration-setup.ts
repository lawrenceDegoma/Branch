import { prisma } from "@branch/database";
import { resetTestDatabase } from "@branch/database/testing";
import { beforeEach } from "vitest";

beforeEach(async () => {
  await resetTestDatabase(prisma);
});
