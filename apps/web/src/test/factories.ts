import { randomUUID } from "node:crypto";
import { prisma } from "@branch/database";

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
