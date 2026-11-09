import { describe, expect, it } from "vitest";
import { keepChosenName } from "./link";

describe("keepChosenName", () => {
  it("keeps the photo but not the name from a provider callback", () => {
    expect(keepChosenName({ name: "Octo Cat", image: "https://x/a.png" }, "/callback/:id")).toEqual(
      { image: "https://x/a.png" },
    );
  });

  it("leaves every other update alone", () => {
    const update = { name: "Grace Hopper" };
    expect(keepChosenName(update, "/update-user")).toBe(update);
    expect(keepChosenName(update, undefined)).toBe(update);
  });
});
