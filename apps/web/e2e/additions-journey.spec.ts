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

// The additions of M23–M26, end to end: a person studies and shares the session, syncs a solve
// (with its code on the post, by their choice, and the time the extension measured), and reads
// their stats. Their groupmate sees the session and the folded code, and nothing private: not
// the time spent, the stats, or anything not shared. The extension's own timer is covered with
// the real extension in e2e/extension-browser.spec.ts; here its request is sent directly.

const CODE = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i`;

async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

test("study, solve, share by choice, and read your own stats", async ({
  page,
  viewer,
  browser,
  baseURL,
  request,
}) => {
  const friend = await anotherUser(browser, baseURL!);
  const group = await createGroupInDb(viewer.id, "Additions crew", [friend.account.id]);
  await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));

  // 1. Settings: share solves, with code.
  await page.goto("/settings");
  await ready(page);
  const sharing = page.locator("#sharing");
  await sharing.getByRole("checkbox", { name: "Share my solves" }).check();
  await sharing.getByRole("checkbox", { name: "Add my code to my solve posts" }).check();
  await sharing.getByRole("button", { name: "Save sharing" }).click();
  await expect(sharing.getByRole("status").first()).toContainText("with your code folded");

  // 2. A study session, shared with a note.
  await page.goto("/home");
  await ready(page);
  const summary = page.getByRole("complementary", { name: "Weekly summary" });
  await summary.getByRole("button", { name: "Start studying" }).click();
  await expect(summary.getByRole("button", { name: "Stop studying" })).toBeVisible();
  await prisma.studySession.updateMany({
    where: { userId: viewer.id, endedAt: null },
    data: { startedAt: new Date(Date.now() - 50 * 60_000) },
  });
  await page.reload();
  await ready(page);
  await summary.getByRole("button", { name: "Stop studying" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Share this session?" });
  await dialog.getByLabel("Note (optional)").fill("Hash maps all evening");
  await dialog.getByRole("button", { name: "Share", exact: true }).click();
  await expect(summary.getByRole("status")).toContainText("Shared.");

  // 3. The extension syncs Two Sum, with the time its timer measured.
  await page.goto("/settings");
  await ready(page);
  await page.locator("#extension").getByRole("button", { name: "Connect a browser" }).click();
  const key = await page.locator("#extension").getByLabel("Extension key").inputValue();
  const synced = await request.post("/api/extension/submissions", {
    headers: { authorization: `Bearer ${key}` },
    data: {
      verdict: "ACCEPTED",
      submissionId: "9001",
      problemSlug: "two-sum",
      language: "python3",
      code: CODE,
      submittedAt: Math.floor(Date.now() / 1000),
      timeSpentSeconds: 25 * 60,
    },
  });
  expect(await synced.json()).toEqual({ stored: "new", counted: true });

  // 4. The groupmate: the session and the solve, the code folded, and no time spent.
  await friend.page.goto(`/groups/${group.id}`);
  const posts = friend.page.getByRole("main").getByRole("article");
  const studied = posts.filter({ hasText: "Studied for" });
  await expect(studied).toContainText("Studied for 50 min");
  await expect(studied).toContainText("Hash maps all evening");
  const solved = posts.filter({ hasText: "SolvedTwo Sum" });
  await expect(solved).toContainText("Python 3 code");
  await expect(solved.locator("pre")).toBeHidden();
  await solved.getByText("Show spoiler code").click();
  await expect(solved.locator("pre")).toContainText("seen[n] = i");
  const groupPage = friend.page.getByRole("main");
  for (const privateText of ["25 min", "on it", "Your stats"]) {
    await expect(groupPage).not.toContainText(privateText);
  }

  // 5. The person's own view: the time on the solution, and their stats.
  await page.goto("/solutions");
  await expect(page.getByRole("article", { name: /Two Sum/ })).toContainText("about 25 min on it");
  await page.goto("/home");
  await page.getByRole("link", { name: "Your stats" }).click();
  await expect(page.getByRole("region", { name: "Solving" }).getByRole("img")).toHaveAccessibleName(
    /1 in all, 1 this week\.$/,
  );
  const time = page.getByRole("region", { name: "Time" });
  await expect(time.getByRole("img")).toHaveAccessibleName(/: 50 min in all, /);
  await expect(time).toContainText("about 25 min (the middle of 1 timed solve)");
  await expect(page.getByRole("list", { name: "Your latest study sessions" })).toContainText(
    "shared to 1 group",
  );

  // 6. The groupmate's stats are their own.
  await friend.page.goto("/stats");
  await expect(
    friend.page.getByRole("region", { name: "Solving" }).getByRole("img"),
  ).toHaveAccessibleName(/0 in all, 0 this week\.$/);
  await expect(friend.page.getByRole("list", { name: "Your latest study sessions" })).toHaveCount(
    0,
  );
  await friend.context.close();
});
