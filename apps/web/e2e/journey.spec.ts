import type { Page } from "@playwright/test";
import {
  anotherUser,
  chooseTimezone,
  expect,
  mondayWeeksAgo,
  newAccountDetails,
  test,
} from "./support/fixtures";

// Phase 1's definition of done, entirely through the UI: two people join one group, see the same
// weekly assignments, and track independent progress. Also covers PRD acceptance scenarios 1
// (same current-week problems), 2 (a missed week stays in the backlog while the group advances),
// and 5 (a non-member can't reach the group by URL).

async function signUp(page: Page, details: ReturnType<typeof newAccountDetails>) {
  await page.getByLabel("Name", { exact: true }).fill(details.name);
  await page.getByLabel("Email").fill(details.email);
  await page.getByLabel("Password", { exact: true }).fill(details.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Username").fill(details.username);
  await chooseTimezone(page, "Timezone", "UTC");
  await page.getByRole("button", { name: "Continue" }).click();
}

const weekTwo = (page: Page) =>
  page
    .getByRole("region", { name: "Essentials 75" })
    .getByRole("list", { name: "Week 2 problems" })
    .getByRole("listitem");

const memberRow = (page: Page, name: string) =>
  page
    .getByRole("list", { name: "Progress by member" })
    .getByRole("listitem")
    .filter({ hasText: name });

const summaryStat = (page: Page, label: string) =>
  page
    .getByRole("complementary", { name: "Weekly summary" })
    .getByText(label, { exact: true })
    .locator("..");

test("two friends share a weekly plan and track their own progress", async ({
  page,
  browser,
  baseURL,
}) => {
  test.slow();
  const admin = newAccountDetails("admin");
  const friend = newAccountDetails("friend");

  // 1. The admin signs up, creates a group, and schedules a roadmap that started last week.
  await page.goto("/");
  await page.getByRole("link", { name: "Create account" }).click();
  await signUp(page, admin);
  await expect(page.getByText("Join or create a group")).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Create group" }).click();
  await page.getByLabel("Group name").fill("Offer season");
  await chooseTimezone(page, "Group timezone", "UTC");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Offer season" })).toBeVisible();
  const groupUrl = page.url();

  await page.getByRole("link", { name: "Choose a roadmap" }).click();
  await expect(page).toHaveURL(/\/plan\/new$/);
  await page.getByLabel("Roadmap", { exact: true }).selectOption({ label: "Essentials 75" });
  await page.getByLabel("Start date").fill(mondayWeeksAgo(1));
  await page.getByLabel("Problems per week").fill("3");
  await expect(page.getByText(/75 problems over 25 weeks/)).toBeVisible();
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect(page.getByRole("heading", { level: 2, name: /^Week 2\b/ })).toContainText(
    "This week",
  );

  // 2. The admin invites a friend, who signs up from the link and joins.
  await page.goto(`${groupUrl}/settings`);
  await page.getByRole("button", { name: "Create link" }).click();
  const inviteUrl = await page.getByLabel("Invite link", { exact: true }).inputValue();

  const friendContext = await browser.newContext({ baseURL });
  const friendPage = await friendContext.newPage();
  await friendPage.goto(inviteUrl);
  await friendPage.getByRole("link", { name: "Create an account to join" }).click();
  await signUp(friendPage, friend);
  await friendPage.getByRole("button", { name: "Join group" }).click();
  await expect(friendPage.getByRole("heading", { level: 1, name: "Offer season" })).toBeVisible();

  // 3. Both see the same week and the same problems (scenario 1).
  await page.goto(groupUrl);
  for (const p of [page, friendPage]) {
    await expect(p.getByText(/Week 2 of 25/).first()).toBeVisible();
    await expect(weekTwo(p)).toHaveCount(3);
  }
  const titles = (texts: string[]) => texts.map((t) => t.split("(opens LeetCode")[0]!.trim());
  expect(titles(await weekTwo(friendPage).allTextContents())).toEqual(
    titles(await weekTwo(page).allTextContents()),
  );

  // 4. Each tracks their own progress: the admin solves two of this week's problems; the friend
  //    catches up on one from last week (scenario 2: week 1 is still there).
  for (const index of [0, 1]) {
    const toggle = weekTwo(page)
      .nth(index)
      .getByRole("button", { name: /^Solved:/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  }
  await friendPage.goto("/home");
  const backlog = friendPage.getByRole("list", { name: "Offer season: backlog" });
  await expect(backlog.getByRole("listitem")).toHaveCount(3);
  const firstBacklog = backlog
    .getByRole("listitem")
    .first()
    .getByRole("button", { name: /^Solved:/ });
  await firstBacklog.click();
  await expect(backlog.getByRole("listitem")).toHaveCount(2);
  await expect(summaryStat(friendPage, "Backlog")).toContainText("2");
  await expect(
    friendPage
      .getByRole("list", { name: "Offer season: this week" })
      .getByRole("button", { pressed: true }),
  ).toHaveCount(0);

  await page.goto("/home");
  await expect(summaryStat(page, "Backlog")).toContainText("3");
  await expect(
    page.getByRole("complementary", { name: "Weekly summary" }).getByText(/assigned this week/),
  ).toHaveText("2 of 3 assigned this week");

  // 5. On the group page each sees the other's progress on assigned problems.
  await friendPage.goto(groupUrl);
  await expect(memberRow(friendPage, admin.name)).toContainText("3 in backlog");
  await expect(memberRow(friendPage, admin.name)).toContainText("2/75 solved");
  await expect(memberRow(friendPage, friend.name)).toContainText("2 in backlog");
  await expect(memberRow(friendPage, friend.name)).toContainText("1/75 solved");
  await expect(weekTwo(friendPage).nth(0)).toContainText(`Solved by ${admin.name}`);
  await expect(
    weekTwo(friendPage)
      .nth(0)
      .getByRole("button", { name: /^Solved:/ }),
  ).toHaveAttribute("aria-pressed", "false");

  // 6. Someone outside the group can't reach it (scenario 5).
  const outsider = await anotherUser(browser, baseURL!, "outsider");
  for (const path of ["", "/plan", "/settings"]) {
    expect((await outsider.page.goto(`${groupUrl}${path}`))?.status()).toBe(404);
  }
  await expect(outsider.page.getByText("Offer season")).toHaveCount(0);

  await outsider.context.close();
  await friendContext.close();
});
