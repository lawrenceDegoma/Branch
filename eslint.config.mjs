// Lint config for workspace packages. apps/web has its own Next.js config.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["**/node_modules/", "**/src/generated/", "apps/", ".claude/"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
]);
