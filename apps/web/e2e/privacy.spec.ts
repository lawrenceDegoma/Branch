import { prisma } from "@branch/database";
import type { Page } from "@playwright/test";
import {
  anotherUser,
  createGroupInDb,
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  test,
} from "./support/fixtures";

// PRD scenario 5: a non-member cannot reach a private group's activity through the feed, direct
// URLs, or crafted links, and a member who leaves loses access at once. (Server actions are
// covered at the service level in src/modules/feed/privacy.int.test.ts.)

async function expectNothingOf(page: Page, groupId: string, postId: string) {
  // The unified feed, a crafted filter, and a crafted cursor show none of the group's posts.
  for (const path of ["/home", `/home?group=${groupId}`, `/home?before=${postId}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Private plans")).toHaveCount(0);
    await expect(page.getByText("Private reply")).toHaveCount(0);
  }
  // Every page of the group and of its post is the 404, with nothing of the group in it.
  for (const path of [
    `/groups/${groupId}`,
    `/groups/${groupId}/plan`,
    `/groups/${groupId}/settings`,
    `/posts/${postId}`,
    `/posts/${postId}?after=${postId}`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByText("Private plans")).toHaveCount(0);
    await expect(page.getByText("Secret crew")).toHaveCount(0);
  }
}

test.describe("group privacy", () => {
  test("outsiders and former members see nothing of a group's activity", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const member = await anotherUser(browser, baseURL!);
    const outsider = await anotherUser(browser, baseURL!, "outsider");
    const group = await createGroupInDb(viewer.id, "Secret crew", [member.account.id]);
    await createPlanInDb(group.id, viewer.id, mondayWeeksAgo(0));
    const post = await prisma.post.create({
      data: { groupId: group.id, authorId: viewer.id, body: "Private plans" },
    });
    await prisma.comment.create({
      data: { postId: post.id, authorId: viewer.id, body: "Private reply" },
    });

    await expectNothingOf(outsider.page, group.id, post.id);

    // A member sees it all, until they leave.
    await member.page.goto(`/posts/${post.id}`);
    await expect(member.page.getByText("Private plans")).toBeVisible();
    await expect(member.page.getByText("Private reply")).toBeVisible();
    await member.page.goto(`/groups/${group.id}`);
    await member.page.waitForFunction(() => document.readyState === "complete");
    await member.page.getByRole("button", { name: "Leave group" }).click();
    await member.page.getByRole("alertdialog").getByRole("button", { name: "Leave group" }).click();
    await member.page.waitForURL("**/groups");
    await expectNothingOf(member.page, group.id, post.id);

    // The admin still sees everything.
    await page.goto(`/posts/${post.id}`);
    await expect(page.getByText("Private reply")).toBeVisible();
    await member.context.close();
    await outsider.context.close();
  });
});
