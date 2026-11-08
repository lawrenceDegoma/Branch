import type { Locator, Page } from "@playwright/test";
import {
  anotherUser,
  createGroupInDb,
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  test,
} from "./support/fixtures";

const toggle = (scope: Page | Locator, title: string) =>
  scope.getByRole("button", { name: `Solved: ${title}`, exact: true });

/** Waits for hydration, so clicks reach the client component. */
async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

test.describe("progress", () => {
  test("a member marks a problem solved and the group sees it", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const member = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Progress crew", [member.account.id]);
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));

    await page.goto(`/groups/${group.id}`);
    await ready(page);
    await toggle(page, "Two Sum").click();
    await expect(toggle(page, "Two Sum")).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(toggle(page, "Two Sum")).toHaveAttribute("aria-pressed", "true");

    // The other member sees who solved it and the branch graph moves; their own check is empty.
    await member.page.goto(`/groups/${group.id}`);
    const week = member.page.getByRole("list", { name: "Week 1 problems" });
    await expect(week.getByRole("listitem").filter({ hasText: "Two Sum" })).toContainText(
      `Solved by ${viewer.name}`,
    );
    await expect(toggle(member.page, "Two Sum")).toHaveAttribute("aria-pressed", "false");
    const graph = member.page.getByRole("list", { name: "Progress by member" });
    await expect(graph.getByRole("listitem").filter({ hasText: viewer.name })).toContainText(
      "1/22 solved",
    );

    // Undo.
    await toggle(page, "Two Sum").click();
    await expect(toggle(page, "Two Sum")).toHaveAttribute("aria-pressed", "false");
    await member.page.reload();
    await expect(member.page.getByText(`Solved by ${viewer.name}`)).toHaveCount(0);
    await member.context.close();
  });

  test("unsolved problems stay in the backlog as the weeks move on", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Backlog crew");
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(2)); // now in week 3

    await page.goto("/home");
    await ready(page);
    const backlog = page.getByRole("list", { name: "Backlog crew: backlog" });
    await expect(backlog.getByRole("listitem")).toHaveCount(8);
    await expect(backlog.getByRole("listitem").first()).toContainText("Week 1");
    const summary = page.getByRole("complementary", { name: "Weekly summary" });
    await expect(summary.getByText("Backlog").locator("..")).toContainText("8");

    await toggle(page, "Two Sum").click();
    await expect(backlog.getByRole("listitem")).toHaveCount(7);
    await expect(summary.getByText("Backlog").locator("..")).toContainText("7");

    await page.goto(`/groups/${group.id}/plan`);
    const week1 = page.getByRole("region", { name: /^Week 1\b/ });
    await expect(week1.getByRole("heading")).toContainText("1 of 4 solved");
    await expect(week1.getByText("Backlog")).toHaveCount(3);
  });

  test("one completion counts in every group that assigns the problem", async ({
    page,
    viewer,
  }) => {
    const first = await createGroupInDb(viewer.id, "First crew");
    const second = await createGroupInDb(viewer.id, "Second crew");
    await createPlanInDb(first.id, viewer.id, mondayWeeksAgo(0));
    await createPlanInDb(second.id, viewer.id, mondayWeeksAgo(0));

    await page.goto("/home");
    await ready(page);
    const inFirst = page.getByRole("list", { name: "First crew: this week" });
    const inSecond = page.getByRole("list", { name: "Second crew: this week" });
    await toggle(inFirst, "Two Sum").click();
    await expect(toggle(inSecond, "Two Sum")).toHaveAttribute("aria-pressed", "true");
    // Both groups assign the same four problems this week; the summary counts them once.
    await expect(
      page.getByRole("complementary", { name: "Weekly summary" }).getByText(/assigned this week/),
    ).toHaveText("1 of 4 assigned this week");

    await page.goto("/roadmaps");
    await page
      .getByRole("link", { name: /Starter sample/ })
      .first()
      .click();
    await expect(page.getByText("You've solved 1 of 22")).toBeVisible();
  });

  test("working ahead is recognized", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Ahead crew");
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));

    await page.goto("/home");
    await ready(page);
    await page.locator("summary", { hasText: "Next week" }).click();
    await toggle(page, "Valid Palindrome").click();
    await expect(toggle(page, "Valid Palindrome")).toHaveAttribute("aria-pressed", "true");
    const summary = page.getByRole("complementary", { name: "Weekly summary" });
    await expect(summary.getByText("Ahead").locator("..")).toContainText("1");

    await page.goto(`/groups/${group.id}`);
    const graph = page.getByRole("list", { name: "Progress by member" });
    await expect(graph.getByRole("listitem").filter({ hasText: "(you)" })).toContainText("1 ahead");
  });

  test("Home without a group points to creating one", async ({ page, viewer: _viewer }) => {
    await page.goto("/home");
    const card = page.getByRole("region", { name: "Get started" });
    await expect(card).toContainText("0 of 4 done");
    await expect(card.getByRole("link", { name: "Create group" })).toHaveAttribute(
      "href",
      "/groups/new",
    );
    // Hidden, the plain prompt is still there, and focus goes to the page's heading.
    await page.waitForFunction(() => document.readyState === "complete");
    await card.getByRole("button", { name: "Hide the Get started checklist" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeFocused();
    await expect(page.getByText("Start with a group")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create group" })).toBeVisible();
  });
});
