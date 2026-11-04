import { prisma } from "@branch/database";
import type { Locator, Page } from "@playwright/test";
import {
  anotherUser,
  createGroupInDb,
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  test,
} from "./support/fixtures";

/** Waits for hydration, so typing and clicks reach the client components. */
async function ready(page: Page) {
  await page.waitForFunction(() => document.readyState === "complete");
}

const posts = (page: Page) =>
  page.getByRole("main").getByRole("list", { name: "Posts" }).getByRole("article");

async function writePost(page: Page, body: string, group?: string) {
  const form = page.getByRole("form", { name: "New post" });
  if (group) await form.getByLabel("Post to").selectOption({ label: group });
  await form.getByRole("textbox").first().fill(body);
  await form.getByRole("button", { name: "Post" }).click();
  await expect(form.getByRole("status")).toContainText("Posted.");
}

const postWith = (scope: Page | Locator, text: string) =>
  scope.getByRole("article").filter({ hasText: text });

test.describe("feed", () => {
  test("members see each other's posts; outsiders see nothing", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const outsider = await anotherUser(browser, baseURL!, "outsider");
    const group = await createGroupInDb(viewer.id, "Feed crew", [friend.account.id]);

    await page.goto("/home");
    await ready(page);
    await writePost(page, "Stuck on **Two Sum**. Any hints?");
    await expect(posts(page).first()).toContainText("Stuck on Two Sum. Any hints?");
    await expect(posts(page).first().locator("strong")).toHaveText("Two Sum");

    await friend.page.goto("/home");
    const seen = postWith(friend.page, "Any hints?");
    await expect(seen).toContainText(viewer.name);
    await expect(seen.getByRole("link", { name: "Feed crew" })).toBeVisible();
    // The friend can't edit or delete someone else's post.
    await expect(seen.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(seen.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await outsider.page.goto("/home");
    await expect(outsider.page.getByText("Any hints?")).toHaveCount(0);
    expect((await outsider.page.goto(`/groups/${group.id}`))?.status()).toBe(404);
    // A crafted filter for someone else's group shows nothing of it.
    await outsider.page.goto(`/home?group=${group.id}`);
    await expect(outsider.page.getByText("Any hints?")).toHaveCount(0);

    await friend.context.close();
    await outsider.context.close();
  });

  test("posts go to the chosen group, and the filter narrows Home", async ({ page, viewer }) => {
    const first = await createGroupInDb(viewer.id, "Alpha crew");
    const second = await createGroupInDb(viewer.id, "Beta crew");
    await createPlanInDb(second.id, viewer.id, mondayWeeksAgo(0));

    await page.goto("/home");
    await ready(page);
    await writePost(page, "Hello alpha", "Alpha crew");
    await writePost(page, "Hello beta", "Beta crew");
    await expect(posts(page)).toHaveCount(2);

    const filter = page.getByRole("navigation", { name: "Filter by group" });
    await filter.getByRole("link", { name: "Alpha crew" }).click();
    await expect(filter.getByRole("link", { name: "Alpha crew" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(posts(page)).toHaveCount(1);
    await expect(posts(page).first()).toContainText("Hello alpha");

    // On a group page, posts go to that group and can point at a problem in its plan.
    await page.goto(`/groups/${second.id}`);
    await ready(page);
    const form = page.getByRole("form", { name: "New post" });
    await form.getByRole("textbox", { name: /Post to Beta crew/ }).fill("Two pointers here?");
    await form.getByRole("combobox", { name: "About a problem (optional)" }).fill("Valid Pal");
    await page.getByRole("option", { name: "Valid Palindrome" }).click();
    await form.getByRole("button", { name: "Post" }).click();
    const about = postWith(page, "Two pointers here?");
    await expect(about.getByRole("link", { name: /Valid Palindrome/ })).toHaveAttribute(
      "href",
      "https://leetcode.com/problems/valid-palindrome/",
    );
    await expect(page.getByText("Hello alpha")).toHaveCount(0);
    expect(first.id).not.toBe(second.id);
  });

  test("authors edit and delete; the admin removes a member's post", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const member = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Tidy crew", [member.account.id]);

    await member.page.goto(`/groups/${group.id}`);
    await ready(member.page);
    await writePost(member.page, "Frist post");
    const mine = postWith(member.page, "Frist post");
    await mine.getByRole("button", { name: "Edit" }).click();
    await mine.getByLabel("Edit post").fill("First post");
    await mine.getByRole("button", { name: "Save" }).click();
    await expect(postWith(member.page, "First post")).toContainText("edited");
    await writePost(member.page, "Buy cheap watches");

    await page.goto(`/groups/${group.id}`);
    await ready(page);
    const spam = postWith(page, "cheap watches");
    await spam.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("as the group admin");
    await dialog.getByRole("button", { name: "Delete post" }).click();
    await expect(page.getByText("cheap watches")).toHaveCount(0);
    await page.goto(`/groups/${group.id}/settings`);
    await expect(page.getByText(`removed a post by ${member.account.name}`)).toBeVisible();

    await member.page.reload();
    await expect(member.page.getByText("cheap watches")).toHaveCount(0);
    await expect(postWith(member.page, "First post")).toBeVisible();
    await member.context.close();
  });

  test("a spoiler post folds its highlighted code until a reader opens it", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Spoiler crew", [friend.account.id]);

    await page.goto(`/groups/${group.id}`);
    await ready(page);
    const form = page.getByRole("form", { name: "New post" });
    await form
      .getByRole("textbox")
      .fill("Got it in one pass:\n\n```python\nseen = {}\nreturn [seen[x], i]\n```");
    await form.getByRole("checkbox", { name: "Contains spoilers" }).check();
    await form.getByRole("button", { name: "Post" }).click();
    await expect(form.getByRole("status")).toContainText("Posted.");
    // The form is ready for the next post, unticked.
    await expect(form.getByRole("checkbox", { name: "Contains spoilers" })).not.toBeChecked();

    await friend.page.goto("/home");
    const post = postWith(friend.page, "Got it in one pass");
    const code = post.locator("pre");
    await expect(post.getByText("Got it in one pass:")).toBeVisible();
    await expect(code).toBeHidden();
    await post.getByText("Show spoiler code").click();
    await expect(code).toBeVisible();
    await expect(code.locator(".hljs-keyword", { hasText: "return" })).toBeVisible();
    await post.getByText("Hide spoiler code").click();
    await expect(code).toBeHidden();
    // By keyboard as well: the disclosure is a native control.
    await post.locator("summary").focus();
    await friend.page.keyboard.press("Enter");
    await expect(code).toBeVisible();

    // The author can take the mark off; the code then shows to everyone.
    const mine = postWith(page, "Got it in one pass");
    await mine.getByRole("button", { name: "Edit" }).click();
    await mine.getByRole("checkbox", { name: "Contains spoilers" }).uncheck();
    await mine.getByRole("button", { name: "Save" }).click();
    await expect(mine.locator("details")).toHaveCount(0);
    await friend.page.reload();
    await expect(postWith(friend.page, "Got it in one pass").locator("pre")).toBeVisible();
    await friend.context.close();
  });

  test("hostile Markdown renders as inert text", async ({ page, viewer }) => {
    await createGroupInDb(viewer.id, "Safe crew");
    let dialogs = 0;
    page.on("dialog", (dialog) => {
      dialogs++;
      void dialog.dismiss();
    });
    await page.goto("/home");
    await ready(page);
    await writePost(
      page,
      '<img src=x onerror="alert(1)"> [click](javascript:alert(2)) <script>alert(3)</script>',
    );
    const post = posts(page).first();
    await expect(post).toContainText('<img src=x onerror="alert(1)">');
    await expect(post.locator("img, script")).toHaveCount(0);
    await expect(post.locator('a[href^="javascript"]')).toHaveCount(0);
    expect(dialogs).toBe(0);
  });

  test("older posts load page by page", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Busy crew");
    await prisma.post.createMany({
      data: Array.from({ length: 23 }, (_, i) => ({
        groupId: group.id,
        authorId: viewer.id,
        body: `Update number ${i + 1}`,
        createdAt: new Date(Date.now() - (23 - i) * 60_000),
      })),
    });
    await page.goto("/home");
    await expect(posts(page)).toHaveCount(20);
    await expect(posts(page).first()).toContainText("Update number 23");
    await page.getByRole("link", { name: "Older posts" }).click();
    await expect(posts(page)).toHaveCount(3);
    await expect(posts(page).last()).toContainText("Update number 1");
    await expect(page.getByRole("link", { name: "Older posts" })).toHaveCount(0);
    await page.getByRole("link", { name: "Back to newest" }).click();
    await expect(posts(page)).toHaveCount(20);
  });
});
