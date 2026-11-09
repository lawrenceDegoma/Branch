import { prisma } from "@branch/database";
import { anotherUser, createGroupInDb, expect, test } from "./support/fixtures";

// Profile photos: uploads go to the local photo storage here (Vercel Blob in production).

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("profile photos", () => {
  test("an uploaded photo shows to the group, and initials can replace it", async ({
    page,
    viewer,
    browser,
    baseURL,
  }) => {
    const friend = await anotherUser(browser, baseURL!);
    const group = await createGroupInDb(viewer.id, "Photo crew", [friend.account.id]);
    await page.goto("/settings");
    await page.waitForFunction(() => document.readyState === "complete");
    const section = page.locator("#profile");
    await expect(section).toContainText("Your initials, for now.");
    await expect(section.locator("img")).toHaveCount(0);

    await section.getByLabel("Photo to upload").setInputFiles({
      name: "me.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(section.getByRole("status")).toContainText("Photo saved.");
    await expect(section.getByRole("button", { name: "Upload a new photo" })).toBeFocused();
    await expect(section).toContainText("Your uploaded photo.");
    const src = await section.locator("img").getAttribute("src");
    expect(src).toMatch(/^\/api\/photos\/[0-9a-f-]{36}\.(webp|jpg)$/);
    // Resized and re-encoded in the browser, then served with its real type.
    const served = await page.request.get(src!);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toMatch(/^image\/(webp|jpeg)$/);

    await friend.page.goto(`/groups/${group.id}`);
    await expect(
      friend.page.getByRole("region", { name: /Members/ }).locator(`img[src="${src}"]`),
    ).toHaveCount(1);

    await section.getByRole("button", { name: "Use my initials" }).click();
    await expect(section.getByRole("status")).toContainText(
      "Your initials show instead of a photo.",
    );
    await expect(section.locator("img")).toHaveCount(0);
    await expect(section.getByRole("button", { name: "Upload a photo" })).toBeFocused();
    // The upload is deleted, not just hidden.
    expect((await page.request.get(src!)).status()).toBe(404);
    await friend.context.close();
  });

  test("the photo from GitHub shows by default and can be switched off and on", async ({
    page,
    viewer,
  }) => {
    const photo = "https://avatars.githubusercontent.com/u/1?v=4";
    await page.route("https://avatars.githubusercontent.com/**", (route) =>
      route.fulfill({ body: PNG, contentType: "image/png" }),
    );
    await prisma.user.update({ where: { id: viewer.id }, data: { image: photo } });
    await page.goto("/settings");
    await page.waitForFunction(() => document.readyState === "complete");
    const section = page.locator("#profile");
    await expect(section).toContainText("Your photo from Google or GitHub.");
    await expect(section.locator("img")).toHaveAttribute("src", photo);

    await section.getByRole("button", { name: "Use my initials" }).click();
    await expect(section.locator("img")).toHaveCount(0);
    await section.getByRole("button", { name: "Use my GitHub photo" }).click();
    await expect(section.getByRole("status")).toContainText("Photo updated.");
    await expect(section.locator("img")).toHaveAttribute("src", photo);
  });

  test("a file that isn't an image is refused before it's sent", async ({ page, viewer }) => {
    await page.goto("/settings");
    await page.waitForFunction(() => document.readyState === "complete");
    const section = page.locator("#profile");
    await section.getByLabel("Photo to upload").setInputFiles({
      name: "notes.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    await expect(section.getByRole("alert")).toContainText("Branch couldn't read that image.");
    const profile = await prisma.profile.findUniqueOrThrow({ where: { userId: viewer.id } });
    expect(profile.photo).toBe("PROVIDER");
  });
});
