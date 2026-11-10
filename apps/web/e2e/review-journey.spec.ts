import { prisma } from "@branch/database";
import { dateInTimeZone, toDbDate } from "@branch/shared/calendar";
import type { Page } from "@playwright/test";
import {
  anotherUser,
  createGroupInDb,
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  test,
} from "./support/fixtures";

// Phase 4's definition of done, end to end: a solve synced with its code gets an estimate shown as
// an estimate, comes back for review, and a struggle turns into suggestions, all private. A
// groupmate sees the solve post (the person shares solves) and nothing else, until the person
// shares the solution themselves.

const PYTHON = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        index = {}
        for i, n in enumerate(nums):
            if target - n in index:
                return [index[target - n], i]
            index[n] = i`;

async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

test("a synced solve is analyzed, reviewed, and turned into suggestions, all in private", async ({
  page,
  viewer,
  browser,
  baseURL,
  request,
}) => {
  const friend = await anotherUser(browser, baseURL!);
  const group = await createGroupInDb(viewer.id, "Review journey", [friend.account.id]);
  await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));
  await prisma.profile.update({ where: { userId: viewer.id }, data: { shareSolves: true } });

  // 1. Connect a browser and sync an accepted Two Sum, twice (the extension retries).
  await page.goto("/settings");
  await ready(page);
  await page.locator("#extension").getByRole("button", { name: "Connect a browser" }).click();
  const key = await page.locator("#extension").getByLabel("Extension key").inputValue();
  const sync = () =>
    request.post("/api/extension/submissions", {
      headers: { authorization: `Bearer ${key}` },
      data: {
        verdict: "ACCEPTED",
        submissionId: "4001",
        problemSlug: "two-sum",
        language: "python3",
        code: PYTHON,
        submittedAt: Math.floor(Date.now() / 1000),
      },
    });
  expect(await (await sync()).json()).toEqual({ stored: "new", counted: true });
  expect(await (await sync()).json()).toEqual({ stored: "duplicate", counted: true });

  // 2. The group sees one solve post, without code or estimate.
  await friend.page.goto(`/groups/${group.id}`);
  const posts = friend.page.getByRole("main").getByRole("article");
  await expect(posts).toHaveCount(1);
  await expect(posts).toContainText("Two Sum");
  await expect(friend.page.getByRole("main")).not.toContainText("index = {}");

  // 3. The estimate arrives in the background, worded as an estimate.
  await page.goto("/solutions");
  const solution = page.getByRole("article", { name: /Two Sum/ });
  await expect(solution).toContainText("Probably O(n) time and O(n) space.", { timeout: 15_000 });
  await expect(solution).toContainText("High confidence, from reading the code.");

  // 4. Three days later it's due. A struggle schedules it sooner and suggests new problems.
  await prisma.reviewSchedule.updateMany({
    where: { userId: viewer.id },
    data: { dueOn: toDbDate(dateInTimeZone(new Date(), "UTC")) },
  });
  await page.goto("/review");
  await ready(page);
  const card = page.getByRole("article", { name: /Two Sum/ });
  await expect(card).toContainText("Your last solution: probably O(n) time and O(n) space.");
  await card.getByRole("button", { name: /^Struggled/ }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Two Sum comes back in");
  await expect(page.getByRole("list", { name: "Your topics" })).toContainText(
    "Arrays & HashingNeeds practice",
  );
  const suggestions = page
    .getByRole("article", { name: "Arrays & Hashing" })
    .getByRole("list", { name: "Suggested Arrays & Hashing problems" });
  await expect(suggestions.getByRole("listitem").first()).toBeVisible();
  await expect(suggestions).not.toContainText("Two Sum");

  // 5. None of it reaches the groupmate: not their review, solutions, or the group's pages.
  await friend.page.goto("/review");
  await expect(friend.page.getByText("Nothing to review yet")).toBeVisible();
  await friend.page.goto("/solutions");
  await expect(friend.page.getByRole("main")).not.toContainText("Two Sum");
  await friend.page.goto(`/groups/${group.id}`);
  const groupPage = friend.page.getByRole("main");
  await expect(posts).toHaveCount(1);
  for (const privateText of ["Needs practice", "Struggled", "O(n)", "index = {}"]) {
    await expect(groupPage).not.toContainText(privateText);
  }

  // 6. Sharing is the person's own choice, solution by solution.
  await page.goto("/solutions");
  await ready(page);
  await solution.getByRole("button", { name: "Share Two Sum to a group" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByLabel("Include my code").check();
  await dialog.getByRole("button", { name: "Share", exact: true }).click();
  await expect(solution.getByRole("status")).toContainText("Shared to Review journey.");
  await friend.page.reload();
  const shared = posts.filter({ hasText: "Shared my solution to Two Sum" });
  await expect(shared).toContainText("probably O(n) time and O(n) space");
  await expect(shared.getByText("Show spoiler code")).toBeVisible();

  await friend.context.close();
});
