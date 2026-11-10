// The Content Security Policy, built per request around a nonce (src/proxy.ts). Pure, so it can
// be tested. Scripts run only from Branch's own bundles (the nonce plus 'strict-dynamic' lets
// Next load its chunks); the development server also needs eval for hot reloading.

/** Where photos come from: uploads (Vercel Blob) and the sign-in providers. */
const IMAGE_HOSTS = [
  "https://*.public.blob.vercel-storage.com",
  "https://*.googleusercontent.com",
  "https://avatars.githubusercontent.com",
];

/** Signing in hands the browser to a provider from a form, which form-action also governs. */
const SIGN_IN_HOSTS = ["https://accounts.google.com", "https://github.com"];

export function contentSecurityPolicy(nonce: string, { dev = false } = {}): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Server-rendered style attributes (progress widths, chart heights) need inline styles.
    "style-src 'self' 'unsafe-inline'",
    // data: for the select chevron drawn in globals.css.
    `img-src 'self' data: ${IMAGE_HOSTS.join(" ")}`,
    "font-src 'self'",
    "connect-src 'self'",
    `form-action 'self' ${SIGN_IN_HOSTS.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ];
  if (!dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
