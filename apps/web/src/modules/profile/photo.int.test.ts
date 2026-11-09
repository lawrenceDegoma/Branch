import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { createTestUser } from "@/test/factories";
import type { PhotoStorage } from "./photo-storage";
import { choosePhoto, uploadPhoto } from "./service";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const NOW = new Date("2026-11-09T12:00:00Z");
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

/** Remembers what it holds, like Blob would. */
function memoryStorage(): PhotoStorage & { held: Set<string> } {
  const held = new Set<string>();
  let next = 0;
  return {
    kind: "local",
    held,
    async save() {
      const url = `/api/photos/${String(++next).padStart(8, "0")}-0000-0000-0000-000000000000.png`;
      held.add(url);
      return url;
    },
    async remove(url) {
      held.delete(url);
    },
  };
}

async function person() {
  const user = await createTestUser();
  await prisma.profile.create({
    data: { userId: user.id, username: `p${user.id.slice(0, 8)}`, timezone: "UTC" },
  });
  return user;
}

const profileOf = (userId: string) =>
  prisma.profile.findUniqueOrThrow({
    where: { userId },
    select: { photo: true, photoUrl: true },
  });

describe("profile photos", () => {
  it("replaces an upload and deletes the old one", async () => {
    const user = await person();
    const storage = memoryStorage();
    const first = await uploadPhoto(user.id, PNG, storage, NOW);
    expect(await profileOf(user.id)).toEqual({ photo: "UPLOAD", photoUrl: first });

    const second = await uploadPhoto(user.id, PNG, storage, later(61));
    expect(await profileOf(user.id)).toEqual({ photo: "UPLOAD", photoUrl: second });
    expect([...storage.held]).toEqual([second]);
  });

  it("allows one change a minute", async () => {
    const user = await person();
    const storage = memoryStorage();
    await uploadPhoto(user.id, PNG, storage, NOW);
    await expect(uploadPhoto(user.id, PNG, storage, later(30))).rejects.toMatchObject({
      code: "PHOTO_TOO_SOON",
    });
    expect(storage.held.size).toBe(1);
  });

  it("refuses anything but a small JPEG, PNG, or WebP", async () => {
    const user = await person();
    const storage = memoryStorage();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    await expect(uploadPhoto(user.id, svg, storage, NOW)).rejects.toMatchObject({
      code: "PHOTO_TYPE",
    });
    const huge = new Uint8Array(200_001);
    huge.set(PNG);
    await expect(uploadPhoto(user.id, huge, storage, NOW)).rejects.toMatchObject({
      code: "PHOTO_TOO_LARGE",
    });
    expect(storage.held.size).toBe(0);
    expect(await profileOf(user.id)).toEqual({ photo: "PROVIDER", photoUrl: null });
  });

  it("choosing the provider's photo or initials deletes the upload", async () => {
    const user = await person();
    const storage = memoryStorage();
    await uploadPhoto(user.id, PNG, storage, NOW);
    await choosePhoto(user.id, "NONE", storage, later(5));
    expect(await profileOf(user.id)).toEqual({ photo: "NONE", photoUrl: null });
    expect(storage.held.size).toBe(0);
    await choosePhoto(user.id, "PROVIDER", storage, later(10));
    expect(await profileOf(user.id)).toEqual({ photo: "PROVIDER", photoUrl: null });
  });

  it("the database keeps an upload's address exactly while the upload is chosen", async () => {
    const user = await person();
    const set = (data: { photo: "PROVIDER" | "UPLOAD" | "NONE"; photoUrl: string | null }) =>
      prisma.profile.update({ where: { userId: user.id }, data });
    await expect(set({ photo: "UPLOAD", photoUrl: null })).rejects.toThrow();
    await expect(set({ photo: "NONE", photoUrl: "https://x.example/a.png" })).rejects.toThrow();
    await expect(set({ photo: "UPLOAD", photoUrl: "http://x.example/a.png" })).rejects.toThrow();
    await expect(set({ photo: "UPLOAD", photoUrl: "javascript:alert(1)" })).rejects.toThrow();
    await set({ photo: "UPLOAD", photoUrl: "https://x.public.blob.vercel-storage.com/a.png" });
    await set({ photo: "NONE", photoUrl: null });
  });
});
