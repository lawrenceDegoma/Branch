import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./csp";

describe("contentSecurityPolicy", () => {
  it("allows scripts only with the request's nonce, in production", () => {
    const policy = contentSecurityPolicy("abc123");
    expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("lets the development server eval for hot reloading, and nothing else differs", () => {
    const dev = contentSecurityPolicy("abc123", { dev: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(dev.replace(" 'unsafe-eval'", "")).toBe(
      contentSecurityPolicy("abc123").replace("; upgrade-insecure-requests", ""),
    );
  });

  it("names the photo and sign-in hosts, and no others", () => {
    const policy = contentSecurityPolicy("n");
    expect(policy).toContain(
      "img-src 'self' data: https://*.public.blob.vercel-storage.com https://*.googleusercontent.com https://avatars.githubusercontent.com",
    );
    expect(policy).toContain("form-action 'self' https://accounts.google.com https://github.com");
    expect(policy).toContain("connect-src 'self'");
  });
});
