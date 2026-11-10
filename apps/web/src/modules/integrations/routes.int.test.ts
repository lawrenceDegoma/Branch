import { prisma } from "@branch/database";
import { describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "@/app/api/extension/connection/route";
import { POST } from "@/app/api/extension/submissions/route";
import { GET as runDaily } from "@/app/api/cron/daily/route";
import { createTestUser } from "@/test/factories";
import { createConnection } from "./connections";

// The extension's HTTP contract, end to end through the route handlers.

// Set before the routes load: the server environment is read once, when the auth module loads.
// Without Google sign-in, the daily job has no photos to check.
const CRON_SECRET = vi.hoisted(() => {
  const secret = "test-cron-secret-0123456789";
  process.env.CRON_SECRET = secret;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  return secret;
});

const body = (overrides: Record<string, unknown> = {}) => ({
  verdict: "ACCEPTED",
  submissionId: "2189874571",
  problemSlug: "contains-duplicate",
  language: "python3",
  code: "print(1)",
  submittedAt: Math.floor(Date.now() / 1000),
  ...overrides,
});

const send = (token: string | null, payload: unknown, raw = false) =>
  POST(
    new Request("http://localhost/api/extension/submissions", {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: raw ? (payload as string) : JSON.stringify(payload),
    }),
  );

async function connected() {
  const user = await createTestUser({ name: "Ada" });
  const { token } = await createConnection(user.id);
  return { user, token };
}

describe("POST /api/extension/submissions", () => {
  it("accepts a valid submission once", async () => {
    const { token } = await connected();
    await prisma.problem.create({
      data: {
        leetcodeSlug: "contains-duplicate",
        title: "Contains Duplicate",
        difficulty: "EASY",
        source: "SEED",
      },
    });
    const first = await send(token, body());
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toEqual({ stored: "new", counted: true });
    expect(await (await send(token, body())).json()).toEqual({
      stored: "duplicate",
      counted: true,
    });
  });

  it("takes neetcode.io submissions, and treats ones without a source (before 1.1.0) as LeetCode", async () => {
    const { user, token } = await connected();
    expect((await send(token, body())).status).toBe(200);
    expect(
      (await send(token, body({ source: "NEETCODE", submissionId: "1793898662313" }))).status,
    ).toBe(200);
    expect((await send(token, body({ source: "HACKERRANK" }))).status).toBe(400);
    const rows = await prisma.submission.findMany({ where: { userId: user.id } });
    expect(rows.map((r) => r.source).sort()).toEqual(["LEETCODE", "NEETCODE"]);
  });

  it("keeps the time spent from extension 1.2.0, once, and none from older versions", async () => {
    const { user, token } = await connected();
    expect((await send(token, body({ timeSpentSeconds: 1440 }))).status).toBe(200);
    // A retry with another time doesn't change the stored one.
    expect((await send(token, body({ timeSpentSeconds: 99 }))).status).toBe(200);
    expect((await send(token, body({ submissionId: "2189874572" }))).status).toBe(200);
    const rows = await prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { externalId: "asc" },
    });
    expect(rows.map((r) => r.timeSpentSeconds)).toEqual([1440, null]);
    // The database holds the same range.
    await expect(
      prisma.submission.update({ where: { id: rows[1]!.id }, data: { timeSpentSeconds: 0 } }),
    ).rejects.toThrow(/submission_time_spent/);
  });

  it("refuses requests without a working token", async () => {
    const { token } = await connected();
    // A token one character off (always a different character, so never the real one).
    const altered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    for (const t of [null, "brx_wrong", altered]) {
      const response = await send(t, body());
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    }
    expect(await prisma.submission.count()).toBe(0);
  });

  it("rejects malformed and oversized bodies without storing anything", async () => {
    const { token } = await connected();
    const cases: [unknown, boolean, number][] = [
      ["{not json", true, 400],
      [body({ verdict: "WRONG_ANSWER" }), false, 400],
      [body({ submissionId: "runcode_123" }), false, 400],
      [body({ problemSlug: "../etc" }), false, 400],
      [body({ code: "" }), false, 400],
      [body({ extra: "field" }), false, 400],
      [body({ submittedAt: "yesterday" }), false, 400],
      [body({ timeSpentSeconds: 0 }), false, 400],
      [body({ timeSpentSeconds: 86_401 }), false, 400],
      [body({ timeSpentSeconds: 12.5 }), false, 400],
      [body({ code: "x".repeat(300_000) }), false, 413],
    ];
    for (const [payload, raw, status] of cases) {
      expect((await send(token, payload, raw)).status).toBe(status);
    }
    expect(await prisma.submission.count()).toBe(0);
  });
});

describe("/api/extension/connection", () => {
  const call = (handler: typeof GET, token: string) =>
    handler(
      new Request("http://localhost/api/extension/connection", {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

  it("names the connected account, and disconnecting revokes the token", async () => {
    const { token } = await connected();
    expect(await (await call(GET, token)).json()).toMatchObject({ name: "Ada" });
    expect((await call(DELETE, token)).status).toBe(200);
    expect((await call(GET, token)).status).toBe(401);
    expect((await send(token, body())).status).toBe(401);
  });
});

describe("GET /api/cron/daily", () => {
  const run = (authorization?: string) =>
    runDaily(
      new Request("http://localhost/api/cron/daily", {
        headers: authorization ? { authorization } : {},
      }),
    );

  it("runs only with Vercel's secret", async () => {
    expect((await run()).status).toBe(401);
    expect((await run("Bearer wrong")).status).toBe(401);
    const response = await run(`Bearer ${CRON_SECRET}`);
    expect(response.status).toBe(200);
    // No analyzer or Google sign-in is configured in tests, so those steps report null.
    expect(await response.json()).toEqual({
      matched: 0,
      purged: 0,
      unusedResults: 0,
      analysis: null,
      photos: null,
      oldErrors: 0,
      oldLimits: 0,
    });
  });
});
