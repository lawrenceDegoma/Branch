import { prisma } from "@branch/database";
import { expect, test } from "./support/fixtures";

// Connecting a browser in Settings, syncing through the extension's API with the key it was
// given, and managing what was synced. The extension itself arrives in M17; this drives its API.

test.describe("LeetCode extension", () => {
  test("connect, sync, see it counted, and disconnect", async ({ page, viewer, request }) => {
    await page.goto("/settings");
    await page.waitForFunction(() => document.readyState === "complete");
    const section = page.locator("#extension");
    await expect(section).toContainText("No browser is connected.");
    // No extension in this browser: offer the store page.
    await expect(section.getByRole("link", { name: /Get the extension/ })).toHaveAttribute(
      "href",
      "https://chromewebstore.google.com/detail/branch-for-leetcode/e2e",
    );
    await section.getByRole("button", { name: "Connect a browser" }).click();
    const key = await section.getByLabel("Extension key").inputValue();
    expect(key).toMatch(/^brx_/);
    await expect(section.getByRole("list", { name: "Connected browsers" })).toContainText(
      "not used yet",
    );

    const sync = (submissionId: string, problemSlug: string) =>
      request.post("/api/extension/submissions", {
        headers: { authorization: `Bearer ${key}` },
        data: {
          verdict: "ACCEPTED",
          submissionId,
          problemSlug,
          language: "python3",
          code: "class Solution:\n    pass",
          submittedAt: Math.floor(Date.now() / 1000),
        },
      });
    expect(await (await sync("101", "two-sum")).json()).toEqual({ stored: "new", counted: true });
    expect(await (await sync("102", "not-in-branch-yet")).json()).toEqual({
      stored: "new",
      counted: false,
    });
    const completion = await prisma.problemCompletion.findFirstOrThrow({
      where: { userId: viewer.id },
      include: { problem: true },
    });
    expect(completion).toMatchObject({ source: "EXTENSION", problem: { leetcodeSlug: "two-sum" } });

    // The private list: one counted, one waiting with its deletion date; code on request.
    await page.goto("/review/solutions");
    const list = page.getByRole("list", { name: "Your solutions" });
    await expect(list.getByRole("article")).toHaveCount(2);
    const waiting = list.getByRole("article").filter({ hasText: "not-in-branch-yet" });
    await expect(waiting).toContainText("Not counted yet");
    const counted = list.getByRole("article").filter({ hasText: "Two Sum" });
    await expect(counted).not.toContainText("Not counted yet");
    await counted.getByText("Show code").click();
    await expect(counted.locator("pre")).toContainText("class Solution");

    // Deleting a solution keeps the problem solved, and focus lands on the heading.
    await page.waitForFunction(() => document.readyState === "complete");
    await waiting.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete solution" }).click();
    await expect(list.getByRole("article")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Solutions", exact: true })).toBeFocused();

    // Disconnecting stops the key working at once.
    await page.goto("/settings");
    await page.waitForFunction(() => document.readyState === "complete");
    await section.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Disconnect" }).click();
    await expect(section).toContainText("No browser is connected.");
    await expect(section.getByRole("button", { name: "Connect a browser" })).toBeFocused();
    expect((await sync("103", "two-sum")).status()).toBe(401);
    expect(await prisma.problemCompletion.count({ where: { userId: viewer.id } })).toBe(1);
  });
});
