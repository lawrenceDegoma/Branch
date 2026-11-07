import { defineContentScript } from "wxt/utils/define-content-script";
import { OBSERVER_MESSAGE } from "@/src/messages";
import { createNeetcodeDetector, neetcodeRequest, observeNeetcode } from "@/src/neetcode";
import { parseJson, watchTraffic } from "@/src/traffic";

// Runs in neetcode.io's own page context, because that's the only place its traffic is visible.
// It only observes (see src/traffic.ts), and reads just two requests: a problem's details (for
// its title) and a submission's verdict. What it sees goes to the relay content script.

export default defineContentScript({
  matches: ["https://neetcode.io/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const detector = createNeetcodeDetector();
    watchTraffic({
      classify: (url, method) => (method === "POST" ? neetcodeRequest(url.pathname) : null),
      handle(kind, body, text) {
        const outcome =
          kind === "problem"
            ? observeNeetcode(detector, { kind, response: parseJson(text) })
            : observeNeetcode(detector, {
                kind,
                request: typeof body === "string" ? parseJson(body) : null,
                response: parseJson(text),
              });
        if (outcome) {
          window.postMessage({ type: OBSERVER_MESSAGE, outcome }, window.location.origin);
        }
      },
    });
  },
});
