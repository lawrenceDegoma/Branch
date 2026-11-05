import { prisma } from "@branch/database";
import type { Locator, Page } from "@playwright/test";
import { anotherUser, createGroupInDb, expect, test } from "./support/fixtures";

async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

// Comments are articles nested in their post's article; look only inside the thread.
const commentWith = (scope: Page | Locator, text: string) =>
  scope.getByRole("main").getByRole("list", { name: "Comments" }).getByRole("article").filter({
    hasText: text,
  });

/** Opens a post's comments inside its card in the feed (the toggle names the count). */
async function openComments(page: Page, postText: string) {
  await ready(page);
  const post = page.getByRole("article").filter({ hasText: postText }).first();
  const toggle = post.getByRole("button", { name: /^(Comment|\d+ comments?)$/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return post;
}

async function comment(page: Page, body: string) {
  const form = page.getByRole("form", { name: "Add a comment" });
  await form.getByRole("textbox", { name: "Add a comment" }).fill(body);
  await form.getByRole("button", { name: "Post comment" }).click();
  await expect(page.getByRole("list", { name: "Comments" })).toContainText(body);
}

test.describe("reactions and comments", () => {
  // PRD scenario 4: a help post with spoiler code gets threaded
  // replies and reactions.
  test("a help post with spoiler code gets reactions and threaded replies", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const outsider = await anotherUser(browser, baseURL!, "outsider");
    const group = await createGroupInDb(viewer.id, "Help crew", [friend.account.id]);

    await page.goto(`/groups/${group.id}`);
    await ready(page);
    const composer = page.getByRole("form", { name: "New post" });
    await composer
      .getByRole("textbox")
      .fill("Why is this wrong?\n\n```python\nreturn sorted(nums)[k]\n```");
    await composer.getByRole("checkbox", { name: "Contains spoilers" }).check();
    await composer.getByRole("button", { name: "Post" }).click();
    await expect(composer.getByRole("status")).toContainText("Posted.");

    // The friend reacts from the feed, then opens the post.
    await friend.page.goto("/home");
    await ready(friend.page);
    const post = friend.page.getByRole("article").filter({ hasText: "Why is this wrong?" });
    const kudos = post.getByRole("button", { name: "Kudos" });
    await kudos.click();
    await expect(kudos).toHaveAttribute("aria-pressed", "true");
    await expect(kudos).toHaveText(/1/);
    // Comments open inside the post, without leaving the feed.
    await openComments(friend.page, "Why is this wrong?");
    await expect(friend.page).toHaveURL(/\/home$/);
    await expect(post.locator("pre")).toBeHidden();
    await comment(friend.page, "k is 1-indexed here, I think");

    // The author sees the reaction, and replies in the thread.
    await page.goto("/home");
    const mine = page.getByRole("article").filter({ hasText: "Why is this wrong?" });
    await expect(mine.getByRole("button", { name: "Kudos" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(mine.getByRole("button", { name: "Kudos" })).toHaveText(/1/);
    await openComments(page, "Why is this wrong?");
    await page.locator("summary", { hasText: "Reply" }).click();
    const reply = page.getByRole("form", { name: `Reply to ${friend.account.name}` });
    await reply.getByRole("textbox").fill("That was it, thanks!");
    await reply.getByRole("button", { name: "Reply" }).click();
    const replies = page.getByRole("list", { name: `Replies to ${friend.account.name}` });
    await expect(replies).toContainText("That was it, thanks!");

    await friend.page.reload();
    await openComments(friend.page, "Why is this wrong?");
    await expect(
      friend.page.getByRole("list", { name: `Replies to ${friend.account.name}` }),
    ).toContainText(viewer.name);

    // The post's own page shows the same thread, open. Outsiders get the 404 for it.
    const { id } = await prisma.post.findFirstOrThrow({ where: { groupId: group.id } });
    await page.goto(`/posts/${id}`);
    await expect(page.getByRole("list", { name: "Comments" })).toContainText("That was it");
    expect((await outsider.page.goto(`/posts/${id}`))?.status()).toBe(404);
    expect((await outsider.page.goto("/posts/not-a-post"))?.status()).toBe(404);
    await friend.context.close();
    await outsider.context.close();
  });

  test("authors edit and delete comments; the admin removes one; replies go with a comment", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const member = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Thread crew", [member.account.id]);
    const feed = `/groups/${group.id}`;
    await page.goto(feed);
    await ready(page);
    const composer = page.getByRole("form", { name: "New post" });
    await composer.getByRole("textbox").fill("Weekly check-in");
    await composer.getByRole("button", { name: "Post" }).click();
    await expect(composer.getByRole("status")).toContainText("Posted.");

    await member.page.goto(feed);
    await openComments(member.page, "Weekly check-in");
    await comment(member.page, "Frist!");
    const own = commentWith(member.page, "Frist!");
    await own.getByRole("button", { name: "Edit" }).click();
    await own.getByLabel("Edit comment").fill("First!");
    await own.getByRole("button", { name: "Save" }).click();
    await expect(commentWith(member.page, "First!")).toContainText("edited");
    await comment(member.page, "Buy cheap watches");

    // The admin replies to the first comment, then removes the spam.
    await page.goto(feed);
    await openComments(page, "Weekly check-in");
    await page.locator("summary", { hasText: "Reply" }).first().click();
    const reply = page.getByRole("form", { name: `Reply to ${member.account.name}` }).first();
    await reply.getByRole("textbox").fill("Welcome!");
    await reply.getByRole("button", { name: "Reply" }).click();
    await expect(page.getByText("Welcome!")).toBeVisible();
    const spam = commentWith(page, "cheap watches");
    await spam.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("as the group admin");
    await page.getByRole("button", { name: "Delete comment" }).click();
    await expect(page.getByText("cheap watches")).toHaveCount(0);

    // The member deletes their first comment, and the admin's reply goes with it.
    await member.page.reload();
    await openComments(member.page, "Weekly check-in");
    await commentWith(member.page, "First!").getByRole("button", { name: "Delete" }).click();
    await expect(member.page.getByRole("alertdialog")).toContainText("replies to it are deleted");
    await member.page.getByRole("button", { name: "Delete comment" }).click();
    await expect(member.page.getByText("First!")).toHaveCount(0);
    await expect(member.page.getByText("Welcome!")).toHaveCount(0);
    await expect(
      member.page.getByRole("article").filter({ hasText: "Weekly check-in" }),
    ).toContainText("Comment");
    expect(await prisma.comment.count({ where: { post: { groupId: group.id } } })).toBe(0);

    await page.goto(`/groups/${group.id}/settings`);
    await expect(page.getByText(`removed a comment by ${member.account.name}`)).toBeVisible();
    await member.context.close();
  });
});
