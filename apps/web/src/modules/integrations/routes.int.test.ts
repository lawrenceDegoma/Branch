import { prisma } from "@branch/database";
import { beforeAll, describe, expect, it } from "vitest";
import { DELETE, GET } from "@/app/api/extension/connection/route";
import { POST } from "@/app/api/extension/submissions/route";
import { GET as runDaily } from "@/app/api/cron/daily/route";
import { createTestUser } from "@/test/factories";
import { createConnection } from "./connections";

// The extension's HTTP contract, end to end through the route handlers.

const CRON_SECRET = "test-cron-secret-0123456789";
beforeAll(() => {
  process.env.CRON_SECRET = CRON_SECRET;
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

  it("refuses requests without a working token", async () => {
    const { token } = await connected();
    for (const t of [null, "brx_wrong", `${token.slice(0, -1)}A`]) {
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
    expect(await response.json()).toEqual({ matched: 0, purged: 0 });
  });
});
