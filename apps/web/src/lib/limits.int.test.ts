import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import { purgeRateLimits, takeToken } from "./limits";

const NOW = new Date("2026-11-10T12:00:30Z");
const limit = { key: "test:ada", limit: 3, windowSeconds: 60, message: "Slow down." };

describe("takeToken", () => {
  it("allows the limit within a window, refuses past it, and starts over next window", async () => {
    for (let i = 0; i < 3; i++) await takeToken(limit, NOW);
    await expect(takeToken(limit, NOW)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Slow down.",
    });
    expect(await takeToken(limit, new Date("2026-11-10T12:01:00Z"))).toBeUndefined();
    // Keys are independent.
    expect(await takeToken({ ...limit, key: "test:grace" }, NOW)).toBeUndefined();
    expect(await prisma.rateLimitBucket.count()).toBe(3);
  });

  it("purges windows older than a day", async () => {
    await takeToken(limit, new Date("2026-11-08T12:00:00Z"));
    await takeToken(limit, NOW);
    expect(await purgeRateLimits(NOW)).toBe(1);
    expect(await prisma.rateLimitBucket.count()).toBe(1);
  });

  it("is a DomainError, so actions turn it into a friendly message", async () => {
    for (let i = 0; i < 3; i++) await takeToken(limit, NOW);
    await expect(takeToken(limit, NOW)).rejects.toBeInstanceOf(DomainError);
  });
});
