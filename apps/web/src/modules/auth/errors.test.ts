import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { authErrorMessage, GENERIC_AUTH_ERROR } from "./errors";

describe("authErrorMessage", () => {
  it("maps known Better Auth codes", () => {
    const error = new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "x" });
    expect(authErrorMessage(error)).toMatch(/don't match/);
  });

  it("reports rate limiting", () => {
    expect(authErrorMessage(new APIError("TOO_MANY_REQUESTS"))).toMatch(/Too many attempts/);
  });

  it("falls back to a generic message for unknown codes", () => {
    const error = new APIError("BAD_REQUEST", {
      code: "SOMETHING_NEW",
      message: "internal detail",
    });
    expect(authErrorMessage(error)).toBe(GENERIC_AUTH_ERROR);
  });

  it("never echoes non-API errors", () => {
    expect(authErrorMessage(new Error("connection string postgres://secret"))).toBe(
      GENERIC_AUTH_ERROR,
    );
  });
});
