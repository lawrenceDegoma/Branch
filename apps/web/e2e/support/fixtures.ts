import { randomUUID } from "node:crypto";
import { prisma } from "@branch/database";
import { addDays, dateInTimeZone, isoWeekday, toDbDate } from "@branch/shared/calendar";
import { generateAssignments } from "@branch/shared/schedule";
import {
  test as base,
  expect,
  type APIRequestContext,
  type Browser,
  type Page,
} from "@playwright/test";

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

/**
 * Signs up through Better Auth's HTTP API; the session cookie lands in `request`'s context.
 * Accounts sign in with GitHub too, like everyone who has moved off passwords; `passwordOnly`
 * leaves one that hasn't moved yet. (The password stays so tests can sign in through the API.)
 */
export async function signUpViaApi(
  request: APIRequestContext,
  baseURL: string,
  details = newAccountDetails(),
  { onboard = true, passwordOnly = false } = {},
): Promise<TestAccount> {
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: details.name, email: details.email, password: details.password },
    headers: { Origin: baseURL },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const { user } = (await response.json()) as { user: { id: string } };
  if (!passwordOnly) await connectGitHubInDb(user.id);
  if (onboard) {
    await prisma.profile.create({
      data: { userId: user.id, username: details.username, timezone: "UTC" },
    });
  }
  return { ...details, id: user.id };
}

/** What Better Auth stores once someone connects GitHub (without the GitHub round trip). */
export async function connectGitHubInDb(userId: string) {
  await prisma.account.create({
    data: { id: randomUUID(), userId, providerId: "github", accountId: `e2e-${randomUUID()}` },
  });
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

/** Monday of the current week, `weeksAgo` weeks back, in UTC (the timezone of test groups). */
export function mondayWeeksAgo(weeksAgo = 0): string {
  const today = dateInTimeZone(new Date(), "UTC");
  return addDays(today, -(isoWeekday(today) - 1) - 7 * weeksAgo);
}

/**
 * Gives a group a plan on the seeded "Starter sample" roadmap, directly in the database.
 * Four problems a week: week 1 is Contains Duplicate, Valid Anagram, Two Sum, Group Anagrams.
 */
export async function createPlanInDb(groupId: string, adminId: string, startDate: string) {
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
  const assignments = generateAssignments(
    version.sections.map((s) => ({ itemIds: s.items.map((i) => i.id) })),
    { mode: "PER_WEEK", problemsPerWeek: 4 },
  );
  const plan = await prisma.groupRoadmapPlan.create({
    data: {
      groupId,
      roadmapVersionId: version.id,
      startDate: toDbDate(startDate),
      pacing: "PER_WEEK",
      problemsPerWeek: 4,
      createdById: adminId,
    },
  });
  await prisma.weeklyAssignment.createMany({
    data: assignments.map((a) => ({
      planId: plan.id,
      versionId: version.id,
      roadmapItemId: a.itemId,
      weekNumber: a.weekNumber,
    })),
  });
  return plan;
}

/**
 * Marks problems solved for a user directly in the database, with reviews due `dueInDays` from
 * today (0: due now). Test accounts use UTC.
 */
export async function solveInDb(userId: string, slugs: string[], dueInDays = 0) {
  const problems = await prisma.problem.findMany({ where: { leetcodeSlug: { in: slugs } } });
  const dueOn = toDbDate(addDays(dateInTimeZone(new Date(), "UTC"), dueInDays));
  for (const problem of problems) {
    await prisma.problemCompletion.create({
      data: { userId, problemId: problem.id, source: "MANUAL", completedAt: new Date() },
    });
    await prisma.reviewSchedule.create({
      data: { userId, problemId: problem.id, dueOn, intervalDays: 3, ease: 250 },
    });
  }
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

/** Picks a zone in a timezone combobox by typing part of its name, as a person would. */
export async function chooseTimezone(page: Page, label: string, zone: string) {
  const input = page.getByRole("combobox", { name: label, exact: true });
  await input.fill("");
  await input.fill(zone.replaceAll("_", " ").split("/").pop()!);
  await page.getByRole("option", { name: zone.replaceAll("_", " "), exact: true }).click();
  await expect(input).toHaveValue(zone.replaceAll("_", " "));
}
