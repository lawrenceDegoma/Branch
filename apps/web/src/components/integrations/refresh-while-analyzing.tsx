"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { checkAnalysesAction } from "@/modules/analysis/actions";

/** Checks at most this many times, this far apart, while analyses are still waiting. */
const CHECKS = 6;
const PAUSE_MS = 2000;

/**
 * Mounted on Your solutions: asks the server to run the viewer's waiting or outdated analyses,
 * and refreshes the page as soon as the viewer's analyses differ from what the page was drawn
 * with, whoever did the work (this check, a run started right after a paste, or the daily job).
 * Stops when nothing is waiting, or after about ten seconds; the refreshed page checks again.
 */
export function RefreshWhileAnalyzing({ fingerprint }: { fingerprint: string }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (let check = 0; check < CHECKS && !cancelled; check++) {
        const state = await checkAnalysesAction().catch(() => null);
        if (cancelled || !state) return;
        if (state.fingerprint !== fingerprint) {
          router.refresh();
          return;
        }
        if (state.pending === 0) return;
        await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, fingerprint]);
  return null;
}
