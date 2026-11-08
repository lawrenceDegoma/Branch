import AxeBuilder from "@axe-core/playwright";
import { prisma } from "@branch/database";
import type { Page } from "@playwright/test";
import {
  anotherUser,
  createGroupInDb,
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  signUpViaApi,
  solveInDb,
  test,
} from "./support/fixtures";

const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/privacy",
  "/reset-password?token=example",
  "/missing-page",
];
const appRoutes = [
  "/home",
  "/roadmaps",
  "/groups",
  "/profile",
  "/review",
  "/settings",
  "/review/solutions",
];

async function expectNoViolations(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Next streams metadata, so the <title> can land just after the content.
  await expect(page).toHaveTitle(/\S/);
  // Scan from the top: otherwise whatever Playwright last scrolled to can sit under the sticky
  // mobile header and be reported as obscured. (Focused elements are kept clear by
  // scroll-padding in globals.css.)
  await page.evaluate(() => window.scrollTo(0, 0));
  // Measure settled colours: a colour transition caught midway reads as low contrast.
  await page.waitForFunction(() => document.getAnimations().length === 0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

for (const colorScheme of ["dark", "light"] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const route of publicRoutes) {
      test(`${route} has no detectable WCAG A/AA violations`, async ({ page }) => {
        await page.goto(route);
        await expectNoViolations(page);
      });
    }

    for (const route of appRoutes) {
      test(`${route} (signed in) has no detectable WCAG A/AA violations`, async ({
        page,
        viewer: _viewer,
      }) => {
        await page.goto(route);
        await expectNoViolations(page);
      });
    }

    test("group pages have no detectable WCAG A/AA violations", async ({ page, viewer }) => {
      const group = await createGroupInDb(viewer.id, "Accessible crew");
      for (const path of [
        "/groups",
        "/groups/new",
        `/groups/${group.id}`,
        `/groups/${group.id}/settings`,
      ]) {
        await page.goto(path);
        await expectNoViolations(page);
      }
      // An open confirmation dialog.
      await page.getByRole("button", { name: "Create link" }).click();
      await expect(page.getByLabel("Invite link", { exact: true })).toBeVisible();
      await expectNoViolations(page);
      await page.getByRole("button", { name: "Turn off" }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      // Measure contrast after the dialog has finished fading in.
      await page.waitForFunction(() => document.getAnimations().length === 0);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });

    test("roadmap pages have no detectable WCAG A/AA violations", async ({
      page,
      viewer: _viewer,
    }) => {
      await page.goto("/roadmaps/new");
      await expectNoViolations(page);
      await page.getByLabel("Title").fill("Accessible roadmap");
      await page.getByRole("button", { name: "Create and add problems" }).click();
      await page.getByRole("button", { name: "Add section" }).click();
      await page.getByLabel("Search problems").fill("two");
      await expect(page.getByRole("button", { name: "Add Two Sum", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Add Two Sum", exact: true }).click();
      await expectNoViolations(page);
      await page.getByRole("button", { name: "Publish" }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Accessible roadmap" }),
      ).toBeVisible();
      await expectNoViolations(page);
      const id = page.url().split("/").at(-1)!;
      await page.goto(`/roadmaps/${id}/settings`);
      await expectNoViolations(page);
      await page.goto("/roadmaps");
      await expectNoViolations(page);
    });

    test("plan pages have no detectable WCAG A/AA violations", async ({ page, viewer }) => {
      const group = await createGroupInDb(viewer.id, "Planned crew");
      await page.goto(`/groups/${group.id}/plan/new`);
      await expectNoViolations(page);
      await page.getByRole("button", { name: "Start plan" }).click();
      await expect(page.getByRole("heading", { level: 2, name: /^Week 1\b/ })).toBeVisible();
      await expectNoViolations(page);
      await page.goto(`/groups/${group.id}`);
      await expectNoViolations(page);
    });

    test("progress views have no detectable WCAG A/AA violations", async ({
      page,
      viewer,
      browser,
      baseURL,
    }) => {
      const member = await anotherUser(browser, baseURL!);
      const group = await createGroupInDb(viewer.id, "Progress crew", [member.account.id]);
      await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(1)); // week 2, with a backlog
      await page.goto(`/groups/${group.id}`);
      await page.waitForFunction(() => document.readyState === "complete");
      await page.getByRole("button", { name: "Solved: Valid Palindrome" }).click();
      await expect(page.getByRole("button", { name: "Solved: Valid Palindrome" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      for (const path of ["/home", `/groups/${group.id}`, `/groups/${group.id}/plan`]) {
        await page.goto(path);
        await expectNoViolations(page);
      }
      await page.getByRole("link", { name: "Starter sample" }).first().click();
      await expect(page.getByText(/You've solved 1 of 22/)).toBeVisible();
      await expectNoViolations(page);
      await member.context.close();
    });

    test("feeds have no detectable WCAG A/AA violations", async ({
      page,
      viewer,
      browser,
      baseURL,
    }) => {
      const member = await anotherUser(browser, baseURL!);
      const group = await createGroupInDb(viewer.id, "Feed crew", [member.account.id]);
      await createGroupInDb(viewer.id, "Second crew");
      const plan = await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));
      const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
      // Automatic posts by the viewer, so their Hide control is scanned too.
      await prisma.post.createMany({
        data: [
          { groupId: group.id, authorId: viewer.id, kind: "SOLVE", problemId: twoSum.id },
          {
            groupId: group.id,
            authorId: viewer.id,
            kind: "WEEK_DONE",
            planId: plan.id,
            weekNumber: 1,
          },
          { groupId: group.id, authorId: viewer.id, kind: "PLAN_DONE", planId: plan.id },
        ],
      });
      await prisma.post.createMany({
        data: [
          {
            groupId: group.id,
            authorId: member.account.id,
            problemId: twoSum.id,
            body: "Hash map or **two pointers**?\n\n> quoted\n\n- a `map`\n- [a link](https://example.com)\n\n```\nconst seen = new Map();\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |",
            editedAt: new Date(),
          },
          { groupId: group.id, authorId: viewer.id, body: "Week one done." },
          {
            groupId: group.id,
            authorId: member.account.id,
            body: "Every token colour:\n\n```python\n@cache\ndef f(s: str) -> int:\n    # note\n    return len(s) + 1 if s else None  # 'x'\n```\n\n```diff\n- old\n+ new\n```",
          },
          {
            groupId: group.id,
            authorId: member.account.id,
            body: "My solution:\n\n```ts\nconst seen = new Set<number>();\n```",
            spoiler: true,
          },
        ],
      });
      for (const path of ["/home", `/home?group=${group.id}`, `/groups/${group.id}`]) {
        await page.goto(path);
        await expectNoViolations(page);
      }
      // Spoiler code, opened.
      await page.getByText("Show spoiler code").click();
      await expect(page.getByText("new Set<number>()")).toBeVisible();
      await expectNoViolations(page);
      // Editing in place, and a composer error.
      await page.waitForFunction(() => document.readyState === "complete");
      await page
        .getByRole("article")
        .filter({ hasText: "Week one done." })
        .getByRole("button", { name: "Edit" })
        .click();
      await page
        .getByRole("form", { name: "New post" })
        .getByRole("button", { name: "Post" })
        .click();
      await expect(page.getByText("Write something first.")).toBeVisible();
      await expectNoViolations(page);
      await member.context.close();
    });

    test("post pages have no detectable WCAG A/AA violations", async ({
      page,
      viewer,
      browser,
      baseURL,
    }) => {
      const member = await anotherUser(browser, baseURL!);
      const group = await createGroupInDb(viewer.id, "Thread crew", [member.account.id]);
      const post = await prisma.post.create({
        data: { groupId: group.id, authorId: member.account.id, body: "Help with **this**?" },
      });
      await prisma.reaction.create({ data: { postId: post.id, userId: viewer.id, kind: "KUDOS" } });
      const top = await prisma.comment.create({
        data: {
          postId: post.id,
          authorId: member.account.id,
          body: "My attempt:\n\n```js\nlet x = 1;\n```",
          spoiler: true,
        },
      });
      await prisma.comment.create({
        data: { postId: post.id, authorId: viewer.id, parentId: top.id, body: "Close!" },
      });
      await page.goto(`/posts/${post.id}`);
      await expectNoViolations(page);
      // The same thread opened inside the post in the group's feed.
      await page.goto(`/groups/${group.id}`);
      await page.waitForFunction(() => document.readyState === "complete");
      await page.getByRole("button", { name: "2 comments" }).click();
      await expect(page.getByRole("list", { name: "Comments" })).toBeVisible();
      await expectNoViolations(page);
      await page.goto(`/posts/${post.id}`);
      // An open reply form and opened spoiler code.
      await page.locator("summary", { hasText: "Reply" }).first().click();
      await page.getByText("Show spoiler code").click();
      await expect(page.getByText("let x")).toBeVisible();
      await expectNoViolations(page);
      await member.context.close();
    });

    test("synced submissions have no detectable WCAG A/AA violations", async ({ page, viewer }) => {
      const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
      const base = {
        userId: viewer.id,
        source: "LEETCODE" as const,
        language: "python3",
        code: "class Solution:\n    def twoSum(self, nums, target):\n        return []",
        submittedAt: new Date(),
      };
      await prisma.submission.createMany({
        data: [
          { ...base, externalId: "1", problemSlug: "two-sum", problemId: twoSum.id },
          { ...base, externalId: "2", problemSlug: "not-in-branch" },
        ],
      });
      await createGroupInDb(viewer.id, "Sharing crew");
      await page.goto("/review/solutions");
      // Opening the page starts their analysis; the estimate appears without a reload.
      const counted = page.getByRole("article", { name: /Two Sum/ });
      await expect(counted).toContainText("Probably O(1) time", { timeout: 15_000 });
      await counted.getByText("Why, and what it can't tell").click();
      await page.getByText("Show code").first().click();
      await expect(page.getByRole("main").locator("pre").first()).toBeVisible();
      await page.locator("summary", { hasText: "Paste a solution" }).click();
      await expectNoViolations(page);
      // The share dialog, open (it hides the page behind it, h1 included).
      await counted.getByRole("button", { name: /^Share/ }).click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
      await page.waitForFunction(() => document.getAnimations().length === 0);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations).toEqual([]);
    });

    test("due reviews have no detectable WCAG A/AA violations", async ({ page, viewer }) => {
      await solveInDb(viewer.id, ["two-sum", "valid-anagram"]);
      await solveInDb(viewer.id, ["contains-duplicate"], 3);
      await page.goto("/review");
      await page.waitForFunction(() => document.readyState === "complete");
      // Couldn't solve: the page then suggests practice too.
      await page
        .getByRole("button", { name: /^Couldn't solve/ })
        .first()
        .click();
      await expect(page.getByRole("main").getByRole("status")).toContainText("comes back");
      await expect(page.getByRole("list", { name: "Topics to practice" })).toBeVisible();
      await expectNoViolations(page);
    });

    test("invite and shared-link pages have no detectable WCAG A/AA violations", async ({
      page,
      viewer,
      browser,
      baseURL,
    }) => {
      const group = await createGroupInDb(viewer.id, "Invited crew");
      await page.goto(`/groups/${group.id}/settings`);
      await page.getByRole("button", { name: "Create link" }).click();
      const inviteUrl = await page.getByLabel("Invite link", { exact: true }).inputValue();

      await page.goto("/roadmaps/new");
      await page.getByLabel("Title").fill("Shared roadmap");
      await page.getByRole("button", { name: "Create and add problems" }).click();
      await page.getByRole("button", { name: "Add section" }).click();
      await page.getByLabel("Search problems").fill("two");
      await page.getByRole("button", { name: "Add Two Sum", exact: true }).click();
      await page.getByRole("button", { name: "Publish" }).click();
      await page.getByRole("link", { name: "Roadmap settings" }).click();
      await page.getByRole("button", { name: "Create share link" }).click();
      const shareUrl = await page.getByLabel("Share link").inputValue();

      // Signed out: the invite explains itself and offers sign-up.
      const visitor = await browser.newContext({ baseURL, colorScheme });
      const visitorPage = await visitor.newPage();
      await visitorPage.goto(inviteUrl);
      await expectNoViolations(visitorPage);
      await visitor.close();

      // Signed in, not yet a member: the invite and someone else's shared roadmap.
      const friend = await anotherUser(browser, baseURL!);
      await friend.page.emulateMedia({ colorScheme });
      for (const url of [inviteUrl, shareUrl]) {
        await friend.page.goto(url);
        await expectNoViolations(friend.page);
      }
      await friend.context.close();
    });

    test("/onboarding has no detectable WCAG A/AA violations", async ({ page, baseURL }) => {
      await signUpViaApi(page.context().request, baseURL!, undefined, { onboard: false });
      await page.goto("/onboarding");
      await expectNoViolations(page);
    });

    test("form errors have no detectable WCAG A/AA violations", async ({ page }) => {
      await page.goto("/sign-up");
      await page.getByRole("button", { name: "Create account" }).click();
      await expect(page.getByText("Enter your name.")).toBeVisible();
      await expectNoViolations(page);
    });
  });
}
