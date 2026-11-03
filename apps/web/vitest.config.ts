import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const rootEnvFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // "server-only" throws outside React Server Components; tests exercise server modules directly.
    alias: { "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts"],
          globalSetup: ["./src/test/integration-global-setup.ts"],
          setupFiles: ["./src/test/integration-setup.ts"],
          // Tests share one database; run files one at a time.
          fileParallelism: false,
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
        },
      },
    ],
  },
});
