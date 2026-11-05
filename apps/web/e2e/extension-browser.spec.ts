import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { prisma } from "@branch/database";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type BrowserContext, type Page, type Route } from "@playwright/test";
import { expect, newAccountDetails, signUpViaApi, test } from "./support/fixtures";

// The built extension (apps/extension, `pnpm --filter @branch/extension build:e2e`) loaded into
// Chromium, against a fake LeetCode served by Playwright. The fake replays the traffic recorded
// in docs/LEETCODE-SPIKE.md: submit, then GraphQL `submissionDetails` read as a blob, judging
// first and accepted second. Nothing here touches the real leetcode.com.

const extensionPath = path.resolve(import.meta.dirname, "../../extension/.output/chrome-mv3-e2e");
const CODE = "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]";
const SUBMISSION_ID = 2189874571;

const leetcodePage = `<!doctype html><html><body>
<button id="submit">Submit</button><button id="old">Open an old submission</button>
<p id="state"></p>
<script>
  const details = (id) => new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/graphql/");
    xhr.responseType = "blob";
    xhr.onload = () => resolve();
    xhr.send(JSON.stringify({ operationName: "submissionDetails", query: "query submissionDetails($submissionId: ID!) { … }", variables: { submissionId: String(id) } }));
  });
  document.getElementById("submit").onclick = async () => {
    const response = await fetch("/problems/two-sum/submit/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "python3", question_id: "1", typed_code: ${JSON.stringify(CODE)} }),
    });
    const { submission_id } = await response.json();
    history.pushState({}, "", "/problems/two-sum/submissions/" + submission_id + "/");
    await details(submission_id);
    await details(submission_id);
    document.getElementById("state").textContent = "judged";
  };
  // LeetCode reports old submissions as accepted too; these must never sync.
  document.getElementById("old").onclick = async () => {
    await details(1111);
    document.getElementById("state").textContent = "opened";
  };
</script></body></html>`;

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

function fakeLeetCode(context: BrowserContext) {
  let polls = 0;
  return context.route("https://leetcode.com/**", async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/problems/two-sum/submit/") {
      return route.fulfill({ json: { submission_id: SUBMISSION_ID } });
    }
    if (url.pathname === "/graphql/") {
      const id = JSON.parse(route.request().postData() ?? "{}").variables?.submissionId;
      const judging = id === String(SUBMISSION_ID) && polls++ === 0;
      return route.fulfill({
        json: {
          data: {
            submissionDetails: {
              statusCode: judging ? 16 : 10,
              totalCorrect: judging ? null : 63,
              totalTestcases: judging ? 0 : 63,
              code: CODE,
              lang: { name: "python3", verboseName: "Python3" },
              question: { questionId: "1", titleSlug: "two-sum" },
              timestamp: Math.floor(Date.now() / 1000),
              user: { username: "someone" },
            },
          },
        },
      });
    }
    return route.fulfill({ contentType: "text/html", body: leetcodePage });
  });
}

test.describe("the Chrome extension", () => {
  test.skip(({ isMobile }) => isMobile, "One desktop browser profile is enough.");
  test.skip(
    !existsSync(extensionPath),
    "Build it first: pnpm --filter @branch/extension build:e2e",
  );

  test("connects from Settings and syncs an accepted submission once", async ({ baseURL }) => {
    const profile = await mkdtemp(path.join(os.tmpdir(), "branch-extension-"));
    const context = await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      baseURL,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    try {
      const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
      const extensionId = new URL(worker.url()).host;

      // Installing opens the welcome page: what's read and sent, before anything is collected.
      const welcome =
        context.pages().find((p) => p.url().endsWith("/welcome.html")) ??
        (await context.waitForEvent("page", (p) => p.url().endsWith("/welcome.html")));
      await expect(welcome.getByRole("heading", { level: 1 })).toHaveText(
        "Sync your LeetCode solves to Branch",
      );
      await expect(
        welcome.getByText("it sends Branch the problem, the language, your code"),
      ).toBeVisible();
      await expectAccessible(welcome);
      await welcome.close();
      const account = await signUpViaApi(context.request, baseURL!, newAccountDetails("ext"));
      await fakeLeetCode(context);
      const page = await context.newPage();

      // Connecting hands the key to the extension; nothing to copy.
      await page.goto("/settings");
      await page.waitForFunction(() => document.readyState === "complete");
      // The installed extension is recognized, so there's nothing to download.
      await expect(page.locator("#extension")).toContainText(
        "The extension is installed in this browser.",
      );
      await expect(page.getByRole("link", { name: /Get the extension/ })).toHaveCount(0);
      await page.getByRole("button", { name: "Connect a browser" }).click();
      await expect(page.locator("#extension").getByRole("status")).toContainText(
        `syncs to ${account.name}'s account`,
      );
      await expect(page.getByLabel("Extension key")).toHaveCount(0);

      // An old submission's page reports Accepted, but wasn't submitted here: nothing syncs.
      await page.goto("https://leetcode.com/problems/two-sum/");
      await page.getByRole("button", { name: "Open an old submission" }).click();
      await expect(page.locator("#state")).toHaveText("opened");

      // Submitting: judging, then accepted. One submission, one completion, from the extension.
      await page.getByRole("button", { name: "Submit" }).click();
      await expect(page.locator("#state")).toHaveText("judged");
      await expect
        .poll(() => prisma.problemCompletion.findFirst({ where: { userId: account.id } }), {
          timeout: 10_000,
        })
        .toMatchObject({ source: "EXTENSION", language: "python3" });
      const submissions = await prisma.submission.findMany({ where: { userId: account.id } });
      expect(submissions).toMatchObject([
        { externalId: String(SUBMISSION_ID), problemSlug: "two-sum", code: CODE },
      ]);

      // The popup says what happened; disconnecting there revokes the key in Branch.
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await expect(popup.getByText(`Syncing to ${account.name}`)).toBeVisible();
      await expect(popup.locator("#last-sync")).toContainText("two-sum, counted");
      await expect(popup.locator("#last-seen")).toContainText("two-sum, accepted");
      await expectAccessible(popup);
      if (process.env.SHOT_DIR)
        await popup.screenshot({ path: `${process.env.SHOT_DIR}/popup-connected.png` });
      await popup.getByRole("button", { name: "Disconnect" }).click();
      await expect(popup.getByRole("heading", { name: "Not connected" })).toBeVisible();
      await expect(popup.getByRole("button", { name: "Open Branch settings" })).toBeFocused();
      await expectAccessible(popup);
      if (process.env.SHOT_DIR)
        await popup.screenshot({ path: `${process.env.SHOT_DIR}/popup-disconnected.png` });
      await expect
        .poll(() => prisma.extensionConnection.findFirst({ where: { userId: account.id } }))
        .toMatchObject({ revokedAt: expect.any(Date) });
    } finally {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    }
  });
});
