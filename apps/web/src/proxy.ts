import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { signInPath } from "@/lib/redirect";

// Must match PATHNAME_HEADER in src/modules/auth/session.ts (kept separate to avoid importing
// server-only modules into the proxy bundle).
const PATHNAME_HEADER = "x-branch-pathname";

const PROTECTED_PREFIXES = [
  "/home",
  "/roadmaps",
  "/groups",
  "/posts",
  "/profile",
  "/review",
  "/solutions",
  "/stats",
  "/settings",
  "/account",
  "/onboarding",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Optimistic check only: a missing session cookie redirects to sign-in before rendering.
 * Pages and actions still validate the session against the database (requireViewer).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const path = pathname + search;

  if (isProtected(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL(signInPath(path), request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, path);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
