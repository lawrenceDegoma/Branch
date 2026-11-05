import { PAGE_MESSAGE } from "@branch/shared/extension-text";
import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import { BRANCH_ORIGIN } from "@/src/config";
import type { ConnectResult, ExtensionMessage } from "@/src/messages";

// On Branch's Settings page: when the person connects a browser, the page hands the new token
// here, so nothing has to be copied. Only messages from the page itself, on Branch's origin, are
// accepted.

const branch = new URL(BRANCH_ORIGIN);

export default defineContentScript({
  // Match patterns can't hold a port; the origin check below pins it.
  matches: [`${branch.protocol}//${branch.hostname}/settings*`],
  main() {
    if (window.location.origin !== BRANCH_ORIGIN) return;
    const reply = (result: ConnectResult) =>
      window.postMessage({ type: PAGE_MESSAGE.connected, result }, BRANCH_ORIGIN);

    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== BRANCH_ORIGIN) return;
      if (event.data?.type !== PAGE_MESSAGE.connect) return;
      const token = event.data.token;
      if (typeof token !== "string" || !/^brx_[A-Za-z0-9_-]{43}$/.test(token)) return;
      const message: ExtensionMessage = { type: "connect", token };
      browser.runtime
        .sendMessage(message)
        .then((result: ConnectResult) => reply(result))
        .catch(() => reply({ ok: false, message: "The extension didn't respond." }));
    });
    window.postMessage({ type: PAGE_MESSAGE.present }, BRANCH_ORIGIN);
  },
});
