/**
 * Returns `value` when it is a same-origin path, otherwise null. Guards post-sign-in redirects
 * against open-redirect attacks ("//evil.example", "/\\evil.example", "https://...").
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  // Control characters (tabs, newlines) are stripped by browsers and can smuggle in a host.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "http://branch.invalid");
    if (url.origin !== "http://branch.invalid") return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

/** Path to the sign-in page that returns to `next` afterwards. */
export function signInPath(next?: string | null): string {
  const safe = safeNextPath(next);
  return safe && safe !== "/" ? `/sign-in?next=${encodeURIComponent(safe)}` : "/sign-in";
}
