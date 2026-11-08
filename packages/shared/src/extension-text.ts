// Plain constants shared by the extension and the web app, kept apart from the zod schemas so
// scripts that only need these don't bundle a validator.

// Messages between Branch's Settings page and the extension's content script on it. Both sides
// check `event.source === window` and the page's origin.
export const PAGE_MESSAGE = {
  /** Content script → page: the extension is installed and listening (on load, and on ping). */
  present: "branch:extension-present",
  /** Page → content script: is the extension installed? (The page may hydrate after `present`.) */
  ping: "branch:extension-ping",
  /** Page → content script: connect with this token. */
  connect: "branch:extension-connect",
  /** Content script → page: the result of connecting. */
  connected: "branch:extension-connected",
} as const;

/**
 * Shown before anything is collected: on the extension's welcome page and popup, and beside
 * "Connect a browser" in Branch. Chrome Web Store policy requires a prominent disclosure and
 * consent by an explicit action (connecting).
 */
export const EXTENSION_DISCLOSURE =
  "Once you connect, the extension watches the results of submissions you make on leetcode.com and neetcode.io in that browser. For each accepted one, it sends Branch the problem, the language, your code, and the time. Your code is visible only to you in Branch unless you choose to share it. Nothing else on either site is read or sent, and the extension never makes requests to them.";
