import { describe, expect, it } from "vitest";
import { generateAssignments, weekCount } from "./generate";

const sections = [{ itemIds: ["a", "b", "c"] }, { itemIds: [] }, { itemIds: ["d", "e"] }];

describe("generateAssignments", () => {
  it("fills weeks in roadmap order, N problems at a time", () => {
    expect(generateAssignments(sections, { mode: "PER_WEEK", problemsPerWeek: 2 })).toEqual([
      { itemId: "a", weekNumber: 1 },
      { itemId: "b", weekNumber: 1 },
      { itemId: "c", weekNumber: 2 },
      { itemId: "d", weekNumber: 2 },
      { itemId: "e", weekNumber: 3 },
    ]);
  });

  it("gives each non-empty section its own week", () => {
    expect(generateAssignments(sections, { mode: "PER_SECTION" }).map((a) => a.weekNumber)).toEqual(
      [1, 1, 1, 2, 2],
    );
  });

  it("assigns every item exactly once", () => {
    const result = generateAssignments(sections, { mode: "PER_WEEK", problemsPerWeek: 4 });
    expect(result.map((a) => a.itemId)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("weekCount", () => {
  it("matches the generated schedule", () => {
    expect(weekCount([3, 0, 2], { mode: "PER_WEEK", problemsPerWeek: 2 })).toBe(3);
    expect(weekCount([3, 0, 2], { mode: "PER_SECTION" })).toBe(2);
    expect(weekCount([22], { mode: "PER_WEEK", problemsPerWeek: 4 })).toBe(6);
  });
});
