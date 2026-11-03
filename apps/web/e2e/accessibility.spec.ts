import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createGroupInDb, expect, signUpViaApi, test } from "./support/fixtures";

const publicRoutes = ["/", "/sign-in", "/sign-up", "/missing-page"];
const appRoutes = ["/home", "/roadmaps", "/groups", "/profile", "/settings"];

async function expectNoViolations(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
