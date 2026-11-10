import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/lib/csp";
import { signInPath } from "@/lib/redirect";

// Must match the constants in src/modules/auth/session.ts and src/lib/request.ts (kept separate
// to avoid importing server-only modules into the proxy bundle).
const PATHNAME_HEADER = "x-branch-pathname";
const REQUEST_ID_HEADER = "x-request-id";
const NONCE_HEADER = "x-nonce";
const CSP_HEADER = "Content-Security-Policy";

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
 * Every request gets an ID (returned in the response, quoted in logs and error records) and a
 * Content Security Policy with a fresh nonce; Next reads the policy from the request headers to
 * put the nonce on its own scripts. Pages get an optimistic sign-in check: a missing session
 * cookie redirects before rendering. Pages and actions still validate the session against the
 * database (requireViewer). Incoming values of these headers are always replaced.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const path = pathname + search;
  const requestId = crypto.randomUUID();

  if (isProtected(pathname) && !getSessionCookie(request)) {
    const response = NextResponse.redirect(new URL(signInPath(path), request.url));
    response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  }

  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV !== "production" });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, path);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set(CSP_HEADER, csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set(CSP_HEADER, csp);
  return response;
}

export const config = {
  // API routes too, for the request ID; the sign-in check never matches them.
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
