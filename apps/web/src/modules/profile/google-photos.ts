import "server-only";
import { prisma } from "@branch/database";
import { z } from "zod";
import { errorContext, logger } from "@/lib/logger";
import { auth, enabledSocialProviders } from "@/modules/auth/auth";
import { newGooglePhoto } from "./photo";

// Keeps Google photos current without anyone signing in again: the daily job asks Google for the
// photo of each person who shows theirs, using the offline access granted at sign-in (the token is
// stored encrypted, and only ever used for this). GitHub needs nothing: its photo address follows
// the account. Google is behind an interface so tests use a fake.

const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const REQUEST_TIMEOUT_MS = 10_000;
/** How many people are checked at once. */
const CONCURRENCY = 5;

export interface GooglePhotos {
  /** The account's photo on Google now, or null if it has none; throws if Google can't say. */
  current(account: { id: string; userId: string }): Promise<string | null>;
}

const userInfoSchema = z.object({ picture: z.string().nullish() });

export function googlePhotos(fetchImpl: typeof fetch = fetch): GooglePhotos {
  return {
    async current(account) {
      const { accessToken } = await auth.api.refreshToken({
        body: { accountId: account.id, userId: account.userId },
      });
      const response = await fetchImpl(USERINFO_URL, {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Google answered ${response.status}`);
      return userInfoSchema.parse(await response.json()).picture ?? null;
    },
  };
}

/** Google, when sign-in with Google is set up; otherwise null (nothing to check). */
export function configuredGooglePhotos(): GooglePhotos | null {
  return enabledSocialProviders.includes("google") ? googlePhotos() : null;
}

export type PhotoRefreshSummary = { checked: number; updated: number; failed: number };

/**
 * Updates the Google photo of people who show their provider photo, least recently checked first.
 * Idempotent; a failure (revoked access, Google unreachable) skips that person until the next run.
 */
export async function refreshGooglePhotos({
  google = configuredGooglePhotos(),
  limit = 100,
  now = new Date(),
}: {
  google?: GooglePhotos | null;
  limit?: number;
  now?: Date;
} = {}): Promise<PhotoRefreshSummary | null> {
  if (!google) return null;
  const accounts = await prisma.account.findMany({
    where: {
      providerId: "google",
      refreshToken: { not: null },
      user: { profile: { is: { photo: "PROVIDER" } } },
    },
    select: { id: true, userId: true, user: { select: { image: true } } },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  const summary: PhotoRefreshSummary = { checked: 0, updated: 0, failed: 0 };
  async function refresh(account: (typeof accounts)[number]) {
    try {
      const photo = newGooglePhoto(account.user.image, await google!.current(account));
      summary.checked++;
      if (photo) {
        // Only if it hasn't changed meanwhile (a sign-in brings the newest photo anyway).
        const { count } = await prisma.user.updateMany({
          where: { id: account.userId, image: account.user.image },
          data: { image: photo },
        });
        summary.updated += count;
      }
    } catch (error) {
      summary.failed++;
      logger.warn("google photo refresh failed", { accountId: account.id, ...errorContext(error) });
    }
    // To the back of the line, checked or not.
    await prisma.account.update({ where: { id: account.id }, data: { updatedAt: now } });
  }

  for (let i = 0; i < accounts.length; i += CONCURRENCY) {
    await Promise.all(accounts.slice(i, i + CONCURRENCY).map(refresh));
  }
  return summary;
}
