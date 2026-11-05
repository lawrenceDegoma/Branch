import "server-only";
import { createHash, randomBytes } from "node:crypto";

// Extension tokens are random bearer secrets. Branch keeps only their SHA-256: a leaked database
// can't be used to sync as anyone, and a token is shown exactly once, when it's created.

const TOKEN_PATTERN = /^brx_[A-Za-z0-9_-]{43}$/;

export function generateToken(): string {
  return `brx_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The token from an `Authorization: Bearer …` header, if it has the right shape. */
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer (\S+)$/);
  return match && TOKEN_PATTERN.test(match[1]!) ? match[1]! : null;
}
