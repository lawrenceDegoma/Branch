import { randomUUID } from "node:crypto";
import { prisma } from "@branch/database";
import { test as base, expect, type APIRequestContext, type Browser } from "@playwright/test";

export type TestAccount = {
  id: string;
  name: string;
  email: string;
  password: string;
  username: string;
};

export function newAccountDetails(prefix = "user") {
  const id = randomUUID().slice(0, 8);
  return {
    name: `Test ${id}`,
    email: `${prefix}-${id}@example.test`,
    password: "correct-horse-battery",
    username: `${prefix}-${id}`,
  };
}

/** Signs up through Better Auth's HTTP API; the session cookie lands in `request`'s context. */
export async function signUpViaApi(
  request: APIRequestContext,
  baseURL: string,
  details = newAccountDetails(),
  { onboard = true } = {},
): Promise<TestAccount> {
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: details.name, email: details.email, password: details.password },
    headers: { Origin: baseURL },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const { user } = (await response.json()) as { user: { id: string } };
  if (onboard) {
    await prisma.profile.create({
      data: { userId: user.id, username: details.username, timezone: "UTC" },
    });
  }
  return { ...details, id: user.id };
}

export async function signInViaApi(
  request: APIRequestContext,
  baseURL: string,
  account: TestAccount,
) {
  const response = await request.post("/api/auth/sign-in/email", {
    data: { email: account.email, password: account.password },
    headers: { Origin: baseURL },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

/** Creates a group directly in the database with `adminId` as admin and optional members. */
export async function createGroupInDb(
  adminId: string,
  name = "Study crew",
  memberIds: string[] = [],
) {
  return prisma.group.create({
    data: {
      name,
      timezone: "UTC",
      memberships: {
        create: [
          { userId: adminId, role: "ADMIN" as const },
          ...memberIds.map((userId) => ({ userId, role: "MEMBER" as const })),
        ],
      },
    },
  });
}

/** A second signed-in person in their own browser context. */
export async function anotherUser(browser: Browser, baseURL: string, prefix = "friend") {
  const context = await browser.newContext({ baseURL });
  const account = await signUpViaApi(context.request, baseURL, newAccountDetails(prefix));
  return { context, page: await context.newPage(), account };
}

/** `viewer`: a fresh, onboarded account signed in on the test's page. */
export const test = base.extend<{ viewer: TestAccount }>({
  viewer: async ({ context, baseURL }, use) => {
    await use(await signUpViaApi(context.request, baseURL!));
  },
});

export { expect };
