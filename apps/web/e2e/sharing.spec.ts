import { prisma } from "@branch/database";
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
      "Your solves will be shared, without your code.",
    );

    await page.goto(`/groups/${group.id}`);
    await ready(page);
    await setSolved(page, "Two Sum", true);
    await expect(solvePost(page, "Two Sum")).toBeVisible();

    await friend.page.goto("/home");
    await expect(solvePost(friend.page, "Two Sum")).toContainText(viewer.name);
    // Friends can react, but only the author can hide it.
    await expect(
      solvePost(friend.page, "Two Sum").getByRole("button", { name: "Hide" }),
    ).toHaveCount(0);
    await expect(
      solvePost(friend.page, "Two Sum").getByRole("button", { name: "Kudos" }),
    ).toBeVisible();

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

  test("marking the same problem solved from two tabs posts once", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Twin crew", [friend.account.id]);
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));
    await prisma.profile.update({ where: { userId: viewer.id }, data: { shareSolves: true } });

    // Both tabs show Two Sum unsolved; both mark it.
    const second = await page.context().newPage();
    for (const tab of [page, second]) {
      await tab.goto(`/groups/${group.id}`);
      await ready(tab);
    }
    await Promise.all(
      [page, second].map((tab) =>
        tab.getByRole("button", { name: "Solved: Two Sum", exact: true }).first().click(),
      ),
    );
    for (const tab of [page, second]) {
      // Both saves race; once they've settled, each tab shows one solve.
      await tab.waitForLoadState("networkidle");
      await tab.reload();
      const graph = tab.getByRole("list", { name: "Progress by member" });
      await expect(graph.getByRole("listitem").filter({ hasText: "(you)" })).toContainText(
        "1/22 solved",
      );
    }
    await friend.page.goto("/home");
    await expect(solvePost(friend.page, "Two Sum")).toHaveCount(1);
    await friend.context.close();
  });
});

test.describe("code on solve posts", () => {
  test("a synced solve shows its code folded, only while the setting is on", async ({
    page,
    viewer,
    browser,
    baseURL,
    request,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Code crew", [friend.account.id]);
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));

    // Both settings are off until chosen.
    await page.goto("/settings");
    await ready(page);
    const sharing = page.locator("#sharing");
    const attach = sharing.getByRole("checkbox", { name: "Add my code to my solve posts" });
    await expect(attach).not.toBeChecked();
    await sharing.getByRole("checkbox", { name: "Share my solves" }).check();
    await attach.check();
    await sharing.getByRole("button", { name: "Save sharing" }).click();
    await expect(sharing.getByRole("status")).toContainText(
      "Your solves will be shared, with your code folded as a spoiler.",
    );

    await page.locator("#extension").getByRole("button", { name: "Connect a browser" }).click();
    const key = await page.locator("#extension").getByLabel("Extension key").inputValue();
    const response = await request.post("/api/extension/submissions", {
      headers: { authorization: `Bearer ${key}` },
      data: {
        verdict: "ACCEPTED",
        submissionId: "5001",
        problemSlug: "two-sum",
        language: "python3",
        code: "class Solution:\n    def twoSum(self, nums, target):\n        seen = {}",
        submittedAt: Math.floor(Date.now() / 1000),
      },
    });
    expect(response.ok()).toBe(true);

    // The groupmate sees the code only after opening it.
    await friend.page.goto(`/groups/${group.id}`);
    const post = solvePost(friend.page, "Two Sum");
    await expect(post).toContainText("Python 3 code");
    const code = post.locator("pre");
    await expect(code).toBeHidden();
    await post.getByText("Show spoiler code").click();
    await expect(code).toContainText("seen = {}");

    // Turning it off takes the code off the post.
    await attach.uncheck();
    await sharing.getByRole("button", { name: "Save sharing" }).click();
    await expect(sharing.getByRole("status")).toContainText(
      "Your solves will be shared, without your code.",
    );
    await friend.page.reload();
    await expect(post).toBeVisible();
    await expect(post).not.toContainText("Python 3 code");
    await expect(post.locator("pre")).toHaveCount(0);
    await friend.context.close();
  });
});
