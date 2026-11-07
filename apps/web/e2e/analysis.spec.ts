import type { Page } from "@playwright/test";
import { expect, solveInDb, test } from "./support/fixtures";

// Pasting a solution and reading its estimate, against the real analyzer (services/analyzer),
// which playwright.config.ts starts alongside the app.

const PYTHON = `class Solution:
    def twoSum(self, nums, target):
        index = {}
        for i, n in enumerate(nums):
            if target - n in index:
                return [index[target - n], i]
            index[n] = i`;

async function paste(page: Page, problem: string, language: string, code: string) {
  const panel = page.locator("details", { hasText: "Paste a solution" });
  if (!(await panel.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await panel.locator("summary").click();
  }
  await panel.getByRole("combobox", { name: "Problem" }).fill(problem.slice(0, 5));
  await page.getByRole("option", { name: problem }).click();
  await panel.getByLabel("Language").selectOption({ label: language });
  await panel.getByLabel("Your solution").fill(code);
  await panel.getByRole("button", { name: "Save solution" }).click();
  await expect(panel.getByRole("status")).toContainText("Solution saved.");
}

test.describe("code analysis", () => {
  test("a pasted solution gets an estimate, shown as an estimate", async ({ page, viewer }) => {
    await solveInDb(viewer.id, ["two-sum", "valid-anagram"]);
    await page.goto("/settings");
    await page.getByRole("link", { name: "Your solutions" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your solutions" })).toBeVisible();
    await page.waitForFunction(() => document.readyState === "complete");

    await paste(page, "Two Sum", "Python 3", PYTHON);
    const card = page.getByRole("article", { name: /Two Sum/ });
    await expect(card).toContainText("Pasted · Python 3");
    // It's analyzed in the background; the page looks again by itself.
    await expect(card).toContainText("Probably O(n) time and O(n) space.", { timeout: 15_000 });
    await expect(card).toContainText("High confidence, from reading the code.");
    await card.getByText("Why, and what it can't tell").click();
    await expect(card.getByRole("list", { name: "Reasons" })).toContainText(
      "A loop goes over the input once.",
    );
    await expect(card.getByRole("list", { name: "Limits" })).toContainText(
      "Estimated by reading the code, without running it.",
    );

    // Other languages are kept but not analyzed yet.
    await paste(
      page,
      "Valid Anagram",
      "Java",
      "class Solution { boolean isAnagram() { return true; } }",
    );
    await expect(page.getByRole("article", { name: /Valid Anagram/ })).toContainText(
      "Not analyzed: only Python solutions are analyzed so far.",
    );
  });

  test("only solved problems can be pasted", async ({ page, viewer }) => {
    await page.goto("/settings/submissions");
    await page.locator("summary", { hasText: "Paste a solution" }).click();
    await expect(
      page.getByText("Mark a problem solved first, then paste your solution for it here."),
    ).toBeVisible();
    expect(viewer.id).toBeTruthy();
  });
});
