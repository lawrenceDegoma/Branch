import { describe, expect, it } from "vitest";
import { formatRelative } from "./format";

describe("formatRelative", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("uses short units for the last week", () => {
    expect(formatRelative(ago(20_000), now, "UTC")).toBe("now");
    expect(formatRelative(ago(5 * 60_000), now, "UTC")).toBe("5m");
    expect(formatRelative(ago(3 * 3_600_000), now, "UTC")).toBe("3h");
    expect(formatRelative(ago(2 * 86_400_000), now, "UTC")).toBe("2d");
  });

  it("falls back to a date, with the year only when it differs", () => {
    expect(formatRelative(new Date("2026-10-01T12:00:00Z"), now, "UTC")).toBe("Oct 1");
    expect(formatRelative(new Date("2025-10-01T12:00:00Z"), now, "UTC")).toBe("Oct 1, 2025");
  });

  it("never shows negative times for clocks slightly ahead", () => {
    expect(formatRelative(new Date(now.getTime() + 5000), now, "UTC")).toBe("now");
  });
});
