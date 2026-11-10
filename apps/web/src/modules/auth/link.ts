// Signing in with Google or GitHub, or connecting one, refreshes the photo from it (Better Auth's
// `overrideUserInfoOnSignIn` and `updateUserInfoOnLink`), but never renames anyone or changes
// their email: the name they chose in Branch and the email they signed up with stay. Used by the
// user-update database hook.

/**
 * Keeps only the photo (and bookkeeping like `updatedAt`) from a user update made by an OAuth
 * callback: drops `name`, and `email` with the `emailVerified` that comes with it. A callback's
 * lone `{ emailVerified: true }` (the provider confirming the same email) passes. Other updates
 * pass unchanged.
 */
export function keepChosenIdentity<T extends Record<string, unknown>>(
  data: T,
  path: string | undefined,
): Partial<T> {
  if (!path?.startsWith("/callback/")) return data;
  const { name: _name, ...rest } = data;
  if (!("email" in rest)) return rest as Partial<T>;
  const { email: _email, emailVerified: _emailVerified, ...photo } = rest;
  return photo as Partial<T>;
}
