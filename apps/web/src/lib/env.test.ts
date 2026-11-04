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
