"use client";

import { PAGE_MESSAGE } from "@branch/shared/extension-text";
import { Check, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Where to get the extension, unless this browser already has it. The extension's content script
 * on this page answers a ping, so an installed extension is recognized even if it announced
 * itself before the page hydrated.
 */
export function GetExtension({ storeUrl }: { storeUrl?: string }) {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const origin = window.location.origin;
    const onMessage = (event: MessageEvent) => {
      if (
        event.source === window &&
        event.origin === origin &&
        event.data?.type === PAGE_MESSAGE.present
      ) {
        setInstalled(true);
      }
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ type: PAGE_MESSAGE.ping }, origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (installed) {
    return (
      <p className="flex items-center gap-2">
        <Check aria-hidden className="size-4 text-positive" />
        Installed in this browser.
      </p>
    );
  }
  if (!storeUrl) {
    return <p className="text-ink-muted">Coming soon to the Chrome Web Store.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant: "outline" })}
      >
        Get the extension
        <ExternalLink aria-hidden className="size-4" />
        <span className="sr-only"> (opens the Chrome Web Store in a new tab)</span>
      </a>
      <p className="text-xs text-ink-muted">Free · Chrome on a computer</p>
    </div>
  );
}
