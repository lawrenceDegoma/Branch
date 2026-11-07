import type { Page } from "@playwright/test";
import { anotherUser, createGroupInDb, expect, solveInDb, test } from "./support/fixtures";

/** Waits for hydration, so clicks reach the client component. */
async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

test.describe("review", () => {
  test("a solved problem comes back, and rating it schedules the next review", async ({
    page,
    viewer,
  }) => {
    await page.goto("/review");
    await expect(page.getByText("Nothing to review yet")).toBeVisible();

    // Solving puts it in the queue a few days out.
    await page.goto("/roadmaps");
    await page.getByRole("link", { name: /^Patterns 150/ }).click();
    await ready(page);
    const twoSum = page.getByRole("button", { name: "Solved: Two Sum", exact: true });
    await twoSum.click();
    await expect(twoSum).toHaveAttribute("aria-pressed", "true");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(twoSum).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Review" })
      .click();
    const upcoming = page.getByRole("region", { name: "Coming up" });
    await expect(upcoming).toContainText("Two Sum");
    await expect(page.getByText("Nothing due")).toBeVisible();

    // Two more are due today; Home's weekly summary (shown once you're in a group) counts them.
    await createGroupInDb(viewer.id, "Review crew");
    await solveInDb(viewer.id, ["valid-anagram", "contains-duplicate"]);
    await page.goto("/home");
    await expect(page.getByRole("complementary", { name: "Weekly summary" })).toContainText(
      "Reviews due2",
    );
    await page.getByRole("link", { name: "See reviews" }).click();
    await expect(page.getByRole("heading", { name: "Due today 2" })).toBeVisible();
    await ready(page);

    // Rating by keyboard: the card goes, focus lands on the heading, and the result is announced.
    const card = page.getByRole("article", { name: /Valid Anagram/ });
    await card.getByRole("button", { name: "Struggled back in 4 days" }).focus();
    await page.keyboard.press("Enter");
    const status = page.getByRole("main").getByRole("status");
    await expect(status).toContainText("Valid Anagram comes back in 4 days");
    await expect(card).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Due today 1" })).toBeFocused();
    await expect(upcoming).toContainText("Valid Anagram");
    await expect(
      page
        .getByRole("list", { name: "Past reviews" })
        .getByRole("listitem")
        .filter({ hasText: "Valid Anagram" }),
    ).toContainText("Struggled");

    await page
      .getByRole("article", { name: /Contains Duplicate/ })
      .getByRole("button", { name: /^Couldn't solve/ })
      .click();
    await expect(status).toContainText("Contains Duplicate comes back tomorrow");
    await expect(page.getByText("Nothing due")).toBeVisible();

    // A problem marked unsolved leaves the queue; its past reviews stay in the history.
    await page.goto("/roadmaps");
    await page.getByRole("link", { name: /^Patterns 150/ }).click();
    await ready(page);
    const anagram = page.getByRole("button", { name: "Solved: Valid Anagram", exact: true });
    await anagram.click();
    await expect(anagram).toHaveAttribute("aria-pressed", "false");
    // The check flips at once; wait for the save, then reload to know it was saved.
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(anagram).toHaveAttribute("aria-pressed", "false");
    await page.goto("/review");
    await expect(upcoming).not.toContainText("Valid Anagram");
    await expect(page.getByRole("list", { name: "Past reviews" })).toContainText("Valid Anagram");
  });

  test("struggling in a topic suggests new problems in it", async ({ page, viewer }) => {
    await solveInDb(viewer.id, ["contains-duplicate", "valid-anagram"]);
    await page.goto("/review");
    await expect(page.getByText("Suggestions come from your reviews")).toBeVisible();
    await ready(page);
    const status = page.getByRole("main").getByRole("status");
    for (const title of ["Contains Duplicate", "Valid Anagram"]) {
      await page
        .getByRole("article", { name: new RegExp(title) })
        .getByRole("button", { name: /^Couldn't solve/ })
        .click();
      await expect(status).toContainText(`${title} comes back tomorrow`);
    }

    const topic = page.getByRole("article", { name: "Arrays & Hashing" });
    await expect(topic).toContainText(
      "You struggled on both of your last 2 Arrays & Hashing reviews.",
    );
    const suggestions = topic.getByRole("list", { name: "Suggested Arrays & Hashing problems" });
    await expect(suggestions.getByRole("listitem").first()).toContainText("Two Sum");
    await expect(page.getByRole("list", { name: "Your topics" })).toContainText(
      "Arrays & HashingNeeds practice",
    );

    // Solving a suggestion counts like any solve, and it stays in place, checked, for now.
    const toggle = suggestions.getByRole("button", { name: "Solved: Two Sum", exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "Coming up" })).toContainText("Two Sum");
  });

  test("reviews are private", async ({ page, viewer, browser, baseURL }) => {
    await solveInDb(viewer.id, ["two-sum"]);
    const friend = await anotherUser(browser, baseURL!);
    await friend.page.goto("/review");
    await expect(friend.page.getByText("Nothing to review yet")).toBeVisible();
    await expect(friend.page.getByText("Two Sum")).toHaveCount(0);
    await page.goto("/review");
    await expect(page.getByRole("article", { name: /Two Sum/ })).toBeVisible();
    await friend.context.close();
  });
});
