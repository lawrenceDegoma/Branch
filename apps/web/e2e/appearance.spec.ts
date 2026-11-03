import { prisma } from "@branch/database";
import { expect, signInViaApi, test } from "./support/fixtures";

test.describe("appearance", () => {
  test("follows the system preference by default", async ({ page, viewer: _viewer }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/settings");
    const html = page.locator("html");
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked();

    await page.emulateMedia({ colorScheme: "light" });
    await expect(html).not.toHaveClass(/\bdark\b/);
  });

  test("an explicit choice overrides the system and persists across reloads", async ({
    page,
    viewer: _viewer,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/settings");
    const html = page.locator("html");
    // The selection renders after hydration; wait for it so the click isn't lost.
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked();

    await page.locator("label", { hasText: "Light" }).click();
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.reload();
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.locator("label", { hasText: "System" }).click();
    await expect(html).toHaveClass(/\bdark\b/);
  });

  test("the choice follows the account to another browser", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/settings");
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
    await page.locator("label", { hasText: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    // The save runs in the background; wait until the account reflects it.
    await expect
      .poll(
        async () => (await prisma.profile.findUnique({ where: { userId: viewer.id } }))?.appearance,
      )
      .toBe("DARK");

    const other = await browser.newContext({ colorScheme: "light", baseURL });
    try {
      await signInViaApi(other.request, baseURL!, viewer);
      const otherPage = await other.newPage();
      await otherPage.goto("/home");
      await expect(otherPage.locator("html")).toHaveClass(/\bdark\b/);
    } finally {
      await other.close();
    }
  });

  test("the appearance control works from the keyboard", async ({ page, viewer: _viewer }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/settings");
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
    await page.getByRole("radio", { name: "System" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });
});
