import type { Page } from "@playwright/test";
import {
  anotherUser,
  createGroupInDb,
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  test,
} from "./support/fixtures";

// PRD scenarios 6 and 7: solving never posts unless the person opted in, and solving again never
// celebrates twice.

async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

/**
 * Toggles a problem on the group page and waits for the saved result: the toggle flips
 * optimistically, but the branch graph's count only changes once the server has saved.
 */
async function setSolved(page: Page, title: string, solved: boolean) {
  const toggle = page.getByRole("button", { name: `Solved: ${title}`, exact: true }).first();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", String(solved));
  const graph = page.getByRole("list", { name: "Progress by member" });
  await expect(graph.getByRole("listitem").filter({ hasText: "(you)" })).toContainText(
    solved ? "1/22 solved" : "0/22 solved",
  );
}

const solvePost = (page: Page, title: string) =>
  page
    .getByRole("main")
    .getByRole("article")
    .filter({ hasText: `Solved${title}` });

test.describe("automatic posts", () => {
  test("a solve posts nothing while sharing is off, the default", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Quiet crew", [friend.account.id]);
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));

    await page.goto("/settings");
    await expect(page.getByRole("checkbox", { name: "Share my solves" })).not.toBeChecked();
    await page.goto(`/groups/${group.id}`);
    await ready(page);
    await setSolved(page, "Two Sum", true);

    await friend.page.goto(`/groups/${group.id}`);
    // Progress shows; no post does.
    const week = friend.page.getByRole("list", { name: "Week 1 problems" });
    await expect(week.getByRole("listitem").filter({ hasText: "Two Sum" })).toContainText(
      `Solved by ${viewer.name}`,
    );
    await expect(friend.page.getByRole("main").getByRole("article")).toHaveCount(0);
    await friend.context.close();
  });

  test("with sharing on, a solve posts once; undo withdraws it and hiding is for good", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Loud crew", [friend.account.id]);
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));

    await page.goto("/settings");
    await ready(page);
    await page.getByRole("checkbox", { name: "Share my solves" }).check();
    await page.getByRole("button", { name: "Save sharing" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "Your solves will be shared.",
    );

    await page.goto(`/groups/${group.id}`);
    await ready(page);
    await setSolved(page, "Two Sum", true);
    await expect(solvePost(page, "Two Sum")).toBeVisible();

    await friend.page.goto("/home");
    await expect(solvePost(friend.page, "Two Sum")).toContainText(viewer.name);
    await expect(solvePost(friend.page, "Two Sum").getByRole("button")).toHaveCount(0);

    // Undo takes it down; redo brings back the one post, not a second.
    await setSolved(page, "Two Sum", false);
    await friend.page.reload();
    await expect(solvePost(friend.page, "Two Sum")).toHaveCount(0);
    await setSolved(page, "Two Sum", true);
    await friend.page.reload();
    await expect(solvePost(friend.page, "Two Sum")).toHaveCount(1);

    // Hidden by its author, it stays hidden even through another undo and redo.
    await solvePost(page, "Two Sum").getByRole("button", { name: "Hide" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("won't be posted again");
    await dialog.getByRole("button", { name: "Hide post" }).click();
    await expect(solvePost(page, "Two Sum")).toHaveCount(0);
    await setSolved(page, "Two Sum", false);
    await setSolved(page, "Two Sum", true);
    await friend.page.reload();
    await expect(solvePost(friend.page, "Two Sum")).toHaveCount(0);
    await friend.context.close();
  });
});
