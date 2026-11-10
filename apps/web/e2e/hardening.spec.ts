import { prisma } from "@branch/database";
import { expect, test } from "./support/fixtures";

// Every response carries the security headers and a request ID; pages run under the Content
// Security Policy without violations (the browser reports any as console errors).

test.describe("hardening", () => {
  test("responses carry the headers, and a fresh request ID each", async ({ page, viewer }) => {
    const first = await page.goto("/home");
    const headers = first!.headers();
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+/);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    const second = await page.goto("/settings");
    expect(second!.headers()["x-request-id"]).not.toBe(headers["x-request-id"]);
    // API routes get one too, and a client can't choose it.
    const api = await page.request.get("/api/health", { headers: { "x-request-id": "mine" } });
    expect(api.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(viewer.id).toBeTruthy();
  });

  test("the pages people use run without CSP violations", async ({ page, viewer }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to/.test(message.text()))
        violations.push(message.text());
    });
    for (const path of [
      "/home",
      "/roadmaps",
      "/groups",
      "/review",
      "/solutions",
      "/stats",
      "/settings",
      "/changelog",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    // The theme script (next-themes) ran under the nonce: the class is set before hydration.
    await page.goto("/settings");
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked();
    await page.locator("label", { hasText: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect
      .poll(
        async () => (await prisma.profile.findUnique({ where: { userId: viewer.id } }))?.appearance,
      )
      .toBe("DARK");
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(violations).toEqual([]);
  });
});
