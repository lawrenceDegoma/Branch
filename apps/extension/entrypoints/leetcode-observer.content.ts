import { defineContentScript } from "wxt/utils/define-content-script";
import {
  checkId,
  createDetector,
  observe,
  pageSubmissionId,
  submitSlug,
  type Observation,
} from "@/src/detect";
import { OBSERVER_MESSAGE } from "@/src/messages";
import { parseJson, watchTraffic } from "@/src/traffic";

// Runs in LeetCode's own page context, because that's the only place its traffic is visible. It
// only observes (see src/traffic.ts). What it sees (a submit, a verdict, an accepted submission)
// goes to the relay content script, which hands it on.

type Target =
  { kind: "submit"; slug: string } | { kind: "graphql" } | { kind: "check"; id: string };

export default defineContentScript({
  matches: ["https://leetcode.com/*"],
  world: "MAIN",
  runAt: "document_start",
  main() {
    const detector = createDetector();

    function feed(observation: Observation) {
      const outcome = observe(detector, observation);
      if (outcome) {
        window.postMessage({ type: OBSERVER_MESSAGE, outcome }, window.location.origin);
      }
      if (observation.kind === "submit") watchResultLabel();
    }

    watchTraffic<Target>({
      classify(url, method) {
        const slug = method === "POST" ? submitSlug(url.pathname) : null;
        if (slug) return { kind: "submit", slug };
        if (method === "POST" && /^\/graphql\/?$/.test(url.pathname)) return { kind: "graphql" };
        const id = checkId(url.pathname);
        return id ? { kind: "check", id } : null;
      },
      handle(target, body, text) {
        const request = typeof body === "string" ? parseJson(body) : null;
        if (target.kind === "submit") {
          feed({ kind: "submit", slug: target.slug, request, response: parseJson(text) });
        } else if (target.kind === "graphql") {
          // Skip GraphQL calls that can't be a verdict before doing any more work.
          if (typeof body === "string" && body.includes("submissionDetails")) {
            feed({ kind: "graphql", request, response: parseJson(text) });
          }
        } else feed({ kind: "check", id: target.id, response: parseJson(text) });
      },
    });

    // Fallback signal: LeetCode's own "Accepted" label on the result page.
    let labelTimer: ReturnType<typeof setInterval> | undefined;
    function watchResultLabel() {
      clearInterval(labelTimer);
      const started = Date.now();
      labelTimer = setInterval(() => {
        if (Date.now() - started > 2 * 60_000) return clearInterval(labelTimer);
        const id = pageSubmissionId(window.location.pathname);
        const label = document.querySelector('[data-e2e-locator="submission-result"]');
        if (id && label?.textContent?.trim() === "Accepted") {
          clearInterval(labelTimer);
          feed({ kind: "page-accepted", id });
        }
      }, 1000);
    }
  },
});
