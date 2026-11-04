import { prisma } from "@branch/database";
import { createGroupInDb, createPlanInDb, expect, mondayWeeksAgo, test } from "./support/fixtures";

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
      "/profile",
    ];
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Opened spoiler code scrolls inside its own block too.
      if (path === "/home") await page.getByText("Show spoiler code").click();
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
