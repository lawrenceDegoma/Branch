import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@branch/database";
import type { Page } from "@playwright/test";
import { anotherUser, createGroupInDb, expect, test } from "./support/fixtures";

// The private stats page: what someone has done, over time, counted in their time zone.

const DAY = 24 * 60 * 60 * 1000;

/** A few weeks of history for the viewer (test accounts use UTC). */
async function history(userId: string) {
  const problems = await prisma.problem.findMany({
    where: { leetcodeSlug: { in: ["two-sum", "valid-anagram", "contains-duplicate"] } },
  });
  const slug = (s: string) => problems.find((p) => p.leetcodeSlug === s)!.id;
  const now = Date.now();
  // An hour this week (UTC, the test accounts' time zone), whatever day the test runs.
  const today = new Date(now);
  const monday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() - ((today.getUTCDay() + 6) % 7),
  );
  const thisWeek = Math.max(monday, now - 2 * 60 * 60_000);
  await prisma.problemCompletion.createMany({
    data: [
      { userId, problemId: slug("two-sum"), source: "MANUAL", completedAt: new Date(now) },
      {
        userId,
        problemId: slug("valid-anagram"),
        source: "MANUAL",
        completedAt: new Date(now - 14 * DAY),
      },
      {
        userId,
        problemId: slug("contains-duplicate"),
        source: "EXTENSION",
        completedAt: new Date(now - 21 * DAY),
      },
    ],
  });
  await prisma.reviewAttempt.createMany({
    data: [
      {
        userId,
        problemId: slug("valid-anagram"),
        outcome: "HARD",
        reviewedAt: new Date(now - DAY),
        intervalDays: 2,
      },
      {
        userId,
        problemId: slug("contains-duplicate"),
        outcome: "GOOD",
        reviewedAt: new Date(now - 2 * DAY),
        intervalDays: 6,
      },
    ],
  });
  await prisma.studySession.createMany({
    data: [
      { userId, startedAt: new Date(thisWeek), endedAt: new Date(thisWeek + 60 * 60_000) },
      {
        userId,
        startedAt: new Date(now - 9 * DAY),
        endedAt: new Date(now - 9 * DAY + 4 * 60 * 60_000),
        autoStopped: true,
      },
    ],
  });
  await prisma.submission.create({
    data: {
      userId,
      source: "LEETCODE",
      externalId: "77",
      problemSlug: "contains-duplicate",
      problemId: slug("contains-duplicate"),
      language: "python3",
      code: "pass",
      submittedAt: new Date(now - 21 * DAY),
      timeSpentSeconds: 14 * 60,
    },
  });
}

async function noViolations(page: Page) {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe("your stats", () => {
  test("shows solving, time, topics, reviews, and sessions, and a session can be deleted", async ({
    page,
    viewer,
    isMobile,
  }) => {
    await createGroupInDb(viewer.id, "Stats crew");
    await history(viewer.id);

    await page.goto("/home");
    await page.getByRole("link", { name: "Your stats" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your stats" })).toBeVisible();

    const solving = page.getByRole("region", { name: "Solving" });
    await expect(solving.getByText("Solved in total").locator("..")).toContainText("3");
    await expect(solving.getByRole("img")).toHaveAccessibleName(
      "Problems solved each week for the last 12 weeks: 3 in all, 1 this week.",
    );
    // Every number is in the table too.
    await solving.getByText("Show as a table").click();
    await expect(solving.getByRole("table")).toContainText("Problems solved");
    await expect(solving.getByRole("table").getByRole("row")).toHaveCount(13);

    const time = page.getByRole("region", { name: "Time" });
    await expect(time.getByRole("img")).toHaveAccessibleName(/5 h in all, 1 h this week\.$/);
    await expect(time).toContainText("Easyabout 14 min (the middle of 1 timed solve)");

    await expect(page.getByRole("list", { name: "Your topics" })).toContainText("Arrays & Hashing");
    await expect(page.getByRole("list", { name: "How your reviews went" })).toContainText(
      "Struggled1",
    );

    const sessions = page.getByRole("list", { name: "Your latest study sessions" });
    await expect(sessions.getByRole("listitem")).toHaveCount(2);
    await expect(sessions).toContainText("stopped automatically");
    await noViolations(page);

    await page.waitForFunction(() => document.readyState === "complete");
    const remove = sessions.getByRole("button", { name: /^Delete the session from/ }).first();
    if (isMobile) await remove.click();
    else {
      await remove.focus();
      await page.keyboard.press("Enter");
    }
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete session" }).click();
    await expect(sessions.getByRole("listitem")).toHaveCount(1);
    if (!isMobile) await expect(page.locator("#sessions-heading")).toBeFocused();
    expect(await prisma.studySession.count({ where: { userId: viewer.id } })).toBe(1);
  });

  test("is reachable from Review, and starts empty", async ({ page, viewer: _viewer }) => {
    await page.goto("/review");
    await page.getByRole("link", { name: "Your stats" }).click();
    await expect(
      page.getByRole("region", { name: "Solving" }).getByRole("img"),
    ).toHaveAccessibleName(
      "Problems solved each week for the last 12 weeks: 0 in all, 0 this week.",
    );
    await expect(page.getByText("Topics show up once you've solved a problem.")).toBeVisible();
    await expect(
      page.getByText("Sessions you time with the study timer on Home show up here."),
    ).toBeVisible();
  });

  test("is private: another person sees only their own", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    await history(viewer.id);
    const { context, page: other } = await anotherUser(browser, baseURL!, "other");
    await other.goto("/stats");
    await expect(
      other.getByRole("region", { name: "Solving" }).getByText("Solved in total").locator(".."),
    ).toContainText("0");
    await expect(other.getByRole("list", { name: "Your latest study sessions" })).toHaveCount(0);
    await context.close();
    await page.goto("/stats");
    await expect(page.getByRole("list", { name: "Your latest study sessions" })).toBeVisible();
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`with data, has no detectable WCAG A/AA violations (${colorScheme})`, async ({
      page,
      viewer,
    }) => {
      await page.emulateMedia({ colorScheme });
      await history(viewer.id);
      await page.goto("/stats");
      await page.getByRole("region", { name: "Time" }).getByText("Show as a table").click();
      await noViolations(page);
    });
  }

  test("with data, fits 320px and survives text spacing", async ({ page, viewer }) => {
    await history(viewer.id);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/stats");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.addStyleTag({
      content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`,
    });
    const clipped = await page
      .getByRole("main")
      .locator("section *")
      .evaluateAll(
        (items) =>
          items.filter(
            (item) =>
              getComputedStyle(item).overflowY !== "visible" &&
              !item.classList.contains("sr-only") &&
              item.scrollHeight > item.clientHeight + 1,
          ).length,
      );
    expect(clipped).toBe(0);
  });
});
