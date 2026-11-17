import { describe, expect, it } from "vitest";
import { ordinal, rankRows, standingOf } from "./standing";

const row = (id: string, solved: number, members = 5) => ({ id, name: id, members, solved });

describe("ranking", () => {
  it("shares a rank between ties and skips the places they take", () => {
    const ranked = rankRows([row("a", 30), row("b", 20), row("c", 20), row("d", 10), row("e", 0)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 2, 4, 5]);
  });

  it("averages per member to one decimal place", () => {
    expect(rankRows([row("a", 10, 6)])[0]!.perMember).toBe(1.7);
    expect(rankRows([row("a", 0, 5)])[0]!.perMember).toBe(0);
  });

  it("finds the viewer's own organization, or says it's too small to list", () => {
    const ranked = rankRows([row("a", 3), row("b", 1)]);
    expect(standingOf(ranked, null)).toEqual({ status: "none" });
    expect(standingOf(ranked, { id: "b", name: "B" })).toMatchObject({
      status: "ranked",
      of: 2,
      row: { rank: 2 },
    });
    // Too small: only the name, never how many members it has.
    expect(standingOf(ranked, { id: "z", name: "Z" })).toEqual({ status: "too-small", name: "Z" });
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "103rd",
    ]);
  });
});
