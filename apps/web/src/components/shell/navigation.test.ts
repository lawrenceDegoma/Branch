import { describe, expect, it } from "vitest";
import { isActivePath } from "./navigation";

describe("isActivePath", () => {
  it("matches the exact route", () => {
    expect(isActivePath("/groups", "/groups")).toBe(true);
  });

  it("matches nested routes", () => {
    expect(isActivePath("/groups/abc123/settings", "/groups")).toBe(true);
  });

  it("does not match routes that only share a prefix", () => {
    expect(isActivePath("/groupsettings", "/groups")).toBe(false);
  });

  it("does not match unrelated routes", () => {
    expect(isActivePath("/roadmaps", "/groups")).toBe(false);
  });
});
