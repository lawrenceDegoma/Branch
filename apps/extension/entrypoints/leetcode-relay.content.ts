import { submissionPayloadSchema } from "@branch/shared/extension";
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { LEETCODE_ORIGIN } from "@/src/config";
import { OBSERVER_MESSAGE, type ExtensionMessage } from "@/src/messages";

// The isolated half on leetcode.com: takes accepted submissions from the page script, checks
// them against the shared contract, and passes them to the background to send.

export default defineContentScript({
  matches: ["https://leetcode.com/*"],
  runAt: "document_start",
  main() {
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== LEETCODE_ORIGIN) return;
      if (event.data?.type !== OBSERVER_MESSAGE) return;
      const parsed = submissionPayloadSchema.safeParse(event.data.payload);
      if (!parsed.success) return;
      const message: ExtensionMessage = { type: "submission", payload: parsed.data };
      browser.runtime.sendMessage(message).catch(() => {});
    });
  },
});
