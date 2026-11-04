import { describe, expect, it } from "vitest";
import { describeStanding, positionInWeeks, standingOn, type PlanWeeks } from "./standing";

// Week 1: a b c d · Week 2: e f · Week 3: (empty) · Week 4: g h
const weeks: PlanWeeks = [["a", "b", "c", "d"], ["e", "f"], [], ["g", "h"]].map((ids, index) => ({
  number: index + 1,
  items: ids.map((id) => ({ problem: { id } })),
}));

const solvedSet = (...ids: string[]) => {
  const set = new Set(ids);
  return (id: string) => set.has(id);
};

describe("positionInWeeks", () => {
  it("maps the solved count onto the weekly allotments", () => {
    expect(positionInWeeks(weeks, 0)).toBe(0);
    expect(positionInWeeks(weeks, 2)).toBe(0.5);
    expect(positionInWeeks(weeks, 5)).toBe(1.5);
  });

  it("crosses empty weeks, and stops at the end when everything is solved", () => {
    expect(positionInWeeks(weeks, 6)).toBe(3);
    expect(positionInWeeks(weeks, 7)).toBe(3.5);
    expect(positionInWeeks(weeks, 8)).toBe(4);
    expect(positionInWeeks([], 0)).toBe(0);
  });
});

describe("standingOn", () => {
  it("counts unsolved problems from earlier weeks as backlog", () => {
    const standing = standingOn(weeks, 2, solvedSet("a", "b", "e"));
    expect(standing).toMatchObject({
      total: 8,
      solved: 3,
      backlog: 2,
      ahead: 0,
      thisWeek: { total: 2, solved: 1 },
      status: "catching-up",
    });
  });

  it("keeps backlog as the calendar keeps moving", () => {
    const solved = solvedSet("a", "b");
    expect(standingOn(weeks, 2, solved).backlog).toBe(2);
    expect(standingOn(weeks, 4, solved).backlog).toBe(4);
    // After the plan's last week, everything unsolved is backlog.
    expect(standingOn(weeks, 9, solved).backlog).toBe(6);
  });

  it("counts problems solved from later weeks as ahead", () => {
    const standing = standingOn(weeks, 1, solvedSet("a", "b", "c", "d", "g"));
    expect(standing).toMatchObject({ backlog: 0, ahead: 1, status: "ahead" });
  });

  it("is on pace with nothing overdue, and not started before week 1", () => {
    expect(standingOn(weeks, 1, solvedSet()).status).toBe("on-pace");
    expect(standingOn(weeks, 0, solvedSet()).status).toBe("not-started");
    expect(standingOn(weeks, 0, solvedSet("a")).status).toBe("ahead");
  });

  it("is finished once every problem is solved, whatever the week", () => {
    const all = solvedSet("a", "b", "c", "d", "e", "f", "g", "h");
    expect(standingOn(weeks, 1, all)).toMatchObject({ status: "finished", position: 4 });
  });
});

describe("describeStanding", () => {
  it("states counts rather than a verdict", () => {
    expect(describeStanding(standingOn(weeks, 1, solvedSet()))).toBe("On pace");
    expect(describeStanding(standingOn(weeks, 0, solvedSet()))).toBe("Not started");
    expect(describeStanding(standingOn(weeks, 2, solvedSet("a", "e", "g")))).toBe(
      "3 in backlog · 1 ahead",
    );
    expect(
      describeStanding(standingOn(weeks, 3, solvedSet("a", "b", "c", "d", "e", "f", "g", "h"))),
    ).toBe("Finished");
  });
});
