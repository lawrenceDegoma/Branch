import { prisma } from "@branch/database";
import { randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { anotherUser, expect, test } from "./support/fixtures";

async function createRoadmap(page: Page, title: string) {
  await page.goto("/roadmaps/new");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create and add problems" }).click();
  await expect(page).toHaveURL(/\/roadmaps\/[0-9a-f-]{36}\/edit$/);
}

async function addSection(page: Page, title: string) {
  await page.getByRole("button", { name: "Add section" }).click();
  const input = page.getByLabel("Section title").last();
  await input.fill(title);
}

async function addFromSearch(page: Page, query: string, title: string) {
  const search = page.getByLabel("Search problems");
  await search.fill(query);
  await page.getByRole("button", { name: `Add ${title}`, exact: true }).click();
}

test.describe("roadmaps", () => {
  test("create, publish, and revise a custom roadmap", async ({ page, viewer: _viewer }) => {
    await createRoadmap(page, "Weekend warm-up");
    await addSection(page, "Warm-up");
    await addFromSearch(page, "two sum", "Two Sum");

    // A problem that isn't in the catalog yet, added from its LeetCode link. The slug is unique per
    // run because tests share one catalog.
    const slug = `word-search-${randomUUID().slice(0, 8)}`;
    await page
      .getByLabel("Add from a LeetCode link")
      .fill(`https://leetcode.com/problems/${slug}/description/`);
    await page.getByRole("button", { name: "Find problem" }).click();
    await page.getByLabel("Problem title").fill("Word Search");
    await page.getByLabel("Difficulty").selectOption("MEDIUM");
    await page.getByRole("button", { name: "Add problem" }).click();
    const warmUp = page.getByRole("region", { name: "Warm-up" });
    await expect(warmUp.getByText("Word Search")).toBeVisible();
    await expect(page.getByText("Unsaved changes")).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Weekend warm-up" })).toBeVisible();
    await expect(page.getByText(/Version 1 · 2 problems/)).toBeVisible();
    const twoSum = page.getByRole("link", { name: /Two Sum/ });
    await expect(twoSum).toHaveAttribute("href", "https://leetcode.com/problems/two-sum/");
    await expect(twoSum).toHaveAttribute("target", "_blank");

    // Revise into version 2; version 1 keeps its original problems.
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Remove Word Search" }).click();
    await addSection(page, "Stack");
    await addFromSearch(page, "parentheses", "Valid Parentheses");
    await page.getByRole("button", { name: "Move section Stack up" }).click();
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(page.getByText(/Version 2 · 2 problems/)).toBeVisible();
    const sections = page.getByRole("main").getByRole("heading", { level: 2 });
    await expect(sections).toHaveText([/Stack/, /Warm-up/]);
    await expect(page.getByText("Word Search")).toHaveCount(0);

    await page
      .getByRole("navigation", { name: "Versions" })
      .getByRole("link", { name: "Version 1" })
      .click();
    await expect(page.getByText(/Version 1 \(older\)/)).toBeVisible();
    await expect(page.getByText("Word Search")).toBeVisible();
  });

  test("a draft saves and needs problems in every section to publish", async ({
    page,
    viewer: _viewer,
  }) => {
    await createRoadmap(page, "Half finished");
    await addSection(page, "Arrays");
    await addFromSearch(page, "anagram", "Valid Anagram");
    await addSection(page, "Graphs");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved.")).toBeVisible();

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      page.getByText('"Graphs" has no problems. Add some or remove the section.'),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("region", { name: "Arrays" }).getByText("Valid Anagram"),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Graphs" })).toBeVisible();
  });

  test("private roadmaps are hidden until shared by link", async ({
    page,
    viewer: _viewer,
    browser,
    baseURL,
  }) => {
    await createRoadmap(page, "Secret sauce");
    await addSection(page, "Basics");
    await addFromSearch(page, "binary search", "Binary Search");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Secret sauce" })).toBeVisible();
    const roadmapUrl = page.url();

    const friend = await anotherUser(browser, baseURL!);
    expect((await friend.page.goto(roadmapUrl))?.status()).toBe(404);

    await page.getByRole("link", { name: "Roadmap settings" }).click();
    await page.getByRole("button", { name: "Create share link" }).click();
    const shareUrl = await page.getByLabel("Share link").inputValue();
    expect(shareUrl).toMatch(/\/roadmaps\/shared\/[A-Za-z0-9_-]{32}$/);

    await friend.page.goto(shareUrl);
    await expect(
      friend.page.getByRole("heading", { level: 1, name: "Secret sauce" }),
    ).toBeVisible();
    await expect(friend.page.getByRole("link", { name: "Roadmap settings" })).toHaveCount(0);

    await page.getByRole("button", { name: "Turn off link" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "Share link turned off.",
    );
    expect((await friend.page.goto(shareUrl))?.status()).toBe(404);
    await friend.context.close();
  });

  test("an unused roadmap can be deleted", async ({ page, viewer }) => {
    await createRoadmap(page, "Short lived");
    const id = page.url().split("/").at(-2)!;
    await page.goto(`/roadmaps/${id}/settings`);
    await page.getByRole("button", { name: "Delete roadmap" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete roadmap" }).click();
    await expect(page).toHaveURL(/\/roadmaps$/);
    expect(await prisma.roadmap.count({ where: { ownerId: viewer.id } })).toBe(0);
  });

  test("curated lists are readable but not editable", async ({ page, viewer: _viewer }) => {
    await page.goto("/roadmaps");
    await page
      .getByRole("region", { name: "Curated lists" })
      .getByRole("link", { name: /Starter sample/ })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Starter sample" })).toBeVisible();
    await expect(page.getByText(/Curated list · Version 1/)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Arrays & Hashing/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    const id = page.url().split("/").at(-1)!;
    expect((await page.goto(`/roadmaps/${id}/edit`))?.status()).toBe(404);
  });
});
