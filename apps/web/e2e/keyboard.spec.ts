import { prisma } from "@branch/database";
import {
  createGroupInDb,
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  solveInDb,
  test,
} from "./support/fixtures";

const ready = (page: import("@playwright/test").Page) =>
  page.waitForFunction(() => document.readyState === "complete");

test.describe("keyboard", () => {
  test.skip(({ isMobile }) => isMobile, "Keyboard journeys are desktop journeys");

  test("progress controls work without a pointer and keep focus", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Keyboard crew");
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));
    await page.goto("/home");
    await ready(page);

    // Space toggles; focus stays on the control after the page refreshes its data.
    const toggle = page.getByRole("button", { name: "Solved: Two Sum", exact: true });
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toBeFocused();

    // Next week opens from the keyboard, and its problems are reachable with Tab.
    const nextWeek = page.locator("summary", { hasText: "Next week" });
    await nextWeek.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Solved: Valid Palindrome", exact: true }),
    ).toBeFocused();
  });

  test("confirmation dialogs close with Escape and return focus", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Dialog crew");
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));
    await page.goto(`/groups/${group.id}/plan`);
    await ready(page);

    const trigger = page.getByRole("button", { name: "End plan" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // Focus starts inside the dialog, on the safe choice.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("heading", { level: 2, name: /^Week 1\b/ })).toBeVisible();
  });

  test("pasting and deleting a solution work from the keyboard and keep focus", async ({
    page,
    viewer,
  }) => {
    await solveInDb(viewer.id, ["two-sum"]);
    await page.goto("/solutions");
    await ready(page);

    const summary = page.locator("summary", { hasText: "Paste a solution" });
    await summary.focus();
    await page.keyboard.press("Enter");
    // Typing filters the problems; Enter picks the highlighted one.
    await page.keyboard.press("Tab");
    const problem = page.getByRole("combobox", { name: "Problem" });
    await expect(problem).toBeFocused();
    await page.keyboard.type("Two");
    await expect(page.getByRole("option", { name: "Two Sum" })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(problem).toHaveValue("Two Sum");
    await page.getByLabel("Language").selectOption({ label: "Python 3" });
    await page.getByLabel("Your solution").focus();
    await page.keyboard.type("print(1)");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Save solution" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main").getByRole("status").first()).toContainText(
      "Solution saved.",
    );

    // Deleting from the keyboard: the dialog starts on Cancel, and focus lands on the heading.
    const card = page.getByRole("article", { name: /Two Sum/ });
    await card.getByRole("button", { name: "Delete" }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Delete solution" }).focus();
    await page.keyboard.press("Enter");
    await expect(card).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Solutions", exact: true })).toBeFocused();
  });

  test("posts, reactions, and comments work from the keyboard and keep focus", async ({
    page,
    viewer,
  }) => {
    const group = await createGroupInDb(viewer.id, "Keyboard crew");
    const post = await prisma.post.create({
      data: { groupId: group.id, authorId: viewer.id, body: "Keyboard post" },
    });
    await page.goto(`/posts/${post.id}`);
    await ready(page);

    // Reactions are toggle buttons.
    const kudos = page.getByRole("button", { name: "Kudos" });
    await kudos.focus();
    await page.keyboard.press("Space");
    await expect(kudos).toHaveAttribute("aria-pressed", "true");
    await expect(kudos).toBeFocused();

    // Leaving the edit form, by Cancel or by saving, returns focus to Edit.
    const card = page.getByRole("article").filter({ hasText: "Keyboard post" });
    const edit = card.getByRole("button", { name: "Edit" });
    await edit.focus();
    await page.keyboard.press("Enter");
    await expect(card.getByLabel("Edit post")).toBeFocused();
    await page.keyboard.type(" (edited)");
    await card.getByRole("button", { name: "Save" }).focus();
    await page.keyboard.press("Enter");
    await expect(card).toContainText("Keyboard post (edited)");
    await expect(edit).toBeFocused();

    // Commenting keeps focus on the button, ready for the next comment.
    const form = page.getByRole("form", { name: "Add a comment" });
    await form.getByRole("textbox").focus();
    await page.keyboard.type("First comment");
    const submit = form.getByRole("button", { name: "Post comment" });
    await submit.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("list", { name: "Comments" })).toContainText("First comment");
    await expect(submit).toBeFocused();
    await expect(form.getByRole("textbox")).toHaveValue("");

    // The reply form opens from its disclosure, and Tab reaches the reply field.
    await page.locator("summary", { hasText: "Reply" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("textbox", { name: `Reply to ${viewer.name}` })).toBeFocused();

    // Deleting the comment moves focus to the post's comments toggle rather than the page body.
    await page
      .getByRole("list", { name: "Comments" })
      .getByRole("button", { name: "Delete" })
      .click();
    await page.getByRole("button", { name: "Delete comment" }).click();
    await expect(card.getByRole("button", { name: "Comment", exact: true })).toBeFocused();

    // In the feed, the toggle opens the thread inside the post and keeps focus.
    await page.goto(`/groups/${group.id}`);
    await ready(page);
    const toggle = page.getByRole("button", { name: "Comment", exact: true });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toBeFocused();
    await expect(page.getByRole("form", { name: "Add a comment" })).toBeVisible();
  });
});

