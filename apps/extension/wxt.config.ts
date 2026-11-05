import { defineConfig } from "wxt";

// The Branch origin is fixed at build time (see src/config.ts). Host access is limited to it:
// that's where submissions are sent. LeetCode access comes only from the content scripts' matches.
const branch = new URL(process.env.WXT_BRANCH_URL || "https://branch-omega-vert.vercel.app");

export default defineConfig({
  imports: false,
  manifest: {
    name: "Branch for LeetCode",
    description:
      "Syncs the LeetCode submissions you get accepted to Branch, where your group tracks progress together.",
    permissions: ["storage", "alarms"],
    host_permissions: [`${branch.protocol}//${branch.hostname}/*`],
    action: { default_title: "Branch" },
  },
});
