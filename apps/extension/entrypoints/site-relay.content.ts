import { submissionPayloadSchema } from "@branch/shared/extension";
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { LEETCODE_ORIGIN, NEETCODE_ORIGIN, SITE_BY_ORIGIN } from "@/src/config";
import { OBSERVER_MESSAGE, type ExtensionMessage } from "@/src/messages";

// The isolated half on leetcode.com and neetcode.io: takes what the page script saw, checks it,
// and passes it to the background. Accepted submissions are checked against the shared contract
// and must come from the site they name; everything else is reduced to a stage and a problem
// slug, for the popup's "Last seen".

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
  },
});
