import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "@branch/database";
import { chromium, type Page } from "@playwright/test";
import {
  createPlanInDb,
  expect,
  mondayWeeksAgo,
  newAccountDetails,
  signUpViaApi,
  test,
} from "./support/fixtures";

// Generates the Chrome Web Store images into apps/extension/store/ from the real app and the
// built extension, with realistic data in the test database. Not part of the normal run:
//   pnpm --filter @branch/extension build:e2e
//   STORE_ASSETS=1 pnpm --filter @branch/web exec playwright test e2e/store-assets.spec.ts --project desktop

const out = path.resolve(import.meta.dirname, "../../extension/store");
const extensionPath = path.resolve(import.meta.dirname, "../../extension/.output/chrome-mv3-e2e");
const iconPath = path.resolve(import.meta.dirname, "../src/app/icon.svg");

const CODE = {
  "contains-duplicate":
    "class Solution:\n    def containsDuplicate(self, nums: List[int]) -> bool:\n        seen = set()\n        for n in nums:\n            if n in seen:\n                return True\n            seen.add(n)\n        return False",
  "two-sum":
    "class Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        index = {}\n        for i, n in enumerate(nums):\n            if target - n in index:\n                return [index[target - n], i]\n            index[n] = i\n        return []",
  "valid-anagram":
    "class Solution:\n    def isAnagram(self, s: str, t: str) -> bool:\n        if len(s) != len(t):\n            return False\n        counts = Counter(s)\n        for ch in t:\n            counts[ch] -= 1\n            if counts[ch] < 0:\n                return False\n        return True",
};

const people = [
  { name: "Grace Hopper", username: "grace" },
  { name: "Alan Turing", username: "alan" },
  { name: "Katherine Johnson", username: "katherine" },
];

async function freshUsernames(usernames: string[]) {
  const existing = await prisma.profile.findMany({ where: { username: { in: usernames } } });
  await prisma.user.deleteMany({ where: { id: { in: existing.map((p) => p.userId) } } });
}

/** A 1280×800 store screenshot: a caption beside or above an image of the real UI. */
async function compose(
  page: Page,
  file: string,
  caption: string,
  detail: string,
  image: Buffer,
  layout: "side" | "full",
) {
  const src = `data:image/png;base64,${image.toString("base64")}`;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; width: 1280px; height: 800px; background: #17191d; color: #f3f4f6;
      font-family: -apple-system, "Segoe UI", system-ui, sans-serif; display: flex; overflow: hidden; }
    .side { flex-direction: row; align-items: center; gap: 64px; padding: 0 96px; }
    .full { flex-direction: column; align-items: center; gap: 28px; padding-top: 48px; }
    h1 { font-size: 40px; line-height: 1.15; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 16px; }
    p { font-size: 20px; line-height: 1.5; color: #b3b6bc; margin: 0; }
    .side .text { width: 460px; } .full .text { text-align: center; max-width: 900px; }
    .full h1 { font-size: 34px; margin-bottom: 8px; } .full p { font-size: 18px; }
    img.ui { border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,.45); }
    .side img.ui { width: 520px; } .full img.ui { width: 1100px; }
    .accent { color: #ff683b; }
  </style></head><body class="${layout}"><div class="text"><h1>${caption}</h1><p>${detail}</p></div>
  <img class="ui" src="${src}"></body></html>`);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.screenshot({ path: path.join(out, file) });
}

/** Promo tiles render in a plain browser: the extension's window can't shrink this small. */
async function tile(file: string, width: number, height: number, big: boolean) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  const icon = `data:image/svg+xml;base64,${Buffer.from(await (await import("node:fs/promises")).readFile(iconPath)).toString("base64")}`;
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; width: ${width}px; height: ${height}px; background: #17191d; color: #f3f4f6;
      font-family: -apple-system, "Segoe UI", system-ui, sans-serif; display: flex; flex-direction: column;
      justify-content: center; padding: 0 ${big ? 120 : 36}px; box-sizing: border-box; }
    .brand { display: flex; align-items: center; gap: ${big ? 20 : 12}px; }
    img { width: ${big ? 88 : 52}px; height: ${big ? 88 : 52}px; }
    .word { font-size: ${big ? 72 : 40}px; font-weight: 600; letter-spacing: -0.02em; }
    .dot { color: #ff683b; }
    p { font-size: ${big ? 32 : 19}px; line-height: 1.45; padding-bottom: 4px; color: #b3b6bc; margin: ${big ? 28 : 16}px 0 0; max-width: ${big ? 900 : 360}px; }
  </style></head><body><div class="brand"><img src="${icon}"><span class="word">branch<span class="dot">.</span></span></div>
  <p>Your accepted LeetCode solutions, synced to your study group's roadmap.</p></body></html>`);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  await page.screenshot({ path: path.join(out, file) });
  await browser.close();
}

