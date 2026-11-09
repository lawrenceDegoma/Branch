import { createHash } from "node:crypto";
import { prisma } from "@branch/database";
import type { Page } from "@playwright/test";
import { anotherUser, createGroupInDb, expect, solveInDb, test } from "./support/fixtures";

// Pasting a solution and reading its estimate, against the real analyzer (services/analyzer),
// which playwright.config.ts starts alongside the app.

const PYTHON = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
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
    await page.goto("/home");
    // (Next's dev badge can cover the last item of the mobile bar, so follow the link's address.)
    const tab = page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Solutions" });
    await expect(tab).toHaveAttribute("href", "/solutions");
    await page.goto("/solutions");
    await expect(page.getByRole("heading", { level: 1, name: "Your solutions" })).toBeVisible();
    await page.waitForFunction(() => document.readyState === "complete");

    await paste(page, "Two Sum", "Python 3", PYTHON);
    const card = page.getByRole("article", { name: /Two Sum/ });
    await expect(card).toContainText("Pasted · Python 3");
    // It's analyzed in the background; the page looks again by itself.
    await expect(card).toContainText("Probably O(n) time and O(n) space.", { timeout: 15_000 });
    await expect(card).toContainText("High confidence, from reading the code.");
    await expect(card).toContainText("Where n is the length of nums.");
    await card.getByText("Why, and what it can't tell").click();
    await expect(card.getByRole("list", { name: "Reasons" })).toContainText("The loop on line 4");
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

  test("an estimate from an older analyzer version is redone when the page opens", async ({
    page,
    viewer,
  }) => {
    await solveInDb(viewer.id, ["two-sum"]);
    const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
    const solution = await prisma.submission.create({
      data: {
        userId: viewer.id,
        source: "PASTED",
        problemSlug: "two-sum",
        problemId: twoSum.id,
        language: "python3",
        code: PYTHON,
        submittedAt: new Date(),
      },
    });
    // What an older version said, before its rules were fixed.
    const old = await prisma.analysisResult.create({
      data: {
        // Unique per test run, so the desktop and mobile copies of this test don't collide.
        codeHash: createHash("sha256").update(viewer.id).digest("hex"),
        language: "python3",
        problemSlug: "two-sum",
        analyzerVersion: "2000.1.1",
        outcome: "OK",
        time: "O(n²)",
        space: "O(n)",
        confidence: "HIGH",
        reasons: ["An outdated reason."],
      },
    });
    await prisma.analysisJob.create({
      data: {
        submissionId: solution.id,
        userId: viewer.id,
        status: "DONE",
        resultId: old.id,
        finishedAt: new Date(),
      },
    });
    await page.goto("/solutions");
    const card = page.getByRole("article", { name: /Two Sum/ });
    await expect(card).toContainText("Probably O(n) time and O(n) space.", { timeout: 15_000 });
    await expect(card).not.toContainText("O(n²)");
  });

  test("a solution is shared only when its owner chooses, to the group they choose", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Share crew", [friend.account.id]);
    await solveInDb(viewer.id, ["two-sum"]);
    await page.goto("/solutions");
    await page.waitForFunction(() => document.readyState === "complete");
    await paste(page, "Two Sum", "Python 3", PYTHON);
    const card = page.getByRole("article", { name: /Two Sum/ });
    await expect(card).toContainText("Probably O(n) time", { timeout: 15_000 });

    // Nothing reaches the group until it's shared.
    await friend.page.goto(`/groups/${group.id}`);
    await expect(friend.page.getByText("Shared my solution")).toHaveCount(0);

    await card.getByRole("button", { name: "Share Two Sum to a group" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByLabel("Group")).toHaveValue(group.id);
    await dialog.getByLabel("Note (optional)").fill("Went with a hash map.");
    await dialog.getByLabel("Include my code").check();
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(card.getByRole("status")).toContainText("Shared to Share crew.");
    await expect(card.getByRole("button", { name: "Share Two Sum to a group" })).toBeFocused();

    await friend.page.reload();
    const post = friend.page
      .getByRole("article")
      .filter({ hasText: "Shared my solution to Two Sum" });
    await expect(post).toContainText("Went with a hash map.");
    await expect(post).toContainText("probably O(n) time and O(n) space");
    // The code is folded as a spoiler until the reader opens it.
    await expect(post.getByText("Show spoiler code")).toBeVisible();
    await friend.context.close();
  });

  test("turning analysis off stops it and deletes estimates", async ({ page, viewer }) => {
    await solveInDb(viewer.id, ["two-sum"]);
    await page.goto("/solutions");
    await page.waitForFunction(() => document.readyState === "complete");
    await paste(page, "Two Sum", "Python 3", PYTHON);
    const card = page.getByRole("article", { name: /Two Sum/ });
    await expect(card).toContainText("Probably O(n) time", { timeout: 15_000 });

    // On a due review of the same problem, the latest estimate shows.
    await page.goto("/review");
    await expect(page.getByRole("article", { name: /Two Sum/ })).toContainText(
      "Your last solution: probably O(n) time and O(n) space.",
    );

    await page.goto("/settings");
    await page.waitForFunction(() => document.readyState === "complete");
    const section = page.locator("#analysis");
    await section.getByLabel("Analyze my solutions").uncheck();
    await section.getByRole("button", { name: "Save analysis" }).click();
    await expect(section.getByRole("status")).toContainText("Analysis is off");
    await page.goto("/solutions");
    await expect(page.getByText("Code analysis is off")).toBeVisible();
    await expect(card).not.toContainText("Probably");
    expect(await prisma.analysisJob.count({ where: { userId: viewer.id } })).toBe(0);
  });

  test("only solved problems can be pasted", async ({ page, viewer }) => {
    await page.goto("/solutions");
    await page.locator("summary", { hasText: "Paste a solution" }).click();
    await expect(
      page.getByText("Mark a problem solved first, then paste your solution for it here."),
    ).toBeVisible();
    expect(viewer.id).toBeTruthy();
  });
});
