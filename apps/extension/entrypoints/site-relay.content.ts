import { submissionPayloadSchema } from "@branch/shared/extension";
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { LEETCODE_ORIGIN, NEETCODE_ORIGIN, SITE_BY_ORIGIN } from "@/src/config";
import { OBSERVER_MESSAGE, type ExtensionMessage } from "@/src/messages";
import { problemPage, TICK_MS } from "@/src/timer";

// The isolated half on leetcode.com and neetcode.io: takes what the page script saw, checks it,
// and passes it to the background. Accepted submissions are checked against the shared contract
// and must come from the site they name; everything else is reduced to a stage and a problem
// slug, for the popup's "Last seen". It also tells the background which problem page the tab is on
// and whether it's in view, for the problem timer (the background ignores this while
// disconnected).

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STAGES = new Set(["submitted", "not-accepted", "unidentified"]);

function toMessage(outcome: unknown, site: "LEETCODE" | "NEETCODE"): ExtensionMessage | null {
  if (typeof outcome !== "object" || outcome === null) return null;
  const { type } = outcome as { type?: unknown };
  if (type === "accepted") {
    const parsed = submissionPayloadSchema.safeParse((outcome as { payload?: unknown }).payload);
    return parsed.success && parsed.data.source === site
      ? { type: "submission", payload: parsed.data }
      : null;
  }
  const slug = (outcome as { slug?: unknown }).slug;
  if (typeof type === "string" && STAGES.has(type) && typeof slug === "string" && SLUG.test(slug)) {
    const stage = type as "submitted" | "not-accepted" | "unidentified";
    return { type: "activity", activity: { site, stage, slug } };
  }
  return null;
}

export default defineContentScript({
  matches: ["https://leetcode.com/*", "https://neetcode.io/*"],
  runAt: "document_start",
  main() {
    const origin = window.location.origin;
    if (origin !== LEETCODE_ORIGIN && origin !== NEETCODE_ORIGIN) return;
    const site = SITE_BY_ORIGIN[origin];
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== origin) return;
      if (event.data?.type !== OBSERVER_MESSAGE) return;
      const message = toMessage(event.data.outcome, site);
      // If the extension was reloaded since this tab loaded, this fails; the popup tells people
      // to reload the tab.
      if (message) browser.runtime.sendMessage(message).catch(() => {});
    });

    let loaded = true;
    let lastPage: string | null = null;
    const report = () => {
      const page = problemPage(window.location.pathname);
      // Nothing to say on pages that aren't problems, unless the tab just left one.
      if (page === null && lastPage === null && !loaded) return;
      const visible = document.visibilityState === "visible";
      const message: ExtensionMessage = { type: "page", report: { site, page, visible, loaded } };
      browser.runtime.sendMessage(message).catch(() => {});
      lastPage = page;
      loaded = false;
    };
    report();
    document.addEventListener("visibilitychange", report);
    // In view, report regularly so the time adds up; and notice moves to another page (both
    // sites change pages without reloading) within a couple of seconds.
    setInterval(() => {
      if (document.visibilityState === "visible") report();
    }, TICK_MS);
    setInterval(() => {
      if (problemPage(window.location.pathname) !== lastPage) report();
    }, 2000);
  },
});
