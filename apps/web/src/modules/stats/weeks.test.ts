import { describe, expect, it } from "vitest";
import { fillWeeks, lastWeeks } from "./weeks";

describe("weekly buckets", () => {
  it("ends with this week, starting on Mondays", () => {
    // Wednesday 2026-11-11.
    const weeks = lastWeeks("2026-11-11", 3);
    expect(weeks).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    // A Monday is its own week's start; a Sunday belongs to the week before.
    expect(lastWeeks("2026-11-09", 1)).toEqual(["2026-11-09"]);
    expect(lastWeeks("2026-11-15", 1)).toEqual(["2026-11-09"]);
    expect(lastWeeks("2026-11-11")).toHaveLength(12);
  });

  it("fills weeks with nothing in them, and ignores rows outside the range", () => {
    expect(
      fillWeeks(
        ["2026-11-02", "2026-11-09"],
        [
          { week: "2026-11-09", value: 4 },
          { week: "2026-10-01", value: 9 },
        ],
      ),
    ).toEqual([
      { week: "2026-11-02", value: 0 },
      { week: "2026-11-09", value: 4 },
    ]);
  });
});
