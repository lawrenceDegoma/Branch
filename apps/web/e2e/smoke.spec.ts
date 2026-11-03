import { expect, test } from "@playwright/test";

test("identifies the product as Branch", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Branch");
  await expect(page.getByRole("heading", { level: 1, name: "Branch" })).toBeVisible();
});

test("health endpoint reports a reachable database", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok" });
});
