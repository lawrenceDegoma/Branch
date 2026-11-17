"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * "Show more posts" links to the first new post (`#post-<id>`). The browser scrolls there; this
 * also moves keyboard and screen reader focus to it, so nobody starts over from the top.
 */
export function FocusFromHash() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id.startsWith("post-")) return;
    document.getElementById(id)?.focus({ preventScroll: true });
  }, [searchParams]);
  return null;
}
