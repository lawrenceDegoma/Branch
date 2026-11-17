import { describe, expect, it } from "vitest";
import { mightBeLong } from "./fold";

describe("long posts", () => {
  it("fold past 12 lines or 900 characters", () => {
    expect(mightBeLong("A short question about two pointers.")).toBe(false);
    expect(mightBeLong(Array.from({ length: 12 }, () => "line").join("\n"))).toBe(false);
    expect(mightBeLong(Array.from({ length: 13 }, () => "line").join("\n"))).toBe(true);
    expect(mightBeLong("x".repeat(900))).toBe(false);
    expect(mightBeLong("x".repeat(901))).toBe(true);
  });
});
