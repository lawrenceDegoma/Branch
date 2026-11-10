import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@branch/database";
import type { Page } from "@playwright/test";
import { anotherUser, createGroupInDb, expect, test } from "./support/fixtures";

// Home's study timer: start, stop, and share a session only as the person chooses.

async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

/** As if the running session started `minutes` ago (a session under a minute isn't kept). */
async function backdate(userId: string, minutes: number) {
  await prisma.studySession.updateMany({
    where: { userId, endedAt: null },
    data: { startedAt: new Date(Date.now() - minutes * 60_000) },
  });
}

const timer = (page: Page) =>
  page.getByRole("complementary", { name: "Weekly summary" }).getByRole("button").first();
const elapsed = (page: Page) => page.locator("[data-elapsed]");
const status = (page: Page) =>
  page.getByRole("complementary", { name: "Weekly summary" }).getByRole("status");

test.describe("study timer", () => {
  test("a session runs across reloads, and is shared only to the group chosen", async ({
    page,
    viewer,
    browser,
    baseURL,
    isMobile,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Study crew", [friend.account.id]);
    await page.goto("/home");
    await ready(page);

    await expect(timer(page)).toHaveText("Start studying");
    await timer(page).click();
    await expect(status(page)).toHaveText("Timer started.");
    await expect(timer(page)).toHaveText("Stop studying");
    await expect(elapsed(page)).toHaveText(/^0:0\d$/);

    // Still running after a reload.
    await backdate(viewer.id, 45);
    await page.reload();
    await ready(page);
    await expect(elapsed(page)).toHaveText(/^45:\d\d$/);

    if (isMobile) await timer(page).click();
    else {
      await timer(page).focus();
      await page.keyboard.press("Enter");
    }
    const dialog = page.getByRole("alertdialog", { name: "Share this session?" });
    await expect(dialog).toContainText("You studied for 45 min.");
    await expect(dialog.getByLabel("Group")).toHaveValue(group.id);
    await dialog.getByLabel("Note (optional)").fill("Two pointers today");
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(status(page)).toContainText("Shared.");
    await expect(timer(page)).toHaveText("Start studying");
    if (!isMobile) await expect(timer(page)).toBeFocused();

    await friend.page.goto(`/groups/${group.id}`);
    const post = friend.page
      .getByRole("main")
      .getByRole("article")
      .filter({ hasText: "Studied for" });
    await expect(post).toContainText("Studied for 45 min");
    await expect(post).toContainText("Two pointers today");
    await expect(post.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await friend.context.close();
  });

  test("remembering the decision shares later sessions, until Settings says ask", async ({
    page,
    viewer,
  }) => {
    const group = await createGroupInDb(viewer.id, "Habit crew");
    const session = async () => {
      await page.goto("/home");
      await ready(page);
      await timer(page).click();
      await expect(timer(page)).toHaveText("Stop studying");
      await backdate(viewer.id, 30);
      await page.reload();
      await ready(page);
      await timer(page).click();
    };

    await session();
    const dialog = page.getByRole("alertdialog", { name: "Share this session?" });
    await dialog.getByRole("checkbox", { name: "Remember my decision" }).check();
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    await expect(status(page)).toContainText("Shared. Later sessions will be too.");

    // The next one is shared without asking.
    await session();
    await expect(status(page)).toHaveText("Saved 30 min and shared it to Habit crew.");
    await expect(dialog).toHaveCount(0);
    expect(await prisma.post.count({ where: { authorId: viewer.id, kind: "STUDY" } })).toBe(2);

    // Settings shows the choice, and can go back to asking.
    await page.goto("/settings");
    await ready(page);
    const choice = page.getByLabel("After a study session");
    await expect(choice).toHaveValue(`GROUP:${group.id}`);
    await choice.selectOption({ label: "Ask each time" });
    await page.getByRole("button", { name: "Save study sharing" }).click();
    await expect(page.locator("#sharing").getByRole("status").last()).toHaveText("Saved.");
    await session();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Don't share" }).click();
    await expect(status(page)).toHaveText("Not shared.");
  });

  test("a timer left running stops at 4 hours and asks before sharing", async ({
    page,
    viewer,
  }) => {
    const group = await createGroupInDb(viewer.id, "Forgetful crew");
    await prisma.profile.update({
      where: { userId: viewer.id },
      data: { studySharing: "GROUP", studyShareGroupId: group.id },
    });
    await prisma.studySession.create({
      data: { userId: viewer.id, startedAt: new Date(Date.now() - 6 * 60 * 60_000) },
    });
    await page.goto("/home");
    await ready(page);
    const summary = page.getByRole("complementary", { name: "Weekly summary" });
    await expect(summary).toContainText("You left the study timer running.");
    await summary.getByRole("button", { name: "Save 4 h" }).click();
    // Asked, even though later sessions are remembered to go to the group.
    const dialog = page.getByRole("alertdialog", { name: "Share this session?" });
    await expect(dialog).toContainText("You studied for 4 h.");
    await dialog.getByRole("button", { name: "Don't share" }).click();
    await expect(status(page)).toHaveText("Not shared.");
    await expect(timer(page)).toHaveText("Start studying");
    expect(await prisma.post.count({ where: { authorId: viewer.id, kind: "STUDY" } })).toBe(0);
  });

  test("a start and stop by mistake leaves nothing", async ({ page, viewer }) => {
    await createGroupInDb(viewer.id, "Oops crew");
    await page.goto("/home");
    await ready(page);
    await timer(page).click();
    await expect(timer(page)).toHaveText("Stop studying");
    await timer(page).click();
    await expect(status(page)).toHaveText("Under a minute, so it wasn't saved.");
    expect(await prisma.studySession.count({ where: { userId: viewer.id } })).toBe(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the timer and its dialog have no detectable WCAG A/AA violations (${colorScheme})`, async ({
      page,
      viewer,
    }) => {
      await page.emulateMedia({ colorScheme });
      await createGroupInDb(viewer.id, "Axe crew");
      const scan = async () => {
        await page.waitForFunction(() => document.getAnimations().length === 0);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(results.violations).toEqual([]);
      };
      await page.goto("/home");
      await ready(page);
      await scan();
      await timer(page).click();
      await expect(timer(page)).toHaveText("Stop studying");
      await scan();
      await backdate(viewer.id, 20);
      await page.reload();
      await ready(page);
      await timer(page).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await scan();
    });
  }
});
