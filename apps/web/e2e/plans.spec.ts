import { addDays, dateInTimeZone, isoWeekday } from "@branch/shared/calendar";
import type { Page } from "@playwright/test";
import { anotherUser, createGroupInDb, expect, test } from "./support/fixtures";

// Groups created by createGroupInDb use UTC, so "this week" is computed in UTC.
function mondayThisWeek(): string {
  const today = dateInTimeZone(new Date(), "UTC");
  return addDays(today, -(isoWeekday(today) - 1));
}

async function choosePlan(
  page: Page,
  groupId: string,
  options: { startDate?: string; perWeek?: string } = {},
) {
  await page.goto(`/groups/${groupId}/plan/new`);
  await page.getByLabel("Roadmap", { exact: true }).selectOption({ label: "Starter sample" });
  if (options.startDate) await page.getByLabel("Start date").fill(options.startDate);
  if (options.perWeek) await page.getByLabel("Problems per week").fill(options.perWeek);
}

test.describe("group plans", () => {
  test("an admin schedules a roadmap and every member sees the same week", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const member = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Plan crew", [member.account.id]);

    await page.goto(`/groups/${group.id}`);
    await page.getByRole("link", { name: "Choose a roadmap" }).click();
    await choosePlan(page, group.id, { startDate: mondayThisWeek(), perWeek: "4" });
    await expect(page.getByText(/22 problems over 6 weeks/)).toBeVisible();
    await page.getByRole("button", { name: "Start plan" }).click();

    await expect(page).toHaveURL(new RegExp(`/groups/${group.id}/plan$`));
    await expect(page.getByRole("heading", { level: 2, name: /^Week \d/ })).toHaveCount(6);
    const week1 = page.getByRole("region", { name: /^Week 1/ });
    await expect(week1.getByText("This week")).toBeVisible();

    // Both people see week 1 of 6 with the same four problems on the group page.
    for (const viewerPage of [page, member.page]) {
      await viewerPage.goto(`/groups/${group.id}`);
      const roadmap = viewerPage.getByRole("region", { name: "Starter sample" });
      await expect(roadmap.getByText(/Week 1 of 6/)).toBeVisible();
      await expect(roadmap.getByText("4 problems a week")).toBeVisible();
      await expect(
        roadmap.getByRole("list", { name: "Week 1 problems" }).getByRole("listitem"),
      ).toHaveText([/Contains Duplicate/, /Valid Anagram/, /Two Sum/, /Group Anagrams/]);
    }
    await member.context.close();
  });

  test("an admin moves a problem to another week", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Moving crew");
    await choosePlan(page, group.id, { startDate: mondayThisWeek(), perWeek: "4" });
    await page.getByRole("button", { name: "Start plan" }).click();

    await page.getByLabel("Week for Two Sum").selectOption("2");
    await page.getByRole("button", { name: "Move Two Sum" }).click();
    const twoSum = { name: /^Two Sum/ };
    await expect(
      page.getByRole("region", { name: /^Week 2/ }).getByRole("link", twoSum),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /^Week 1/ }).getByRole("link", twoSum),
    ).toHaveCount(0);
  });

  test("members can read the schedule but not change it", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const owner = await anotherUser(browser, baseURL!, "owner");
    const group = await createGroupInDb(owner.account.id, "Read-only crew", [viewer.id]);
    await choosePlan(owner.page, group.id, { startDate: mondayThisWeek() });
    await owner.page.getByRole("button", { name: "Start plan" }).click();
    await expect(owner.page).toHaveURL(/\/plan$/);

    await page.goto(`/groups/${group.id}/plan`);
    await expect(page.getByRole("heading", { level: 2, name: /^Week 1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "End plan" })).toHaveCount(0);
    expect((await page.goto(`/groups/${group.id}/plan/new`))?.status()).toBe(404);
    await owner.context.close();
  });

  test("a future start shows when the plan begins", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Future crew");
    await choosePlan(page, group.id, { startDate: addDays(mondayThisWeek(), 14) });
    await page.getByRole("button", { name: "Start plan" }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.goto(`/groups/${group.id}`);
    await expect(
      page.getByRole("region", { name: "Starter sample" }).getByText(/^Starts /),
    ).toBeVisible();
  });

  test("invalid pace is explained", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Strict crew");
    await choosePlan(page, group.id, { perWeek: "0" });
    await page.getByRole("button", { name: "Start plan" }).click();
    await expect(page.getByText("At least 1 problem a week.")).toBeVisible();
  });

  test("an admin ends a plan", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Ending crew");
    await choosePlan(page, group.id);
    await page.getByRole("button", { name: "Start plan" }).click();
    await page.getByRole("button", { name: "End plan" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "End plan" }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${group.id}$`));
    await expect(page.getByRole("link", { name: "Choose a roadmap" })).toBeVisible();
  });
});
