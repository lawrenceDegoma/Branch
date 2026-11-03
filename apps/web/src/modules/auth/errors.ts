import { isAPIError } from "better-auth/api";

const messages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match. Try again.",
  INVALID_PASSWORD: "That password isn't right.",
  USER_ALREADY_EXISTS: "An account with this email already exists. Sign in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with this email already exists. Sign in instead.",
  PASSWORD_TOO_SHORT: "Use at least 10 characters.",
  PASSWORD_TOO_LONG: "Use at most 128 characters.",
  INVALID_EMAIL: "Enter a valid email address.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "This account signs in with GitHub and has no password to change.",
};

export const GENERIC_AUTH_ERROR = "Something went wrong. Please try again.";

/** Maps a Better Auth failure to a message safe to show; never exposes internals. */
export function authErrorMessage(error: unknown): string {
  if (!isAPIError(error)) return GENERIC_AUTH_ERROR;
  if (error.statusCode === 429) return "Too many attempts. Wait a minute and try again.";
  const code = typeof error.body?.code === "string" ? error.body.code : undefined;
  return (code && messages[code]) || GENERIC_AUTH_ERROR;
}
