import { z } from "zod";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

// Route segments and words that would be confusing as handles.
const RESERVED = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "branch",
  "groups",
  "help",
  "home",
  "invite",
  "me",
  "moderator",
  "null",
  "onboarding",
  "profile",
  "roadmaps",
  "root",
  "settings",
  "sign-in",
  "sign-up",
  "signin",
  "signup",
  "support",
  "system",
  "undefined",
  "review",
]);

// Mirrors the "profile_username_format" CHECK constraint in the database.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN, `Use at least ${USERNAME_MIN} characters.`)
  .max(USERNAME_MAX, `Use at most ${USERNAME_MAX} characters.`)
  .regex(
    USERNAME_PATTERN,
    "Use letters, numbers, - or _, starting and ending with a letter or number.",
  )
  .refine((value) => !RESERVED.has(value), "That username is reserved. Try another.");

/** Turns a name or email into a username suggestion that passes validation, or "". */
export function suggestUsername(source: string): string {
  const base = source
    .split("@")[0]!
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, USERNAME_MAX)
    .replace(/[-_]+$/g, "");
  return usernameSchema.safeParse(base).success ? base : "";
}
