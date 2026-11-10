import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { describeError, KEEP_DAYS, purgeServerErrors, recordError } from "./service";

const request = {
  path: "/groups/abc?secret=1",
  method: "POST",
  headers: { "x-request-id": "req-1", cookie: "session=private" },
};

describe("server errors", () => {
  it("records where and what, without the query string, bounded", async () => {
    const error = Object.assign(new TypeError("x".repeat(3000)), { digest: "d1" });
    const record = describeError(error, request, "action");
    expect(record).toMatchObject({
      requestId: "req-1",
      digest: "d1",
      path: "/groups/abc",
      method: "POST",
      routeType: "action",
      name: "TypeError",
    });
    expect(record.message).toHaveLength(2000);
    expect(record.stack!.length).toBeLessThanOrEqual(4000);
    expect(JSON.stringify(record)).not.toContain("private");
    await recordError(record);
    expect(await prisma.serverError.count()).toBe(1);
  });

  it("copes with things that aren't errors, and a missing request ID", async () => {
    const record = describeError("boom", { path: "/", method: "GET", headers: {} }, "render");
    expect(record).toMatchObject({ requestId: null, digest: null, name: "Error", message: "boom" });
    await recordError(record);
    expect(await prisma.serverError.count()).toBe(1);
  });

  it("purges records older than the keep period", async () => {
    const now = new Date("2026-11-10T12:00:00Z");
    await prisma.serverError.createMany({
      data: [
        { at: new Date(now.getTime() - (KEEP_DAYS + 1) * 86_400_000), ...stub("old") },
        { at: now, ...stub("new") },
      ],
    });
    expect(await purgeServerErrors(now)).toBe(1);
    expect((await prisma.serverError.findMany()).map((r) => r.message)).toEqual(["new"]);
  });

  it("is bounded by the database too", async () => {
    await expect(
      prisma.serverError.create({ data: { ...stub("x"), path: "p".repeat(501) } }),
    ).rejects.toThrow(/server_error_lengths/);
  });
});

const stub = (message: string) => ({
  path: "/",
  method: "GET",
  routeType: "render",
  name: "Error",
  message,
});
