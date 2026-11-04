import { describe, expect, it } from "vitest";
import { catalogSchema, leetcodeProblemUrl, roadmapDefinitionSchema } from "./catalog";

const section = (problems: string[]) => ({ title: "Arrays", problems });

describe("roadmapDefinitionSchema", () => {
  it("accepts a well-formed definition", () => {
    const result = roadmapDefinitionSchema.safeParse({
      slug: "starter",
      title: "Starter",
      sections: [section(["two-sum", "valid-anagram"])],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a problem listed twice", () => {
    const result = roadmapDefinitionSchema.safeParse({
      slug: "starter",
      title: "Starter",
      sections: [section(["two-sum"]), section(["two-sum"])],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty sections and malformed slugs", () => {
    expect(
      roadmapDefinitionSchema.safeParse({ slug: "s", title: "S", sections: [section([])] }).success,
    ).toBe(false);
    expect(
      roadmapDefinitionSchema.safeParse({ slug: "s", title: "S", sections: [section(["Two Sum"])] })
        .success,
    ).toBe(false);
  });

  it("requires https source URLs", () => {
    const base = { slug: "s", title: "S", sections: [section(["two-sum"])] };
    expect(roadmapDefinitionSchema.safeParse({ ...base, sourceUrl: "http://x.test" }).success).toBe(
      false,
    );
  });
});

describe("catalogSchema", () => {
  it("rejects problems that reference unknown tags", () => {
    const result = catalogSchema.safeParse({
      tags: [{ slug: "stack", name: "Stack" }],
      problems: [
        { slug: "two-sum", title: "Two Sum", difficulty: "EASY", tags: ["arrays-hashing"] },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects duplicate problem slugs", () => {
    const problem = { slug: "two-sum", title: "Two Sum", difficulty: "EASY", tags: [] };
    expect(catalogSchema.safeParse({ tags: [], problems: [problem, problem] }).success).toBe(false);
  });
});

describe("catalog Premium problems", () => {
  const withProblem = (problem: Record<string, unknown>) =>
    catalogSchema.safeParse({
      tags: [],
      problems: [{ slug: "meeting-rooms", title: "Meeting Rooms", difficulty: "EASY", ...problem }],
    });

  it("defaults to not Premium", () => {
    const result = withProblem({});
    expect(result.success && result.data.problems[0]!.premium).toBe(false);
  });

  it("accepts an https free alternative on a Premium problem", () => {
    expect(
      withProblem({ premium: true, freeUrl: "https://www.lintcode.com/problem/920/" }).success,
    ).toBe(true);
  });

  it("rejects insecure free alternatives, and free alternatives on free problems", () => {
    expect(withProblem({ premium: true, freeUrl: "http://example.test/920" }).success).toBe(false);
    expect(withProblem({ freeUrl: "https://www.lintcode.com/problem/920/" }).success).toBe(false);
  });
});

describe("leetcodeProblemUrl", () => {
  it("derives the canonical problem URL", () => {
    expect(leetcodeProblemUrl("two-sum")).toBe("https://leetcode.com/problems/two-sum/");
  });
});
