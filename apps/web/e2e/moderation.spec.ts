import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@branch/database";
import type { Page } from "@playwright/test";
import { anotherUser, createGroupInDb, expect, test } from "./support/fixtures";

// Reporting to the group's admin, and blocking (owner decisions, 2026-11-09).

async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

async function noViolations(page: Page) {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

const postBy = (page: Page, name: string) => page.getByRole("main").getByRole("article", { name });

/** Opens a post's "More actions" menu, by keyboard on desktop. */
async function openMenu(page: Page, name: string, isMobile: boolean) {
  const trigger = page.getByRole("button", { name: `More actions for ${name}'s post` });
  if (isMobile) await trigger.click();
  else {
    await trigger.focus();
    await page.keyboard.press("Enter");
  }
  return trigger;
}

test.describe("moderation", () => {
  test("a member reports a post, the admin removes it", async ({
    page,
    viewer,
    browser,
    baseURL,
    isMobile,
  }) => {
    const admin = await anotherUser(browser, baseURL!, "admin");
    const author = await anotherUser(browser, baseURL!, "author");
    const group = await createGroupInDb(admin.account.id, "Mod crew", [
      viewer.id,
      author.account.id,
    ]);
    await prisma.post.create({
      data: { groupId: group.id, authorId: author.account.id, body: "Buy cheap followers here" },
    });

    await page.goto(`/groups/${group.id}`);
    await ready(page);
    const name = author.account.name;
    const trigger = await openMenu(page, name, isMobile);
    await page.getByRole("menuitem", { name: "Report post…" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Report this post?" });
    await expect(dialog).toContainText("Nobody sees that it was you.");
    await noViolations(page);
    await dialog.getByRole("radio", { name: "Spam" }).check();
    await dialog.getByLabel("Anything to add? (optional)").fill("Not about coding");
    await dialog.getByRole("button", { name: "Report", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(postBy(page, name).getByRole("status")).toContainText("Reported.");
    if (!isMobile) await expect(trigger).toBeFocused();

    // The admin sees it, without the reporter, and removes it.
    await admin.page.goto(`/groups/${group.id}`);
    await admin.page.getByRole("link", { name: "1 open report" }).click();
    const reports = admin.page.getByRole("list", { name: "Open reports" });
    await expect(reports).toContainText(`A post by ${name}`);
    await expect(reports).toContainText("Buy cheap followers here");
    await expect(reports).toContainText("1 report: Spam");
    await expect(reports).toContainText("Not about coding");
    await expect(reports).not.toContainText(viewer.name);
    await noViolations(admin.page);
    await ready(admin.page);
    await reports.getByRole("button", { name: `Remove the post by ${name}` }).click();
    await admin.page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
    await expect(admin.page.getByText("No open reports.")).toBeVisible();
    await expect(admin.page.locator("#reports-heading")).toBeFocused();

    await page.reload();
    await expect(page.getByText("Buy cheap followers here")).toHaveCount(0);
    await admin.context.close();
    await author.context.close();
  });

  test("the admin can keep a reported post up instead", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const author = await anotherUser(browser, baseURL!, "author");
    const group = await createGroupInDb(viewer.id, "Keep crew", [author.account.id]);
    const post = await prisma.post.create({
      data: { groupId: group.id, authorId: author.account.id, body: "A spicy take" },
    });
    const reporter = await anotherUser(browser, baseURL!, "reporter");
    await prisma.groupMembership.create({
      data: { groupId: group.id, userId: reporter.account.id, role: "MEMBER" },
    });
    await prisma.report.create({
      data: {
        reporterId: reporter.account.id,
        groupId: group.id,
        postId: post.id,
        reason: "OTHER",
      },
    });

    await page.goto(`/groups/${group.id}/settings#reports`);
    await ready(page);
    const reports = page.getByRole("list", { name: "Open reports" });
    await reports
      .getByRole("button", { name: `Dismiss the reports about the post by ${author.account.name}` })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Dismiss reports" }).click();
    await expect(page.getByText("No open reports.")).toBeVisible();
    await expect(
      page.getByText(`kept up reported writing by ${author.account.name}`),
    ).toBeVisible();
    await page.goto(`/groups/${group.id}`);
    await expect(page.getByText("A spicy take")).toBeVisible();
    await reporter.context.close();
    await author.context.close();
  });

  test("blocking hides someone's posts and stops their replies, until unblocked", async ({
    page,
    viewer,
    browser,
    baseURL,
    isMobile,
  }) => {
    const other = await anotherUser(browser, baseURL!, "other");
    const group = await createGroupInDb(viewer.id, "Block crew", [other.account.id]);
    const mine = await prisma.post.create({
      data: { groupId: group.id, authorId: viewer.id, body: "My question" },
    });
    await prisma.post.create({
      data: { groupId: group.id, authorId: other.account.id, body: "Their answer" },
    });
    const name = other.account.name;

    await page.goto(`/groups/${group.id}`);
    await ready(page);
    await openMenu(page, name, isMobile);
    await page.getByRole("menuitem", { name: `Block ${name}…` }).click();
    const dialog = page.getByRole("alertdialog", { name: `Block ${name}?` });
    await dialog.getByRole("button", { name: "Block", exact: true }).click();
    await expect(dialog).toHaveCount(0);

    // Folded, with a way to look anyway.
    const theirs = postBy(page, name);
    await expect(theirs).toContainText(`Hidden: you blocked ${name}. Show`);
    await expect(theirs.getByText("Their answer")).toBeHidden();
    await theirs.getByText(`Hidden: you blocked ${name}. Show`).click();
    await expect(theirs.getByText("Their answer")).toBeVisible();
    await noViolations(page);

    // They can't comment on my post (and aren't told why).
    await other.page.goto(`/posts/${mine.id}`);
    await ready(other.page);
    await other.page.getByRole("textbox", { name: "Add a comment" }).fill("Hello?");
    await other.page.getByRole("button", { name: "Post comment" }).click();
    await expect(other.page.getByRole("main").getByRole("alert")).toContainText(
      "This person isn't taking replies.",
    );

    // Settings lists them; unblocking shows their post again.
    await page.goto("/settings");
    await ready(page);
    const blocked = page.getByRole("list", { name: "People you blocked" });
    await expect(blocked).toContainText(name);
    await blocked.getByRole("button", { name: `Unblock ${name}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Unblock" }).click();
    await expect(page.getByText("You haven't blocked anyone.")).toBeVisible();
    await expect(page.locator("#blocked-heading")).toBeFocused();
    await page.goto(`/groups/${group.id}`);
    await expect(postBy(page, name).getByText("Their answer")).toBeVisible();
    await other.context.close();
  });
});
