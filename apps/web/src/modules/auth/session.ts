import "server-only";
import type { Profile } from "@branch/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { signInPath } from "@/lib/redirect";
import { getProfile } from "@/modules/profile/service";
import { auth, type AuthSession } from "./auth";

// Set by src/proxy.ts so server components know which page to return to after sign-in.
export const PATHNAME_HEADER = "x-branch-pathname";

/** The current session, validated against the database. Cached per request. */
export const getSession = cache(async (): Promise<AuthSession | null> => {
  return auth.api.getSession({ headers: await headers() });
});

export type Viewer = { user: AuthSession["user"]; profile: Profile };

async function currentPath(): Promise<string | null> {
  return (await headers()).get(PATHNAME_HEADER);
}

/** Signed-in user, whether or not they have finished onboarding. Redirects otherwise. */
export async function requireUser(): Promise<AuthSession["user"]> {
  const session = await getSession();
  if (!session) redirect(signInPath(await currentPath()));
  return session.user;
}

/**
 * Signed-in, onboarded user. The authorization root for every app page and action:
 * never trust a user ID from the client.
 */
export const requireViewer = cache(async (): Promise<Viewer> => {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile) redirect("/onboarding");
  return { user, profile };
});
