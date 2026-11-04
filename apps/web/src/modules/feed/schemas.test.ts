import { describe, expect, it } from "vitest";
import { createPostSchema, editPostSchema } from "./schemas";

const groupId = "0195f3a0-0000-7000-8000-000000000001";

describe("post schemas", () => {
  it("reads the spoiler checkbox as ticked only when the form sends it", () => {
    const parse = (spoiler?: string) =>
      createPostSchema.parse({ groupId, body: "hi", problemId: "", spoiler }).spoiler;
    expect(parse("on")).toBe(true);
    expect(parse("")).toBe(false);
    expect(parse(undefined)).toBe(false);
  });

  it("lets an edit clear the spoiler mark", () => {
    expect(editPostSchema.parse({ postId: groupId, body: "hi", spoiler: "" })).toEqual({
      postId: groupId,
      body: "hi",
      spoiler: false,
    });
  });
});
