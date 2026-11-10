import "server-only";
import { prisma, type Profile } from "@branch/database";
import { isUniqueViolation } from "@/lib/db-errors";
import { DomainError } from "@/lib/errors";
import { errorContext, logger } from "@/lib/logger";
import { MAX_PHOTO_BYTES, sniffPhotoType } from "./photo";
import type { PhotoStorage } from "./photo-storage";
import type { AppearanceValue, OnboardingInput, ProfileUpdateInput } from "./schemas";

// Every function here acts on the caller's own profile; `userId` must come from the session.

const usernameTaken = () =>
  new DomainError("USERNAME_TAKEN", "That username is taken. Try another.", "username");

export function getProfile(userId: string): Promise<Profile | null> {
  return prisma.profile.findUnique({ where: { userId } });
}

export async function createProfile(userId: string, input: OnboardingInput): Promise<Profile> {
  try {
    return await prisma.profile.create({
      data: { userId, username: input.username, timezone: input.timezone },
    });
  } catch (error) {
    if (isUniqueViolation(error, "username")) throw usernameTaken();
    if (isUniqueViolation(error)) {
      throw new DomainError("PROFILE_EXISTS", "Your profile is already set up.");
    }
    throw error;
  }
}

export async function updateProfile(userId: string, input: ProfileUpdateInput): Promise<Profile> {
  try {
    const [, profile] = await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { name: input.name } }),
      prisma.profile.update({
        where: { userId },
        data: { username: input.username, bio: input.bio, timezone: input.timezone },
      }),
    ]);
    return profile;
  } catch (error) {
    if (isUniqueViolation(error, "username")) throw usernameTaken();
    throw error;
  }
}

export async function setAppearance(userId: string, appearance: AppearanceValue): Promise<void> {
  await prisma.profile.update({ where: { userId }, data: { appearance } });
}

/**
 * Turning sharing off stops new automatic posts; earlier ones stay until the author hides them.
 * Code goes on solve posts only while they're shared at all (CHECK), so turning sharing off turns
 * that off too, which takes the code off earlier posts at once.
 */
export async function setSharing(
  userId: string,
  { shareSolves, attachSolutions }: { shareSolves: boolean; attachSolutions: boolean },
): Promise<{ shareSolves: boolean; attachSolutions: boolean }> {
  const saved = { shareSolves, attachSolutions: shareSolves && attachSolutions };
  await prisma.profile.update({ where: { userId }, data: saved });
  return saved;
}

const PHOTO_COOLDOWN_MS = 60_000;

const photoTooSoon = () =>
  new DomainError("PHOTO_TOO_SOON", "You just changed your photo. Try again in a minute.", "photo");

/** Deleting a replaced photo is tidying up: if it fails, the new choice still stands. */
async function removeQuietly(storage: PhotoStorage | null, url: string | null) {
  if (!url || !storage) return;
  try {
    await storage.remove(url);
  } catch (error) {
    logger.error("photo removal failed", errorContext(error));
  }
}

/**
 * Makes an uploaded photo the one people see, replacing (and deleting) any earlier upload. The
 * bytes are checked here whatever the browser did: a JPEG, PNG, or WebP under the size limit.
 * One change a minute, so a stuck button can't run through the storage allowance.
 */
export async function uploadPhoto(
  userId: string,
  bytes: Uint8Array,
  storage: PhotoStorage,
  now = new Date(),
): Promise<string> {
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new DomainError("PHOTO_TOO_LARGE", "That photo is too large. Choose another.", "photo");
  }
  const type = sniffPhotoType(bytes);
  if (!type) {
    throw new DomainError("PHOTO_TYPE", "Choose a JPEG, PNG, or WebP image.", "photo");
  }
  const before = await prisma.profile.findUniqueOrThrow({
    where: { userId },
    select: { photoUrl: true, photoChangedAt: true },
  });
  if (
    before.photoChangedAt &&
    now.getTime() - before.photoChangedAt.getTime() < PHOTO_COOLDOWN_MS
  ) {
    throw photoTooSoon();
  }
  const url = await storage.save(bytes, type);
  // Only if nothing changed meanwhile, so two uploads at once can't strand a photo.
  const { count } = await prisma.profile.updateMany({
    where: { userId, photoChangedAt: before.photoChangedAt },
    data: { photo: "UPLOAD", photoUrl: url, photoChangedAt: now },
  });
  if (count === 0) {
    await removeQuietly(storage, url);
    throw photoTooSoon();
  }
  await removeQuietly(storage, before.photoUrl);
  return url;
}

/** Shows the photo from Google or GitHub, or initials; an uploaded photo is deleted. */
export async function choosePhoto(
  userId: string,
  choice: "PROVIDER" | "NONE",
  storage: PhotoStorage | null,
  now = new Date(),
): Promise<void> {
  const before = await prisma.profile.findUniqueOrThrow({
    where: { userId },
    select: { photoUrl: true },
  });
  await prisma.profile.update({
    where: { userId },
    data: { photo: choice, photoUrl: null, photoChangedAt: now },
  });
  await removeQuietly(storage, before.photoUrl);
}
