import { describe, expect, it } from "vitest";
import { publishProblem } from "./schemas";

const a = "0190a2c0-0000-7000-8000-000000000001";
const b = "0190a2c0-0000-7000-8000-000000000002";

describe("publishProblem", () => {
  it("accepts sections that each have problems", () => {
    expect(
      publishProblem({
        sections: [
          { title: "Arrays", problemIds: [a] },
          { title: "Stack", problemIds: [b] },
        ],
      }),
    ).toBeNull();
  });

  it("requires at least one section", () => {
    expect(publishProblem({ sections: [] })).toMatch(/at least one section/);
  });

  it("names the empty section", () => {
    expect(
      publishProblem({
        sections: [
          { title: "Arrays", problemIds: [a] },
          { title: "Graphs", problemIds: [] },
        ],
      }),
    ).toMatch(/"Graphs" has no problems/);
  });

  it("rejects duplicates across sections", () => {
    expect(
      publishProblem({
        sections: [
          { title: "A", problemIds: [a] },
          { title: "B", problemIds: [a] },
        ],
      }),
    ).toMatch(/only once/);
  });
});
