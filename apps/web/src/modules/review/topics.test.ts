import { describe, expect, it } from "vitest";
import type { ReviewOutcome } from "./schedule";
import { needsPractice, practiceReason, topicStandings, type TopicRef } from "./topics";

const window: TopicRef = { slug: "sliding-window", name: "Sliding Window" };
const stack: TopicRef = { slug: "stack", name: "Stack" };
const trees: TopicRef = { slug: "trees", name: "Trees" };

const reviewsOf = (topic: TopicRef, ...outcomes: ReviewOutcome[]) =>
  outcomes.map((outcome) => ({ outcome, topics: [topic] }));

const totals = new Map([
  [window.slug, { topic: window, total: 6 }],
  [stack.slug, { topic: stack, total: 7 }],
  [trees.slug, { topic: trees, total: 15 }],
]);

describe("needsPractice", () => {
  it("flags struggling on at least half of the recent reviews, or on two of them", () => {
    expect(needsPractice(1, 1)).toBe(true);
    expect(needsPractice(2, 1)).toBe(true);
    expect(needsPractice(3, 1)).toBe(false);
    expect(needsPractice(5, 2)).toBe(true);
    expect(needsPractice(4, 0)).toBe(false);
    expect(needsPractice(0, 0)).toBe(false);
  });
});

describe("topicStandings", () => {
  it("counts only the latest reviews in each topic, so improvement shows", () => {
    // Newest first: five good reviews, then (older) three struggles that no longer count.
    const [standing] = topicStandings({
      attempts: reviewsOf(window, "GOOD", "EASY", "GOOD", "GOOD", "GOOD", "AGAIN", "AGAIN", "HARD"),
      solvedByTopic: new Map([[window.slug, 3]]),
      totalByTopic: totals,
    });
    expect(standing).toMatchObject({ reviews: 5, struggled: 0, status: "going-well" });
  });

  it("puts topics needing practice first, the most struggled first, then the rest by name", () => {
    const standings = topicStandings({
      attempts: [
        ...reviewsOf(stack, "HARD", "GOOD"),
        ...reviewsOf(window, "AGAIN", "HARD", "GOOD"),
        ...reviewsOf(trees, "GOOD"),
      ],
      solvedByTopic: new Map([
        [stack.slug, 2],
        [window.slug, 3],
        [trees.slug, 1],
        ["missing", 1],
      ]),
      totalByTopic: new Map([
        ...totals,
        ["missing", { topic: { slug: "missing", name: "Arrays" }, total: 9 }],
      ]),
    });
    expect(standings.map((s) => [s.topic.name, s.status])).toEqual([
      ["Sliding Window", "needs-practice"],
      ["Stack", "needs-practice"],
      ["Arrays", "not-reviewed"],
      ["Trees", "going-well"],
    ]);
    expect(standings[0]).toMatchObject({ solved: 3, total: 6, reviews: 3, struggled: 2 });
  });

  it("counts a review toward each of its problem's topics", () => {
    const standings = topicStandings({
      attempts: [{ outcome: "AGAIN", topics: [stack, trees] }],
      solvedByTopic: new Map(),
      totalByTopic: totals,
    });
    expect(standings.map((s) => s.topic.slug)).toEqual(["stack", "trees"]);
    expect(standings.every((s) => s.status === "needs-practice")).toBe(true);
  });
});

describe("practiceReason", () => {
  const base = { topic: window, solved: 2, total: 6, status: "needs-practice" as const };
  it("explains the count", () => {
    expect(practiceReason({ ...base, reviews: 3, struggled: 2 })).toBe(
      "You struggled on 2 of your last 3 Sliding Window reviews.",
    );
    expect(practiceReason({ ...base, reviews: 2, struggled: 2 })).toBe(
      "You struggled on both of your last 2 Sliding Window reviews.",
    );
    expect(practiceReason({ ...base, reviews: 4, struggled: 4 })).toBe(
      "You struggled on all of your last 4 Sliding Window reviews.",
    );
    expect(practiceReason({ ...base, reviews: 1, struggled: 1 })).toBe(
      "You struggled on your one Sliding Window review so far.",
    );
  });
});
