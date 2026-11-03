import { expect, test } from "@playwright/test";

test.describe("appearance", () => {
  test("follows the system preference by default", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/settings");
    const html = page.locator("html");
    await expect(html).toHaveClass(/\bdark\b/);
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked();

    await page.emulateMedia({ colorScheme: "light" });
    await expect(html).not.toHaveClass(/\bdark\b/);
  });

  test("an explicit choice overrides the system and persists across reloads", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/settings");
    const html = page.locator("html");

    await page.locator("label", { hasText: "Light" }).click();
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.reload();
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
    await expect(html).not.toHaveClass(/\bdark\b/);

    await page.locator("label", { hasText: "System" }).click();
    await expect(html).toHaveClass(/\bdark\b/);
  });

  test("the appearance control works from the keyboard", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/settings");
    await page.getByRole("radio", { name: "System" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });
});
