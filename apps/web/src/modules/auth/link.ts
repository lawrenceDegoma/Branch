// Connecting Google or GitHub brings its photo (Better Auth's `updateUserInfoOnLink`), but never
// renames anyone: the name they chose in Branch stays. Used by the user-update database hook.

/** Drops `name` from a user update made by an OAuth callback; other updates pass unchanged. */
export function keepChosenName<T extends { name?: unknown }>(
  data: T,
  path: string | undefined,
): Omit<T, "name"> | T {
  if (!path?.startsWith("/callback/") || !("name" in data)) return data;
  const { name: _name, ...rest } = data;
  return rest;
}
