"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** How often, and how many times, to look again for analyses still running. */
const INTERVAL_MS = 3000;
const TIMES = 5;

/**
 * Rendered while an analysis on the page is still running: refreshes the page's data a few
 * times so the estimate appears without a reload. Gives up after about 15 seconds; the daily job
 * finishes anything slower.
 */
export function RefreshWhileAnalyzing() {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= TIMES) clearInterval(timer);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
