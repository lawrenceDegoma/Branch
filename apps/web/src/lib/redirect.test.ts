import { describe, expect, it } from "vitest";
import { safeNextPath, signInPath } from "./redirect";

describe("safeNextPath", () => {
  it.each(["/home", "/groups/abc?tab=members", "/roadmaps#week-3"])("accepts %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    ["protocol-relative", "//evil.example"],
    ["backslash", "/\\evil.example"],
    ["absolute URL", "https://evil.example/home"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative path", "home"],
    ["tab smuggling", "/\t/evil.example"],
    ["empty", ""],
    ["non-string", 42],
    ["overlong", `/${"a".repeat(600)}`],
  ])("rejects %s", (_label, value) => {
    expect(safeNextPath(value)).toBeNull();
  });
});

describe("signInPath", () => {
  it("carries a safe return path", () => {
    expect(signInPath("/groups/abc")).toBe("/sign-in?next=%2Fgroups%2Fabc");
  });

  it("drops unsafe or empty return paths", () => {
    expect(signInPath("//evil.example")).toBe("/sign-in");
    expect(signInPath(undefined)).toBe("/sign-in");
  });
});
