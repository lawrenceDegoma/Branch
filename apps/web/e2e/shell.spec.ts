import { expect, test } from "./support/fixtures";

const destinations = [
  { path: "/home", label: "Home" },
  { path: "/roadmaps", label: "Roadmaps" },
  { path: "/groups", label: "Groups" },
  { path: "/review", label: "Review" },
  { path: "/solutions", label: "Solutions" },
];

for (const { path, label } of destinations) {
  test(`${label} page is titled and marked current in the navigation`, async ({
    page,
    viewer: _viewer,
  }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(`${label} · Branch`);
    // Solutions is headed "Your solutions".
    const heading = path === "/solutions" ? "Your solutions" : label;
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  });
}

test("desktop shows the sidebar; mobile shows the bottom bar", async ({
  page,
  viewer: _viewer,
}, testInfo) => {
  await page.goto("/home");
  const sidebar = page.locator("aside");
  const bottomBar = page.locator("nav.fixed");
  if (testInfo.project.name === "mobile") {
    await expect(sidebar).toBeHidden();
    await expect(bottomBar).toBeVisible();
  } else {
    await expect(sidebar).toBeVisible();
    await expect(bottomBar).toBeHidden();
  }
});

test("navigating between destinations updates the current page", async ({
  page,
  viewer: _viewer,
}) => {
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Groups" }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await expect(nav.getByRole("link", { name: "Groups" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
});

test("skip link moves focus to the main content", async ({ page, viewer: _viewer }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Keyboard navigation is a desktop journey");
  await page.goto("/home");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});

test("unknown routes render the Branch not-found page", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
});

test("reduced motion removes transitions", async ({ page, viewer: _viewer }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/home");
  const link = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Roadmaps" });
  const duration = await link.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toBe("0.001s");
});
