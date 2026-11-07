// Where Branch lives. Production by default; `WXT_BRANCH_URL` points a build elsewhere (the E2E
// build uses the test server, `pnpm dev` can use localhost).

const DEFAULT_BRANCH_URL = "https://branch-omega-vert.vercel.app";

export const BRANCH_ORIGIN = new URL(import.meta.env.WXT_BRANCH_URL || DEFAULT_BRANCH_URL).origin;
export const LEETCODE_ORIGIN = "https://leetcode.com";
export const NEETCODE_ORIGIN = "https://neetcode.io";

/** Which site each watched origin is. */
export const SITE_BY_ORIGIN = {
  [LEETCODE_ORIGIN]: "LEETCODE",
  [NEETCODE_ORIGIN]: "NEETCODE",
} as const;
