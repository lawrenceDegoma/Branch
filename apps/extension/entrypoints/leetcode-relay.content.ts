import { submissionPayloadSchema } from "@branch/shared/extension";
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { LEETCODE_ORIGIN } from "@/src/config";
import { OBSERVER_MESSAGE, type ExtensionMessage } from "@/src/messages";

// The isolated half on leetcode.com: takes what the page script saw, checks it, and passes it to
// the background. Accepted submissions are checked against the shared contract; everything else
// is reduced to a stage and a problem slug, for the popup's "Last seen on LeetCode".

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function toMessage(outcome: unknown): ExtensionMessage | null {
  if (typeof outcome !== "object" || outcome === null) return null;
  const { type } = outcome as { type?: unknown };
  if (type === "accepted") {
    const parsed = submissionPayloadSchema.safeParse((outcome as { payload?: unknown }).payload);
    return parsed.success ? { type: "submission", payload: parsed.data } : null;
  }
  const slug = (outcome as { slug?: unknown }).slug;
  if (
    (type === "submitted" || type === "not-accepted") &&
    typeof slug === "string" &&
    SLUG.test(slug)
  ) {
    return { type: "activity", activity: { stage: type, slug } };
  }
  return null;
}

export default defineContentScript({
  matches: ["https://leetcode.com/*"],
  runAt: "document_start",
  main() {
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== LEETCODE_ORIGIN) return;
      if (event.data?.type !== OBSERVER_MESSAGE) return;
      const message = toMessage(event.data.outcome);
      // If the extension was reloaded since this tab loaded, this fails; the popup tells people
      // to reload LeetCode tabs.
      if (message) browser.runtime.sendMessage(message).catch(() => {});
    });
  },
});
