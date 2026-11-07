import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/branch",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseServerEnv", () => {
  it("accepts a complete configuration", () => {
    const env = parseServerEnv(valid);
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.NODE_ENV).toBe("development");
    expect(env.GITHUB_CLIENT_ID).toBeUndefined();
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-postgres URL", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: "mysql://u:p@localhost/b" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("rejects a short auth secret", () => {
    expect(() => parseServerEnv({ ...valid, BETTER_AUTH_SECRET: "short" })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("treats a blank CRON_SECRET as absent and rejects a short one", () => {
    expect(parseServerEnv({ ...valid, CRON_SECRET: " " }).CRON_SECRET).toBeUndefined();
    expect(parseServerEnv({ ...valid, CRON_SECRET: "x".repeat(16) }).CRON_SECRET).toHaveLength(16);
    expect(() => parseServerEnv({ ...valid, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);
  });

  it("accepts only a Chrome Web Store link for the extension", () => {
    const url =
      "https://chromewebstore.google.com/detail/branch-for-leetcode/abcdefghijklmnopabcdefghijklmnop";
    expect(parseServerEnv({ ...valid, EXTENSION_STORE_URL: url }).EXTENSION_STORE_URL).toBe(url);
    expect(
      parseServerEnv({ ...valid, EXTENSION_STORE_URL: "" }).EXTENSION_STORE_URL,
    ).toBeUndefined();
    for (const bad of [
      "http://chromewebstore.google.com/x",
      "https://example.com/x",
      "not a url",
    ]) {
      expect(() => parseServerEnv({ ...valid, EXTENSION_STORE_URL: bad })).toThrow(
        /EXTENSION_STORE_URL/,
      );
    }
  });

  it("takes the analyzer's address and secret as a pair, https except on localhost", () => {
    const secret = "s".repeat(32);
    const env = parseServerEnv({
      ...valid,
      ANALYZER_URL: "https://branch-analyzer.vercel.app",
      ANALYZER_SECRET: secret,
    });
    expect(env.ANALYZER_URL).toBe("https://branch-analyzer.vercel.app");
    expect(
      parseServerEnv({ ...valid, ANALYZER_URL: "http://localhost:8000", ANALYZER_SECRET: secret })
        .ANALYZER_URL,
    ).toBe("http://localhost:8000");
    expect(parseServerEnv({ ...valid, ANALYZER_URL: "", ANALYZER_SECRET: "" }).ANALYZER_URL).toBe(
      undefined,
    );
    expect(() =>
      parseServerEnv({ ...valid, ANALYZER_URL: "http://example.com", ANALYZER_SECRET: secret }),
    ).toThrow(/ANALYZER_URL/);
    expect(() => parseServerEnv({ ...valid, ANALYZER_URL: "https://a.example" })).toThrow(
      /ANALYZER_URL/,
    );
    expect(() =>
      parseServerEnv({ ...valid, ANALYZER_URL: "https://a.example", ANALYZER_SECRET: "short" }),
    ).toThrow(/ANALYZER_SECRET/);
  });

  it("treats blank GitHub credentials as absent", () => {
    const env = parseServerEnv({ ...valid, GITHUB_CLIENT_ID: " ", GITHUB_CLIENT_SECRET: "" });
    expect(env.GITHUB_CLIENT_ID).toBeUndefined();
  });

  it("requires GitHub credentials as a pair", () => {
    expect(() => parseServerEnv({ ...valid, GITHUB_CLIENT_ID: "abc" })).toThrow(/GITHUB_CLIENT_ID/);
  });

  it("never includes variable values in the error", () => {
    const secret = "not-a-url-but-a-secret-value";
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: secret })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });
  it("requires both Google credentials or neither", () => {
    expect(() => parseServerEnv({ ...valid, GOOGLE_CLIENT_SECRET: "abc" })).toThrow(
      /GOOGLE_CLIENT_ID/,
    );
    const env = parseServerEnv({ ...valid, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" });
    expect(env.GOOGLE_CLIENT_ID).toBe("id");
  });
});
