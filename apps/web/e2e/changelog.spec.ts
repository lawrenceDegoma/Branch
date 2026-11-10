import { prisma } from "@branch/database";
import { createGroupInDb, expect, test } from "./support/fixtures";

// Home's "What's new" card after an update, and the public pages behind it.

test.describe("what's new", () => {
  test("someone here before an update sees it on Home, reads more, and dismisses it", async ({
    page,
    viewer,
    isMobile,
  }) => {
    await createGroupInDb(viewer.id, "News crew");
    // Joined before every update so far.
    await prisma.user.update({
      where: { id: viewer.id },
      data: { createdAt: new Date("2026-11-01T12:00:00Z") },
    });
    await page.goto("/home");
    const card = page.getByRole("region", { name: "What's new" });
    await expect(card).toContainText("What's new");
    await expect(card.getByRole("link", { name: /^And \d+ more updates$/ })).toBeVisible();

    // The newest entry, in full.
    const title = await card.locator("p.font-medium").innerText();
    await card.getByRole("link", { name: `Read more about ${title}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await page.getByRole("link", { name: "All updates" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "What's new" })).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Updates" }).getByRole("listitem").last(),
    ).toContainText("Branch launches");

    // Dismissed, it's gone for good (until the next update), and focus lands on the feed.
    await page.goto("/home");
    await page.waitForFunction(() => document.readyState === "complete");
    const dismiss = card.getByRole("button", { name: "Dismiss what's new" });
    if (isMobile) {
      await dismiss.click();
    } else {
      await dismiss.focus();
      await page.keyboard.press("Enter");
    }
    await expect(card).toHaveCount(0);
    if (!isMobile) await expect(page.locator("#activity-heading")).toBeFocused();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(card).toHaveCount(0);
  });

  test("someone who joins after an update isn't told about it", async ({ page, viewer }) => {
    await createGroupInDb(viewer.id, "New crew");
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.getByRole("region", { name: "What's new" })).toHaveCount(0);
    // It's still a link away, from Settings.
    await page.goto("/settings");
    await page.getByRole("link", { name: "What's new" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "What's new" })).toBeVisible();
  });

  test("the pages are public", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("link", { name: "What's new" }).click();
    await expect(page).toHaveURL(/\/changelog$/);
    await page.getByRole("link", { name: "Branch launches" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Branch launches" })).toBeVisible();
    expect((await page.goto("/changelog/2000-01-01-not-an-update"))?.status()).toBe(404);
    await context.close();
  });
});