test.describe("Chrome Web Store images", () => {
  test.skip(!process.env.STORE_ASSETS, "Set STORE_ASSETS=1 to regenerate the store images.");
  test.skip(({ isMobile }) => isMobile, "Desktop only.");
  test.skip(
    !existsSync(extensionPath),
    "Build it first: pnpm --filter @branch/extension build:e2e",
  );

  test("generate", async ({ baseURL }) => {
    test.setTimeout(120_000);
    await freshUsernames(["ada", ...people.map((p) => p.username)]);
    const profileDir = await mkdtemp(path.join(os.tmpdir(), "branch-store-"));
    const context = await chromium.launchPersistentContext(profileDir, {
      channel: "chromium",
      baseURL,
      colorScheme: "dark",
      viewport: { width: 1280, height: 800 },
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    try {
      const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
      const extensionId = new URL(worker.url()).host;
      const welcome =
        context.pages().find((p) => p.url().endsWith("/welcome.html")) ??
        (await context.waitForEvent("page", (p) => p.url().endsWith("/welcome.html")));

      // Ada and her study group, a week and a half into a plan.
      const ada = await signUpViaApi(context.request, baseURL!, {
        ...newAccountDetails("ada"),
        name: "Ada Lovelace",
      });
      await prisma.profile.update({
        where: { userId: ada.id },
        data: { username: "ada", shareSolves: true, timezone: "UTC" },
      });
      const others = await Promise.all(
        people.map((p) =>
          prisma.user.create({
            data: {
              id: randomUUID(),
              name: p.name,
              email: `${p.username}-${randomUUID().slice(0, 6)}@example.test`,
              profile: { create: { username: p.username, timezone: "UTC" } },
            },
          }),
        ),
      );
      const group = await prisma.group.create({
        data: {
          name: "Interview prep crew",
          timezone: "UTC",
          memberships: {
            create: [
              { userId: ada.id, role: "ADMIN" },
              ...others.map((o) => ({ userId: o.id, role: "MEMBER" as const })),
            ],
          },
        },
      });
      await createPlanInDb(group.id, ada.id, mondayWeeksAgo(0));
      const problems = await prisma.problem.findMany({
        where: {
          leetcodeSlug: {
            in: ["contains-duplicate", "valid-anagram", "two-sum", "group-anagrams"],
          },
        },
      });
      const id = (slug: string) => problems.find((p) => p.leetcodeSlug === slug)!.id;
      const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);
      const solved: [number, string, number][] = [
        [0, "contains-duplicate", 50],
        [0, "valid-anagram", 30],
        [0, "two-sum", 26],
        [0, "group-anagrams", 5],
        [1, "contains-duplicate", 44],
        [1, "two-sum", 20],
        [2, "contains-duplicate", 8],
      ];
      for (const [who, slug, h] of solved) {
        await prisma.problemCompletion.create({
          data: {
            userId: others[who]!.id,
            problemId: id(slug),
            source: "MANUAL",
            completedAt: hoursAgo(h),
          },
        });
        await prisma.post.create({
          data: {
            groupId: group.id,
            authorId: others[who]!.id,
            kind: "SOLVE",
            problemId: id(slug),
            createdAt: hoursAgo(h),
          },
        });
      }
      const help = await prisma.post.create({
        data: {
          groupId: group.id,
          authorId: others[1]!.id,
          createdAt: hoursAgo(3),
          body: "Group Anagrams: is sorting each word the usual approach, or is there something faster than O(n·k log k)?",
        },
      });
      await prisma.comment.create({
        data: {
          postId: help.id,
          authorId: others[0]!.id,
          createdAt: hoursAgo(2),
          body: "Count the 26 letters instead of sorting; the tuple of counts makes a fine key. O(n·k).",
        },
      });

      // Ada's first two solves arrive through the API, as the extension sends them.
      const token = `brx_${randomBytes(32).toString("base64url")}`;
      await prisma.extensionConnection.create({
        data: { userId: ada.id, tokenHash: createHash("sha256").update(token).digest("hex") },
      });
      for (const [i, slug] of (["contains-duplicate", "two-sum"] as const).entries()) {
        const response = await context.request.post("/api/extension/submissions", {
          headers: { authorization: `Bearer ${token}` },
          data: {
            verdict: "ACCEPTED",
            submissionId: String(2189870000 + i),
            problemSlug: slug,
            language: "python3",
            code: CODE[slug],
            submittedAt: Math.floor(hoursAgo(20 - i).getTime() / 1000),
          },
        });
        expect(response.ok()).toBe(true);
      }

      // Then connect this browser and solve Valid Anagram on a stand-in for LeetCode.
      const page = await context.newPage();
      await page.goto("/settings");
      await page.waitForFunction(() => document.readyState === "complete");
      await page.getByRole("button", { name: "Connect a browser" }).click();
      await expect(page.locator("#extension").getByRole("status")).toContainText(
        "syncs to Ada Lovelace",
      );
      let polls = 0;
      await context.route("https://leetcode.com/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith("/submit/"))
          return route.fulfill({ json: { submission_id: 2189874571 } });
        if (url.pathname === "/graphql/") {
          const judging = polls++ === 0;
          return route.fulfill({
            json: {
              data: {
                submissionDetails: {
                  statusCode: judging ? 16 : 10,
                  totalCorrect: judging ? null : 54,
                  totalTestcases: judging ? 0 : 54,
                  code: CODE["valid-anagram"],
                  lang: { name: "python3" },
                  question: { titleSlug: "valid-anagram" },
                  timestamp: Math.floor(Date.now() / 1000),
                },
              },
            },
          });
        }
        return route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><body><script>(async () => {
            const r = await fetch("/problems/valid-anagram/submit/", { method: "POST", body: JSON.stringify({ lang: "python3", typed_code: ${JSON.stringify(CODE["valid-anagram"])} }) });
            const { submission_id } = await r.json();
            history.pushState({}, "", "/problems/valid-anagram/submissions/" + submission_id + "/");
            for (let i = 0; i < 2; i++) await new Promise((done) => { const x = new XMLHttpRequest(); x.open("POST", "/graphql/"); x.responseType = "blob"; x.onload = done; x.send(JSON.stringify({ operationName: "submissionDetails", variables: { submissionId: String(submission_id) } })); });
            document.title = "done";
          })();</script></body>`,
        });
      });
      await page.goto("https://leetcode.com/problems/valid-anagram/");
      await expect(page).toHaveTitle("done");
      await expect
        .poll(() => prisma.submission.count({ where: { userId: ada.id } }), { timeout: 10_000 })
        .toBe(3);

      // Raw shots of the real UI.
      const popup = await context.newPage();
      await popup.setViewportSize({ width: 360, height: 420 });
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(popup.locator("#last-sync")).toContainText("valid-anagram, counted");
      const popupShot = await popup.locator("body").screenshot();

      // Next's dev-mode badge isn't part of the product.
      const hideDevBadge = () =>
        page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.goto("/home");
      await hideDevBadge();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForTimeout(300);
      const homeShot = await page.screenshot();

      await page.goto(`/groups/${group.id}`);
      await hideDevBadge();
      await expect(
        page.getByRole("heading", { level: 1, name: "Interview prep crew" }),
      ).toBeVisible();
      await page.waitForTimeout(300);
      const groupShot = await page.screenshot();

      await page.goto("/review/solutions");
      await hideDevBadge();
      await page.getByText("Show code").first().click();
      await page.waitForTimeout(200);
      const submissionsShot = await page.screenshot();

      await welcome.setViewportSize({ width: 1280, height: 800 });
      await welcome.bringToFront();
      const welcomeShot = await welcome.screenshot();

      // Compose the store images.
      const canvas = await context.newPage();
      await compose(
        canvas,
        "screenshot-1-popup.png",
        "Solve on LeetCode.<br>It counts in <span class=accent>Branch</span>.",
        "When your solution is accepted on leetcode.com or neetcode.io, the problem is marked solved in every group and roadmap that includes it. No copying, no ticking boxes.",
        popupShot,
        "side",
      );
      await compose(
        canvas,
        "screenshot-2-home.png",
        "Your week, across every group",
        "See this week's problems, what's left from last week, and what your friends are working on.",
        homeShot,
        "full",
      );
      await compose(
        canvas,
        "screenshot-3-group.png",
        "Progress together, at your own pace",
        "Your group shares one roadmap and a weekly plan. Everyone's solves show up as they happen.",
        groupShot,
        "full",
      );
      await compose(
        canvas,
        "screenshot-4-code.png",
        "Your code stays yours",
        "Synced solutions are visible only to you, and you can delete them at any time.",
        submissionsShot,
        "full",
      );
      await compose(
        canvas,
        "screenshot-5-privacy.png",
        "You choose what's shared",
        "Nothing is collected until you connect. Groups see a solve only if you turn sharing on.",
        welcomeShot,
        "full",
      );
      await tile("promo-small-440x280.png", 440, 280, false);
      await tile("promo-marquee-1400x560.png", 1400, 560, true);
    } finally {
      await context.close();
      await rm(profileDir, { recursive: true, force: true });
    }
  });
});
