import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { createGroupInDb, expect, signUpViaApi, test } from "./support/fixtures";

const publicRoutes = ["/", "/sign-in", "/sign-up", "/missing-page"];
const appRoutes = ["/home", "/roadmaps", "/groups", "/profile", "/settings"];

async function expectNoViolations(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Scan from the top: otherwise whatever Playwright last scrolled to can sit under the sticky
  // mobile header and be reported as obscured. (Focused elements are kept clear by
  // scroll-padding in globals.css.)
  await page.evaluate(() => window.scrollTo(0, 0));
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
      await expect(page.getByRole("heading", { level: 2, name: /^Week 1/ })).toBeVisible();
      await expectNoViolations(page);
      await page.goto(`/groups/${group.id}`);
      await expectNoViolations(page);
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
