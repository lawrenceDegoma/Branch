import { describe, expect, it } from "vitest";
import { keepChosenIdentity } from "./link";

// The updates Better Auth (1.7) makes from an OAuth callback; recheck when upgrading it.
describe("keepChosenIdentity", () => {
  it("keeps the photo but not the name from connecting a provider", () => {
    expect(
      keepChosenIdentity({ name: "Octo Cat", image: "https://x/a.png" }, "/callback/:id"),
    ).toEqual({ image: "https://x/a.png" });
  });

  it("keeps the photo but not the name or email from signing in again", () => {
    const update = {
      name: "Octo Cat",
      image: "https://x/b.png",
      email: "octo@github.example",
      emailVerified: true,
      updatedAt: new Date(0),
    };
    expect(keepChosenIdentity(update, "/callback/:id")).toEqual({
      image: "https://x/b.png",
      updatedAt: new Date(0),
    });
  });

  it("lets a provider confirm the same email", () => {
    expect(keepChosenIdentity({ emailVerified: true }, "/callback/:id")).toEqual({
      emailVerified: true,
    });
  });

  it("leaves every other update alone", () => {
    const update = { name: "Grace Hopper", email: "grace@example.test" };
    expect(keepChosenIdentity(update, "/update-user")).toBe(update);
    expect(keepChosenIdentity(update, undefined)).toBe(update);
  });
});
