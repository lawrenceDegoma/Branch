import { expect, test } from "./support/fixtures";

// The terms of service sit beside the privacy policy, and signing up says that continuing means
// agreeing to both (owner decision, 2026-11-11).

test.describe("terms of service", () => {
  test("signing up and signing in say continuing means agreeing, with both links", async ({
    page,
  }) => {
    for (const path of ["/sign-up", "/sign-in"]) {
      await page.goto(path);
      const notice = page.getByText("By continuing, you agree to Branch's");
      await expect(notice).toContainText("terms of service and privacy policy");
      await expect(notice.getByRole("link", { name: "terms of service" })).toHaveAttribute(
        "href",
        "/terms",
      );
      await expect(notice.getByRole("link", { name: "privacy policy" })).toHaveAttribute(
        "href",
        "/privacy",
      );
    }
  });

  test("the terms are public and linked beside the privacy policy", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Terms", exact: true }).click();
    await expect(page).toHaveURL(/\/terms$/);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
    await expect(main).toContainText("You must be at least 13 years old.");
    await expect(main).toContainText("governed by the laws of California");
    // The terms and the privacy policy point to each other.
    await main.getByRole("link", { name: "privacy policy" }).first().click();
    await expect(page).toHaveURL(/\/privacy$/);
    await page.getByRole("main").getByRole("link", { name: "terms of service" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    // The sign-in pages' footer has both.
    await page.goto("/sign-in");
    const footer = page.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(footer.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  test("Settings links to both", async ({ page, viewer: _viewer }) => {
    await page.goto("/settings");
    await expect(page.getByRole("link", { name: "Terms of service" })).toHaveAttribute(
      "href",
      "/terms",
    );
    await expect(page.getByRole("link", { name: "Privacy policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
