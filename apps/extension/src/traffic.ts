// Watches the page's own fetch and XHR traffic, for the observer content scripts (which run in
// the page's world, the only place it's visible). It only observes: requests and responses pass
// through untouched, it never makes a request, and errors in here are swallowed rather than
// breaking the page. Only same-origin requests that `classify` picks are read at all.

export type TrafficWatcher<T> = {
  /** What a request is, from its URL and method, or null to leave it alone entirely. */
  classify(url: URL, method: string): T | null;
  /** Called once the response arrives, with the request body and the response text. */
  handle(target: T, body: unknown, text: string): void;
};

export function watchTraffic<T>({ classify, handle }: TrafficWatcher<T>) {
  function pick(rawUrl: string, method: string): T | null {
    try {
      const url = new URL(rawUrl, window.location.href);
      return url.origin === window.location.origin ? classify(url, method.toUpperCase()) : null;
    } catch {
      return null;
    }
  }

  const nativeFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const response = await nativeFetch.call(this, input, init);
    try {
      const rawUrl =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const target = pick(rawUrl, method);
      if (target !== null) {
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
  const targets = new WeakMap<XMLHttpRequest, T>();
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    try {
      const target = pick(String(url), String(method));
      if (target !== null) targets.set(this, target);
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
    if (target !== undefined) {
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
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
