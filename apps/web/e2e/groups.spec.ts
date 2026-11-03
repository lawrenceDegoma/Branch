import { prisma } from "@branch/database";
import { anotherUser, createGroupInDb, expect, newAccountDetails, test } from "./support/fixtures";

test.describe("groups", () => {
  test("two friends join one invite-only group", async ({ page, viewer, browser, baseURL }) => {
    // The admin creates a group and an invite link.
    await page.goto("/groups");
    await page.getByRole("link", { name: "Create group" }).click();
    await page.getByLabel("Group name").fill("Fall interview crew");
    await page.getByLabel("Description").fill("Two problems a day until offers.");
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Fall interview crew" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Invite" }).click();
    await page.getByRole("button", { name: "Create link" }).click();
    const inviteUrl = await page.getByLabel("Invite link", { exact: true }).inputValue();
    expect(inviteUrl).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);

    // A friend without an account opens the link, signs up, and joins.
    const friendContext = await browser.newContext({ baseURL });
    const friend = await friendContext.newPage();
    const details = newAccountDetails("friend");
    await friend.goto(inviteUrl);
    await expect(
      friend.getByRole("heading", { level: 1, name: "Fall interview crew" }),
    ).toBeVisible();
    await expect(friend.getByText(`${viewer.name} invited you to join`)).toBeVisible();
    await friend.getByRole("link", { name: "Create an account to join" }).click();
    await friend.getByLabel("Name", { exact: true }).fill(details.name);
    await friend.getByLabel("Email").fill(details.email);
    await friend.getByLabel("Password", { exact: true }).fill(details.password);
    await friend.getByRole("button", { name: "Create account" }).click();
    await friend.getByLabel("Username").fill(details.username);
    await friend.getByRole("button", { name: "Continue" }).click();
    await friend.getByRole("button", { name: "Join group" }).click();

    await expect(
      friend.getByRole("heading", { level: 1, name: "Fall interview crew" }),
    ).toBeVisible();
    const friendMembers = friend.getByRole("region", { name: /Members/ });
    await expect(friendMembers.getByText(viewer.name)).toBeVisible();
    await expect(friendMembers.getByText(details.name)).toBeVisible();
    await expect(friend.getByRole("link", { name: "Group settings" })).toHaveCount(0);

    // Opening the link again goes straight to the group.
    await friend.goto(inviteUrl);
    await expect(friend).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);

    // The admin sees the new member.
    await page.getByRole("link", { name: "Fall interview crew" }).click();
    await expect(
      page.getByRole("region", { name: /Members/ }).getByText(details.name),
    ).toBeVisible();
    await friendContext.close();
  });

  test("non-members cannot reach a group by URL", async ({
    page,
    viewer: _viewer,
    browser,
    baseURL,
  }) => {
    const owner = await anotherUser(browser, baseURL!, "owner");
    const group = await createGroupInDb(owner.account.id, "Private crew");
    for (const path of [
      `/groups/${group.id}`,
      `/groups/${group.id}/settings`,
      "/groups/not-a-uuid",
    ]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
      await expect(page.getByText("Private crew")).toHaveCount(0);
    }
    await page.goto("/groups");
    await expect(page.getByText("You're not in a group yet")).toBeVisible();
    await owner.context.close();
  });

  test("members see the group but not its settings", async ({ page, viewer, browser, baseURL }) => {
    const owner = await anotherUser(browser, baseURL!, "owner");
    const group = await createGroupInDb(owner.account.id, "Shared crew", [viewer.id]);
    await page.goto(`/groups/${group.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Shared crew" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invite" })).toHaveCount(0);
    const response = await page.goto(`/groups/${group.id}/settings`);
    expect(response?.status()).toBe(404);
    await owner.context.close();
  });

  test("an admin removes a member, who then loses access", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const member = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Tidy crew", [member.account.id]);

    await page.goto(`/groups/${group.id}/settings`);
    const members = page.getByRole("region", { name: "Members" });
    await members.getByRole("button", { name: "Remove" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`Remove ${member.account.name}?`);
    await dialog.getByRole("button", { name: "Remove member" }).click();
    await expect(dialog).toBeHidden();
    await expect(members.getByText(member.account.name)).toHaveCount(0);

    const response = await member.page.goto(`/groups/${group.id}`);
    expect(response?.status()).toBe(404);
    await member.context.close();
  });

  test("an admin hands the role to another member", async ({ page, viewer, browser, baseURL }) => {
    const member = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Rotating crew", [member.account.id]);

    await page.goto(`/groups/${group.id}/settings`);
    await page.getByRole("button", { name: "Make admin" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Transfer admin" }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${group.id}$`));
    await expect(page.getByRole("link", { name: "Group settings" })).toHaveCount(0);

    await member.page.goto(`/groups/${group.id}`);
    await expect(member.page.getByRole("link", { name: "Group settings" })).toBeVisible();
    await member.context.close();
  });

  test("outline link buttons keep a visible border", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Bordered crew");
    await page.goto(`/groups/${group.id}`);
    const settings = page.getByRole("link", { name: "Group settings" });
    const border = await settings.evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(border).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("a member leaves a group", async ({ page, viewer, browser, baseURL }) => {
    const owner = await anotherUser(browser, baseURL!, "owner");
    const group = await createGroupInDb(owner.account.id, "Leaving crew", [viewer.id]);
    await page.goto(`/groups/${group.id}`);
    await page.getByRole("button", { name: "Leave group" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Leave group" }).click();
    await expect(page).toHaveURL(/\/groups$/);
    await expect(page.getByText("You're not in a group yet")).toBeVisible();
    await owner.context.close();
  });

  test("deleting a group requires typing its name", async ({ page, viewer }) => {
    const group = await createGroupInDb(viewer.id, "Doomed crew");
    await page.goto(`/groups/${group.id}/settings`);
    const confirm = page.getByLabel('Type "Doomed crew" to confirm');
    await confirm.fill("doomed crew");
    await page.getByRole("button", { name: "Delete group" }).click();
    await expect(page.getByText("Type the group's name exactly to confirm.")).toBeVisible();
    await confirm.fill("Doomed crew");
    await page.getByRole("button", { name: "Delete group" }).click();
    await expect(page).toHaveURL(/\/groups$/);
    expect(await prisma.group.count({ where: { id: group.id } })).toBe(0);
  });

  test("a turned-off invite link stops working", async ({ page, viewer, browser, baseURL }) => {
    const group = await createGroupInDb(viewer.id, "Closed crew");
    await page.goto(`/groups/${group.id}/settings`);
    await page.getByRole("button", { name: "Create link" }).click();
    const inviteUrl = await page.getByLabel("Invite link", { exact: true }).inputValue();
    await page.getByRole("button", { name: "Turn off" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Turn off link" }).click();
    await expect(page.getByText("No active invite links.")).toBeVisible();

    const outsider = await anotherUser(browser, baseURL!);
    await outsider.page.goto(inviteUrl);
    await expect(outsider.page.getByRole("main").getByRole("alert")).toContainText("turned off");
    await expect(outsider.page.getByRole("button", { name: "Join group" })).toHaveCount(0);
    await outsider.context.close();
  });

  test("an unknown invite link explains itself", async ({ page }) => {
    await page.goto(`/invite/${"x".repeat(43)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "This invite link isn't valid",
    );
  });
});
