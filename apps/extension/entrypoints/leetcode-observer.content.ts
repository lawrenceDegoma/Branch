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

// Runs in LeetCode's own page context, because that's the only place its traffic is visible. It
// only observes: requests and responses pass through untouched, it never makes a request, and
// any error in here is swallowed rather than breaking the page. What it sees (a submit, a
// verdict, an accepted submission) goes to the relay content script, which hands it on.

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

    function parse(text: string): unknown {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    /** What a watched request is, from its URL, or null to leave it alone entirely. */
    function classify(rawUrl: string, method: string) {
      let url: URL;
      try {
        url = new URL(rawUrl, window.location.href);
      } catch {
        return null;
      }
      if (url.origin !== window.location.origin) return null;
      const slug = method === "POST" ? submitSlug(url.pathname) : null;
      if (slug) return { kind: "submit" as const, slug };
      if (method === "POST" && /^\/graphql\/?$/.test(url.pathname))
        return { kind: "graphql" as const };
      const id = checkId(url.pathname);
      if (id) return { kind: "check" as const, id };
      return null;
    }

    function handle(target: NonNullable<ReturnType<typeof classify>>, body: unknown, text: string) {
      const request = typeof body === "string" ? parse(body) : null;
      const response = parse(text);
      if (target.kind === "submit") feed({ kind: "submit", slug: target.slug, request, response });
      else if (target.kind === "graphql") {
        // Skip GraphQL calls that can't be a verdict before doing any more work.
        if (typeof body === "string" && body.includes("submissionDetails")) {
          feed({ kind: "graphql", request, response });
        }
      } else feed({ kind: "check", id: target.id, response });
    }

    const nativeFetch = window.fetch;
    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const response = await nativeFetch.call(this, input, init);
      try {
        const rawUrl =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = (
          init?.method ?? (input instanceof Request ? input.method : "GET")
        ).toUpperCase();
        const target = classify(rawUrl, method);
        if (target) {
          const body = init?.body ?? (input instanceof Request ? await input.clone().text() : null);
          response
            .clone()
            .text()
            .then((text) => handle(target, body, text))
            .catch(() => {});
        }
      } catch {
        // Never let observing break the page.
      }
      return response;
    };

    const nativeOpen = XMLHttpRequest.prototype.open;
    const nativeSend = XMLHttpRequest.prototype.send;
    const targets = new WeakMap<XMLHttpRequest, NonNullable<ReturnType<typeof classify>>>();
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      try {
        const target = classify(String(url), String(method).toUpperCase());
        if (target) targets.set(this, target);
        else targets.delete(this);
      } catch {
        // Ignore.
      }
      return (nativeOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const target = targets.get(this);
      if (target) {
        this.addEventListener("loadend", () => {
          try {
            const done = (text: string) => handle(target, body, text);
            const type = this.responseType;
            // LeetCode's GraphQL client reads responses as blobs.
            if (type === "" || type === "text") done(this.responseText);
            else if (type === "json") done(JSON.stringify(this.response));
            else if (type === "blob" && this.response instanceof Blob)
              this.response.text().then(done, () => {});
            else if (type === "arraybuffer" && this.response instanceof ArrayBuffer) {
              done(new TextDecoder().decode(this.response));
            }
          } catch {
            // Ignore.
          }
        });
      }
      return nativeSend.call(this, body);
    };

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
