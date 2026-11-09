import "server-only";
import { prisma } from "@branch/database";
import { enabledSocialProviders } from "./auth";
import { socialProviderSchema, type SocialProvider } from "./schemas";

/** True when the user can sign in with a password. */
export async function hasPasswordAccount(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });
  return account !== null;
}

/** How someone signs in: a password, and which providers are connected. */
export async function signInMethods(
  userId: string,
): Promise<{ password: boolean; providers: SocialProvider[] }> {
  const accounts = await prisma.account.findMany({
    where: { userId },
    select: { providerId: true },
  });
  const providers = accounts.flatMap((a) => {
    const parsed = socialProviderSchema.safeParse(a.providerId);
    return parsed.success ? [parsed.data] : [];
  });
  return { password: accounts.some((a) => a.providerId === "credential"), providers };
}

/** A password account that still has to connect Google or GitHub (once either is set up). */
export async function needsToMove(userId: string): Promise<boolean> {
  if (enabledSocialProviders.length === 0) return false;
  const { password, providers } = await signInMethods(userId);
  return password && providers.length === 0;
}

/**
 * Finishes moving to a provider: once Google or GitHub is connected, the password is switched
 * off. The account itself, and everything in it, stays as it was. Returns whether it changed.
 */
export async function finishMove(userId: string): Promise<boolean> {
  const { password, providers } = await signInMethods(userId);
  if (!password || providers.length === 0) return false;
  const { count } = await prisma.account.deleteMany({
    where: { userId, providerId: "credential" },
  });
  return count > 0;
}
