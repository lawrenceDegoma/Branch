import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const rootEnvFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

// Tests and the app server both use the disposable test database, never development data.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/support/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm next dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL,
      BETTER_AUTH_URL: baseURL,
      // Placeholder credentials so both sign-in buttons render; tests stop at the provider.
      GITHUB_CLIENT_ID: "e2e-github-client",
      GITHUB_CLIENT_SECRET: "e2e-github-secret",
      GOOGLE_CLIENT_ID: "e2e-google-client",
      GOOGLE_CLIENT_SECRET: "e2e-google-secret",
      EXTENSION_STORE_URL: "https://chromewebstore.google.com/detail/branch-for-leetcode/e2e",
    },
  },
});
