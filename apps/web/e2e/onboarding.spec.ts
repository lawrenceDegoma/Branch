import { createHash } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@branch/database";
import {
  createGroupInDb,
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  solveInDb,
  test,
} from "./support/fixtures";

test.describe("getting started on Home", () => {
  test("new members see what to set up, and it goes once done or hidden", async ({
    page,
    viewer,
  }) => {
    const group = await createGroupInDb(viewer.id, "Onboarding crew");
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));
    await page.goto("/home");
    const card = page.getByRole("region", { name: "Get started" });
    await expect(card).toContainText("0 of 3 done");
    await expect(card.getByRole("link", { name: /Get the extension/ })).toHaveAttribute(
      "href",
      "https://chromewebstore.google.com/detail/branch-for-leetcode/e2e",
    );
    await expect(card.getByRole("link", { name: "Connect it" })).toHaveAttribute(
      "href",
      "/settings#extension",
    );
    const results = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);

    // Each step is checked off from what the person has actually done.
    await prisma.profile.update({ where: { userId: viewer.id }, data: { shareSolves: true } });
    await solveInDb(viewer.id, ["two-sum"]);
    await page.reload();
    await expect(card).toContainText("2 of 3 done");
    await expect(
      card.getByRole("listitem").filter({ hasText: "Sync your LeetCode solves" }),
    ).toContainText("(to do)");

    // Hiding it is remembered; focus moves to the feed rather than falling to the page.
    await page.waitForFunction(() => document.readyState === "complete");
    await card.getByRole("button", { name: "Hide the Get started checklist" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Activity" })).toBeFocused();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(card).toHaveCount(0);
  });

  test("it isn't shown once everything's done", async ({ page, viewer }) => {
    await createGroupInDb(viewer.id, "Done crew");
    await prisma.profile.update({ where: { userId: viewer.id }, data: { shareSolves: true } });
    await prisma.extensionConnection.create({
      data: { userId: viewer.id, tokenHash: createHash("sha256").update(viewer.id).digest("hex") },
    });
    await solveInDb(viewer.id, ["two-sum"]);
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Get started" })).toHaveCount(0);
  });
});
