import { describe, expect, it } from "vitest";
import { suggestUsername, usernameSchema } from "./username";

describe("usernameSchema", () => {
  it("normalizes case and whitespace", () => {
    expect(usernameSchema.parse("  Ada_Lovelace ")).toBe("ada_lovelace");
  });

  it.each(["ab", "a".repeat(31), "-ada", "ada-", "ada lovelace", "ada!", "ádá"])(
    "rejects %s",
    (value) => {
      expect(usernameSchema.safeParse(value).success).toBe(false);
    },
  );

  it("rejects reserved names", () => {
    expect(usernameSchema.safeParse("Settings").success).toBe(false);
  });

  it("accepts the full allowed alphabet", () => {
    expect(usernameSchema.parse("a1-b_2c")).toBe("a1-b_2c");
  });
});

describe("suggestUsername", () => {
  it("derives a handle from an email local part", () => {
    const email = "Grace.Hopper@example.com"; // taste-skill-ignore: RFC 2606 test domain
    expect(suggestUsername(email)).toBe("grace-hopper");
  });

  it("strips accents and trims separators", () => {
    expect(suggestUsername("  José Núñez  ")).toBe("jose-nunez");
  });

  it("returns an empty string when nothing usable remains", () => {
    expect(suggestUsername("!!")).toBe("");
    expect(suggestUsername("admin")).toBe("");
  });
});
