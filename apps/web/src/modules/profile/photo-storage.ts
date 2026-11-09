import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { serverEnv } from "@/lib/env";
import { PHOTO_EXTENSION, type PhotoType } from "./photo";

// Where uploaded profile photos live, behind an interface: Vercel Blob in production (a public
// store; each photo gets an unguessable name), a local folder in development and tests.

export interface PhotoStorage {
  kind: "blob" | "local";
  /** Stores a checked photo and returns the address people load it from. */
  save(bytes: Uint8Array, type: PhotoType): Promise<string>;
  /** Deletes a photo this storage saved; other addresses are ignored. */
  remove(url: string): Promise<void>;
}

const YEAR_SECONDS = 365 * 24 * 60 * 60;

export function blobPhotoStorage(token: string): PhotoStorage {
  return {
    kind: "blob",
    async save(bytes, type) {
      const { url } = await put(
        `photos/${randomUUID()}.${PHOTO_EXTENSION[type]}`,
        Buffer.from(bytes),
        {
          access: "public",
          contentType: type,
          token,
          // A changed photo gets a new name, so a cached one never goes stale.
          cacheControlMaxAge: YEAR_SECONDS,
        },
      );
      return url;
    },
    async remove(url) {
      if (!new URL(url).hostname.endsWith(".public.blob.vercel-storage.com")) return;
      await del(url, { token });
    },
  };
}

export const LOCAL_PHOTO_ROUTE = "/api/photos/";
const LOCAL_NAME = /^[0-9a-f-]{36}\.(webp|jpg|png)$/;
const LOCAL_TYPES: Record<string, PhotoType> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  png: "image/png",
};

export function localPhotoStorage(dir = path.join(process.cwd(), ".photos")): PhotoStorage {
  return {
    kind: "local",
    async save(bytes, type) {
      const name = `${randomUUID()}.${PHOTO_EXTENSION[type]}`;
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), bytes);
      return `${LOCAL_PHOTO_ROUTE}${name}`;
    },
    async remove(url) {
      const name = url.startsWith(LOCAL_PHOTO_ROUTE) ? url.slice(LOCAL_PHOTO_ROUTE.length) : "";
      if (!LOCAL_NAME.test(name)) return;
      await unlink(path.join(dir, name)).catch(() => undefined);
    },
  };
}

/** A photo saved by the local storage, for its route; null for anything else. */
export async function readLocalPhoto(
  name: string,
  dir = path.join(process.cwd(), ".photos"),
): Promise<{ bytes: Uint8Array; type: PhotoType } | null> {
  if (!LOCAL_NAME.test(name)) return null;
  try {
    const bytes = await readFile(path.join(dir, name));
    return { bytes: new Uint8Array(bytes), type: LOCAL_TYPES[name.split(".")[1]!]! };
  } catch {
    return null;
  }
}

/** Blob when its token is set; the local folder outside production; otherwise uploads are off. */
export function photoStorage(): PhotoStorage | null {
  const env = serverEnv();
  if (env.BLOB_READ_WRITE_TOKEN) return blobPhotoStorage(env.BLOB_READ_WRITE_TOKEN);
  if (env.NODE_ENV !== "production") return localPhotoStorage();
  return null;
}
