import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

// The monorepo keeps a single .env at its root. Existing environment variables win.
const rootEnvFile = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
