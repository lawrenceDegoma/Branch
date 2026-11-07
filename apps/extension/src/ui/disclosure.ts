import { EXTENSION_DISCLOSURE as DISCLOSURE } from "@branch/shared/extension-text";

// The disclosure shown before anything is collected comes from the shared package, so the
// welcome page, the popup, and Branch's Settings say the same thing.

export const RELOAD_HINT =
  "Only LeetCode and neetcode.io tabs opened or reloaded since the extension was installed or updated are watched. If a submission doesn't show up, reload the tab and submit again.";

/** Fills every element marked data-text="disclosure" or "reload-hint". */
export function fillText(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-text]")) {
    el.textContent = el.dataset.text === "disclosure" ? DISCLOSURE : RELOAD_HINT;
  }
}
