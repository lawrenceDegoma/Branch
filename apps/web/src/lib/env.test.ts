import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

describe("parseServerEnv", () => {
  it("accepts a postgres connection string", () => {
    const env = parseServerEnv({ DATABASE_URL: "postgresql://u:p@localhost:5432/branch" });
    expect(env.DATABASE_URL).toBe("postgresql://u:p@localhost:5432/branch");
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-postgres URL", () => {
    expect(() => parseServerEnv({ DATABASE_URL: "mysql://u:p@localhost/branch" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("never includes variable values in the error", () => {
    const secret = "not-a-url-but-a-secret-value";
    expect(() => parseServerEnv({ DATABASE_URL: secret })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });
});
