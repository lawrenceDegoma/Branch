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
  INVALID_TOKEN: "This reset link has expired or was already used. Ask for a new one.",
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

/**
 * Explains why a Google or GitHub sign-in came back unfinished. Better Auth appends its own
 * `error` code to the sign-in URL (e.g. `account_not_linked`); unknown codes get a generic line.
 */
export function socialSignInErrorMessage(code: string): string {
  switch (code) {
    case "account_not_linked":
      return "An account with this email already exists. Sign in with your email and password.";
    case "access_denied":
      return "Sign-in was cancelled. Choose a way to sign in below.";
    case "state_not_found":
    case "state_mismatch":
    case "please_restart_the_process":
      return "That sign-in took too long or was started in another tab. Try again.";
    default:
      return "That sign-in didn't complete. Try again, or sign in with your email and password.";
  }
}
