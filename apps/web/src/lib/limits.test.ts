import { describe, expect, it } from "vitest";
import { windowStart } from "./limits";

describe("windowStart", () => {
  it("rounds down to the window the moment falls in", () => {
    const at = new Date("2026-11-10T12:34:56.789Z");
    expect(windowStart(at, 60)).toEqual(new Date("2026-11-10T12:34:00.000Z"));
    expect(windowStart(at, 3600)).toEqual(new Date("2026-11-10T12:00:00.000Z"));
    expect(windowStart(at, 24 * 3600)).toEqual(new Date("2026-11-10T00:00:00.000Z"));
    // The window's first moment is its own start.
    expect(windowStart(new Date("2026-11-10T12:34:00.000Z"), 60)).toEqual(
      new Date("2026-11-10T12:34:00.000Z"),
    );
  });
});
