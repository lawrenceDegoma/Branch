import { randomUUID } from "node:crypto";
import { prisma } from "@branch/database";
import type { Page } from "@playwright/test";
import { createGroupInDb, expect, test } from "./support/fixtures";

// Schools and companies (M32): chosen in Settings from Branch's lists, counted toward Rankings
// without names once 5 people chose one, and shown to groups only with the switch on.

/**
 * A school of the test's own: browser projects run in parallel on one database, so counting
 * toward a real school would mix their members.
 */
async function schoolInDb() {
  const key = `t${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const school = { id: `school:${key}.edu`, name: `Test College ${key}`, key };
  await prisma.organization.create({
    data: { id: school.id, kind: "SCHOOL", name: school.name, country: "US" },
  });
  return school;
}

/** Waits for hydration, so typing reaches the search boxes. */
async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

/** A person made directly in the database, with a profile (and optionally a school). */
async function personInDb(data: { schoolId?: string; showAffiliation?: boolean } = {}) {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      name: `Classmate ${id.slice(0, 6)}`,
      email: `classmate-${id}@example.test`,
      profile: { create: { username: `c${id.slice(0, 12)}`, timezone: "UTC", ...data } },
    },
  });
  return id;
}

async function choose(page: Page, label: string, typed: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).fill(typed);
  await page.getByRole("option", { name: option }).click();
}

test.describe("schools and companies", () => {
  test("choosing a school counts toward Rankings once 5 people have chosen it", async ({
    page,
    viewer,
  }) => {
    const school = await schoolInDb();
    await page.goto("/settings");
    await ready(page);
    const section = page.getByRole("region", { name: "School and company" });
    // The web address finds the school and tells same-named schools apart.
    await choose(page, "School", school.key, `${school.name} ${school.key}.edu · United States`);
    await choose(page, "Company", "alphabet", "Google");
    await section.getByRole("button", { name: "Save school and company" }).click();
    await expect(section.getByRole("status")).toContainText(
      "Saved. Only you see your school and company.",
    );

    const problem = await prisma.problem.findFirstOrThrow({ where: { leetcodeSlug: "two-sum" } });
    await prisma.problemCompletion.create({
      data: { userId: viewer.id, problemId: problem.id, source: "MANUAL", completedAt: new Date() },
    });

    await page.goto("/rankings");
    const main = page.getByRole("main");
    await expect(main).toContainText(`${school.name} appears here once 5 people have chosen it.`);

    for (let i = 0; i < 4; i += 1) await personInDb({ schoolId: school.id });
    await page.reload();
    // The only solve among its members is this month's, wherever other tests' schools stand.
    await expect(main).toContainText(new RegExp(`${school.name} is \\d+\\w\\w of \\d+ this month`));
    const mine = main.getByRole("listitem").filter({ hasText: "Yours" });
    await expect(mine).toContainText(school.name);
    await expect(mine).toContainText("1 problem solved · 5 members · 0.2 per member");
    // No names on the page: only the school and its numbers.
    await expect(main).not.toContainText(viewer.name);

    await main.getByRole("link", { name: "Companies" }).click();
    await expect(page).toHaveURL(/\/rankings\?kind=companies$/);
    await expect(main.getByRole("heading", { name: /^Companies in / })).toBeVisible();

    // Removing the school deletes it and stops counting at once.
    await page.goto("/settings");
    await ready(page);
    await section.getByRole("button", { name: "Remove school" }).click();
    await section.getByRole("button", { name: "Save school and company" }).click();
    await expect(section.getByRole("status")).toContainText("Saved.");
    expect(
      (await prisma.profile.findUniqueOrThrow({ where: { userId: viewer.id } })).schoolId,
    ).toBeNull();
    await page.goto("/rankings");
    await expect(main).toContainText("You haven't added a school.");
  });

  test("groups see a member's school and company only with their switch on", async ({
    page,
    viewer,
  }) => {
    const school = await schoolInDb();
    const shown = await personInDb({ schoolId: school.id, showAffiliation: true });
    await prisma.profile.update({
      where: { userId: viewer.id },
      data: { schoolId: "school:stanford.edu", companyId: "company:google" },
    });
    const group = await createGroupInDb(viewer.id, "Study crew", [shown]);
    await page.goto(`/groups/${group.id}`);
    const members = page.getByRole("region", { name: /Members/ });
    await expect(members).toContainText(school.name);
    // The viewer's own switch is off, so their school isn't shown, even to themselves here.
    await expect(members).not.toContainText("Stanford University");

    await page.goto("/settings");
    await ready(page);
    const section = page.getByRole("region", { name: "School and company" });
    await section.getByLabel("Show my school and company to my groups").check();
    await section.getByRole("button", { name: "Save school and company" }).click();
    await expect(section.getByRole("status")).toContainText("Your groups see");
    await page.goto(`/groups/${group.id}`);
    await expect(members).toContainText("Stanford University · Google");
  });

  test("the search boxes work from the keyboard", async ({ page, viewer }) => {
    await page.goto("/settings");
    await ready(page);
    const company = page.getByRole("combobox", { name: "Company", exact: true });
    await company.focus();
    await page.keyboard.type("alphabet");
    await expect(page.getByRole("option", { name: "Google" })).toBeVisible();
    // The first match is highlighted as you type; Enter picks it.
    await page.keyboard.press("Enter");
    await expect(company).toHaveValue("Google");
    const section = page.getByRole("region", { name: "School and company" });
    await section.getByRole("button", { name: "Save school and company" }).press("Enter");
    await expect(section.getByRole("status")).toContainText("Saved.");
    expect(
      (await prisma.profile.findUniqueOrThrow({ where: { userId: viewer.id } })).companyId,
    ).toBe("company:google");
  });

  test("Rankings need an account", async ({ page }) => {
    await page.goto("/rankings");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
