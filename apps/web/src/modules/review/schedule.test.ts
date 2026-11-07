import { describe, expect, it } from "vitest";
import {
  DEFAULT_EASE,
  describeGap,
  FIRST_REVIEW_DAYS,
  MAX_EASE,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  nextReview,
  reviewChoices,
} from "./schedule";

const fresh = { intervalDays: FIRST_REVIEW_DAYS, ease: DEFAULT_EASE };

describe("nextReview", () => {
  it("brings a problem you couldn't solve back tomorrow and lowers its ease", () => {
    expect(nextReview(fresh, "AGAIN")).toEqual({ intervalDays: 1, ease: 230 });
  });

  it("stretches the gap a little after a struggle", () => {
    expect(nextReview(fresh, "HARD")).toEqual({ intervalDays: 4, ease: 235 });
    expect(nextReview({ intervalDays: 1, ease: 230 }, "HARD").intervalDays).toBe(2);
  });

  it("multiplies the gap by the ease after a solve", () => {
    expect(nextReview(fresh, "GOOD")).toEqual({ intervalDays: 8, ease: 250 });
    expect(nextReview({ intervalDays: 8, ease: 250 }, "GOOD").intervalDays).toBe(20);
  });

  it("stretches further and raises the ease when it was easy", () => {
    expect(nextReview(fresh, "EASY")).toEqual({ intervalDays: 10, ease: 265 });
  });

  it("always moves a solved problem at least one day further out", () => {
    expect(nextReview({ intervalDays: 1, ease: MIN_EASE }, "GOOD").intervalDays).toBe(2);
  });

  it("keeps gaps and ease within bounds", () => {
    expect(nextReview({ intervalDays: 150, ease: MAX_EASE }, "EASY")).toEqual({
      intervalDays: MAX_INTERVAL_DAYS,
      ease: MAX_EASE,
    });
    expect(nextReview({ intervalDays: 2, ease: MIN_EASE }, "AGAIN").ease).toBe(MIN_EASE);
  });
});

describe("reviewChoices", () => {
  it("lists every outcome in order with its gap", () => {
    expect(reviewChoices(fresh)).toEqual([
      { outcome: "AGAIN", days: 1 },
      { outcome: "HARD", days: 4 },
      { outcome: "GOOD", days: 8 },
      { outcome: "EASY", days: 10 },
    ]);
  });
});

describe("describeGap", () => {
  it("reads naturally", () => {
    expect(describeGap(1)).toBe("tomorrow");
    expect(describeGap(8)).toBe("in 8 days");
    expect(describeGap(90)).toBe("in 3 months");
  });
});
