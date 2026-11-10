import { randomUUID } from "node:crypto";
import { prisma } from "@branch/database";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestUser } from "@/test/factories";
import { type GooglePhotos, refreshGooglePhotos } from "./google-photos";

const NOW = new Date("2026-11-09T12:00:00Z");
const OLD = "https://lh3.googleusercontent.com/a/old=s96-c";
const NEW = "https://lh3.googleusercontent.com/a/new=s96-c";
const GITHUB = "https://avatars.githubusercontent.com/u/1?v=4";

async function person({
  image = OLD as string | null,
  photo = "PROVIDER" as "PROVIDER" | "UPLOAD" | "NONE",
  providerId = "google",
  refreshToken = "refresh" as string | null,
  checkedAt = new Date("2026-11-01T00:00:00Z"),
} = {}) {
  const user = await createTestUser();
  await prisma.user.update({ where: { id: user.id }, data: { image } });
  await prisma.profile.create({
    data: {
      userId: user.id,
      username: `p${user.id.slice(0, 8)}`,
      timezone: "UTC",
      photo,
      photoUrl: photo === "UPLOAD" ? "/api/photos/upload.png" : null,
    },
  });
  const account = await prisma.account.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      providerId,
      accountId: randomUUID(),
      refreshToken,
      updatedAt: checkedAt,
    },
  });
  return { userId: user.id, accountId: account.id };
}

/** Google, answering with the given photo for everyone, and remembering whom it was asked about. */
function fakeGoogle(
  answer: (accountId: string) => string | null,
): GooglePhotos & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async current(account) {
      asked.push(account.id);
      return answer(account.id);
    },
  };
}

const imageOf = async (userId: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { image: true } })).image;

describe("refreshGooglePhotos", () => {
  it("updates the Google photo of people who show theirs", async () => {
    const shown = await person();
    const none = await person({ image: null });
    const google = fakeGoogle(() => NEW);

    expect(await refreshGooglePhotos({ google, now: NOW })).toEqual({
      checked: 2,
      updated: 2,
      failed: 0,
    });
    expect(await imageOf(shown.userId)).toBe(NEW);
    expect(await imageOf(none.userId)).toBe(NEW);

    // Again: nothing new.
    expect(await refreshGooglePhotos({ google, now: NOW })).toEqual({
      checked: 2,
      updated: 0,
      failed: 0,
    });
  });

  it("leaves alone uploads, initials, GitHub photos, and accounts without offline access", async () => {
    const upload = await person({ photo: "UPLOAD" });
    const initials = await person({ photo: "NONE" });
    const github = await person({ image: GITHUB });
    const noAccess = await person({ refreshToken: null });
    const githubOnly = await person({ providerId: "github" });
    const google = fakeGoogle(() => NEW);

    expect(await refreshGooglePhotos({ google, now: NOW })).toEqual({
      checked: 1,
      updated: 0,
      failed: 0,
    });
    // Only the person who shows a GitHub photo was asked about, and kept it.
    expect(google.asked).toEqual([github.accountId]);
    expect(await imageOf(github.userId)).toBe(GITHUB);
    for (const { userId } of [upload, initials, noAccess, githubOnly]) {
      expect(await imageOf(userId)).toBe(OLD);
    }
  });

  it("skips someone Google won't answer for, and still checks everyone else", async () => {
    const revoked = await person();
    const fine = await person();
    const google = fakeGoogle((accountId) => {
      if (accountId === revoked.accountId) throw new Error("invalid_grant");
      return NEW;
    });

    expect(await refreshGooglePhotos({ google, now: NOW })).toEqual({
      checked: 1,
      updated: 1,
      failed: 1,
    });
    expect(await imageOf(revoked.userId)).toBe(OLD);
    expect(await imageOf(fine.userId)).toBe(NEW);
    // Both go to the back of the line.
    const accounts = await prisma.account.findMany({
      where: { id: { in: [revoked.accountId, fine.accountId] } },
    });
    expect(accounts.map((a) => a.updatedAt)).toEqual([NOW, NOW]);
  });

  it("checks the least recently checked first, up to the limit", async () => {
    const recent = await person({ checkedAt: new Date("2026-11-08T00:00:00Z") });
    const oldest = await person({ checkedAt: new Date("2026-10-01T00:00:00Z") });
    const google = fakeGoogle(() => NEW);

    await refreshGooglePhotos({ google, limit: 1, now: NOW });
    expect(google.asked).toEqual([oldest.accountId]);
    await refreshGooglePhotos({ google, limit: 1, now: NOW });
    expect(google.asked).toEqual([oldest.accountId, recent.accountId]);
  });

  it("does nothing without Google sign-in", async () => {
    await person();
    expect(await refreshGooglePhotos({ google: null })).toBeNull();
  });
});

describe("googlePhotos", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("refreshes the stored token through Better Auth, keeps it encrypted, and asks Google", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-google-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-google-secret");
    vi.resetModules();
    const { googlePhotos, refreshGooglePhotos: refresh } = await import("./google-photos");
    const { userId, accountId } = await person({ refreshToken: "refresh-token" });

    // Google's token endpoint, reached by Better Auth through the global fetch.
    const tokenRequests: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input instanceof Request ? input.url : input)).toBe(
        "https://oauth2.googleapis.com/token",
      );
      tokenRequests.push(
        String(init?.body ?? (input instanceof Request ? await input.text() : "")),
      );
      return Response.json({
        access_token: "fresh-access",
        expires_in: 3599,
        token_type: "Bearer",
      });
    });
    const userInfoRequests: string[] = [];
    const userInfo = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      userInfoRequests.push(new Headers(init?.headers).get("authorization") ?? "");
      return Response.json({ sub: "1", picture: NEW });
    }) as typeof fetch;

    expect(await refresh({ google: googlePhotos(userInfo), now: NOW })).toEqual({
      checked: 1,
      updated: 1,
      failed: 0,
    });
    expect(await imageOf(userId)).toBe(NEW);
    expect(tokenRequests).toHaveLength(1);
    expect(new URLSearchParams(tokenRequests[0]).get("refresh_token")).toBe("refresh-token");
    expect(userInfoRequests).toEqual(["Bearer fresh-access"]);
    const stored = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    expect(stored.accessToken).toBeTruthy();
    expect(stored.accessToken).not.toContain("fresh-access");
  });
});
