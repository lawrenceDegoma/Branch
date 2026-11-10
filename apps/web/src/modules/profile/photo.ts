// Profile photos: which one people see, and what an upload must look like. Pure, so the browser
// (resizing before upload) and the server (checking the upload) agree.

/** Uploads are resized in the browser to this square, in pixels. */
export const PHOTO_SIZE = 256;
/** A resized photo is well under this; anything bigger wasn't resized by Branch. */
export const MAX_PHOTO_BYTES = 200_000;

export type PhotoType = "image/webp" | "image/jpeg" | "image/png";
export const PHOTO_EXTENSION: Record<PhotoType, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

/**
 * The image type an upload really is, from its first bytes (never from the name or the type the
 * browser claims). Only formats a browser shows safely; SVG, which can carry scripts, isn't one.
 */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF", four bytes of length, "WEBP".
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

export type PhotoChoiceValue = "PROVIDER" | "UPLOAD" | "NONE";

/** What a query needs to know which photo to show for a person. */
export const photoSelect = {
  image: true,
  profile: { select: { photo: true, photoUrl: true } },
} as const;

/**
 * The photo people see for someone: their upload, or the one from Google or GitHub (Better Auth's
 * `user.image`, shown only over https), or none (initials) if they chose that.
 */
export function shownPhoto(user: {
  image: string | null;
  profile: { photo: PhotoChoiceValue; photoUrl: string | null } | null;
}): string | null {
  const choice = user.profile?.photo ?? "PROVIDER";
  if (choice === "NONE") return null;
  if (choice === "UPLOAD") return user.profile?.photoUrl ?? null;
  return user.image?.startsWith("https://") ? user.image : null;
}

const MAX_PHOTO_URL_LENGTH = 2048;

function isGooglePhoto(url: string) {
  try {
    return new URL(url).hostname.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

/**
 * What the daily check stores as someone's provider photo, given the one Branch has and the one
 * Google has now; null leaves it as it is. Only a photo that came from Google (or none) is
 * replaced, so someone who last signed in with GitHub keeps GitHub's, and only by a different
 * https address.
 */
export function newGooglePhoto(current: string | null, latest: string | null): string | null {
  if (current !== null && !isGooglePhoto(current)) return null;
  if (!latest || latest === current || latest.length > MAX_PHOTO_URL_LENGTH) return null;
  return latest.startsWith("https://") ? latest : null;
}