// WCAG 1.4.10: at 320 CSS pixels wide, nothing but tables and graphics may scroll sideways.
test.describe("reflow at 320px", () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test("main pages fit without horizontal scrolling", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "A group with a rather long name for testing");
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(1));
    await prisma.post.create({
      data: {
        groupId: group.id,
        authorId: viewer.id,
        body: `See https://example.com/${"a-very-long-path-segment/".repeat(6)} and\n\n\`\`\`\n${"const wide = 1; ".repeat(12)}\n\`\`\`\n\n| column one | column two | column three | column four |\n|---|---|---|---|\n| 1 | 2 | 3 | 4 |`,
      },
    });
    const longPost = await prisma.post.create({
      data: {
        groupId: group.id,
        authorId: viewer.id,
        body: `Folded:\n\n\`\`\`python\n${"wide_name = 1; ".repeat(12)}\n\`\`\``,
        spoiler: true,
      },
    });
    await prisma.comment.create({
      data: {
        postId: longPost.id,
        authorId: viewer.id,
        body: `A long link https://example.com/${"segment/".repeat(12)} in a comment`,
      },
    });
    await prisma.submission.create({
      data: {
        userId: viewer.id,
        source: "LEETCODE",
        externalId: "1",
        problemSlug: "a-problem-branch-has-never-heard-of-with-a-long-slug",
        language: "python3",
        code: "wide_name = 1; ".repeat(20),
        submittedAt: new Date(),
      },
    });
    await solveInDb(viewer.id, ["best-time-to-buy-and-sell-stock"]);
    await page.goto("/roadmaps");
    await page.getByRole("link", { name: /^Patterns 150/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Patterns 150" })).toBeVisible();
    const paths = [
      "/home",
      `/posts/${longPost.id}`,
      `/groups/${group.id}`,
      `/groups/${group.id}/plan`,
      `/groups/${group.id}/settings`,
      `/groups/${group.id}/plan/new`,
      new URL(page.url()).pathname,
      "/roadmaps",
      "/settings",
      "/solutions",
      "/privacy",
      "/changelog",
      "/changelog/2026-11-09-code-on-solve-posts",
      "/review",
      "/stats",
      "/account/move",
    ];
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Opened spoiler code scrolls inside its own block too.
      if (path === "/home") await page.getByText("Show spoiler code").click();
      if (path === "/solutions") await page.getByText("Show code").click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
  });
});

// WCAG 1.4.12: content survives the user's text-spacing overrides without overlapping.
test("progress rows grow with increased text spacing", async ({ page, viewer }) => {
  const group = await createGroupInDb(viewer.id, "Spacing crew");
  await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(1));
  await page.goto(`/groups/${group.id}`);
  await page.addStyleTag({
    content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`,
  });
  const rows = page.locator(
    '[aria-label="Progress by member"] > li, [aria-label="Week 2 problems"] > li',
  );
  await expect(rows.first()).toBeVisible();
  const overflowing = await rows.evaluateAll(
    (items) => items.filter((item) => item.scrollHeight > item.clientHeight + 1).length,
  );
  expect(overflowing).toBe(0);
});

test("posts and comments grow with increased text spacing", async ({ page, viewer }) => {
  const group = await createGroupInDb(viewer.id, "Spacing crew");
  const post = await prisma.post.create({
    data: {
      groupId: group.id,
      authorId: viewer.id,
      body: "A post with **some** text, a [link](https://example.com), and `code`.",
    },
  });
  const top = await prisma.comment.create({
    data: { postId: post.id, authorId: viewer.id, body: "A comment that wraps across lines." },
  });
  await prisma.comment.create({
    data: { postId: post.id, authorId: viewer.id, parentId: top.id, body: "And a reply." },
  });
  await page.goto(`/posts/${post.id}`);
  await page.addStyleTag({
    content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`,
  });
  const blocks = page.getByRole("main").locator("article, article *");
  await expect(blocks.first()).toBeVisible();
  const clipped = await blocks.evaluateAll(
    (items) =>
      items.filter(
        (item) =>
          getComputedStyle(item).overflowY !== "visible" &&
          // Code scrolls by design; screen-reader-only text is clipped by design.
          item.tagName !== "PRE" &&
          !item.classList.contains("sr-only") &&
          item.scrollHeight > item.clientHeight + 1,
      ).length,
  );
  expect(clipped).toBe(0);
});

test("review and solution cards grow with increased text spacing", async ({ page, viewer }) => {
  await solveInDb(viewer.id, ["two-sum", "contains-duplicate"]);
  const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
  await prisma.submission.create({
    data: {
      userId: viewer.id,
      source: "PASTED",
      problemSlug: "two-sum",
      problemId: twoSum.id,
      language: "java",
      code: "class Solution { int[] twoSum(int[] nums, int target) { return null; } }",
      submittedAt: new Date(),
    },
  });
  for (const path of ["/review", "/solutions"]) {
    await page.goto(path);
    await page.addStyleTag({
      content: `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`,
    });
    const blocks = page.getByRole("main").locator("article, article *");
    await expect(blocks.first()).toBeVisible();
    const clipped = await blocks.evaluateAll(
      (items) =>
        items.filter(
          (item) =>
            getComputedStyle(item).overflowY !== "visible" &&
            item.tagName !== "PRE" &&
            !item.classList.contains("sr-only") &&
            item.scrollHeight > item.clientHeight + 1,
        ).length,
    );
    expect(clipped, `${path} clips text`).toBe(0);
  }
});
