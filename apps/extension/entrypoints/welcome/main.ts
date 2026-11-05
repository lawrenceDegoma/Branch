import { browser } from "wxt/browser";
import { BRANCH_ORIGIN } from "@/src/config";
import { fillText } from "@/src/ui/disclosure";
import "@/src/ui/branch.css";

// Opened once, on install: what the extension does and sends, before anything is collected.

fillText();
(document.getElementById("privacy") as HTMLAnchorElement).href = `${BRANCH_ORIGIN}/privacy`;
document.getElementById("open-settings")!.addEventListener("click", () => {
  window.location.href = `${BRANCH_ORIGIN}/settings#extension`;
});
document.getElementById("close")!.addEventListener("click", async () => {
  const tab = await browser.tabs.getCurrent();
  if (tab?.id !== undefined) await browser.tabs.remove(tab.id);
  else window.close();
});
