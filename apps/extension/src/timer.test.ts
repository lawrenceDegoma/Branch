import { describe, expect, it } from "vitest";
import { accept, badge, MAX_GAP_MS, observe, problemPage, spentMs, type PageTimer } from "./timer";

const MIN = 60_000;
const SEC = 1000;

/** Replays reports for one tab: [at, page, visible, loaded?]. */
function replay(reports: [number, string | null, boolean, boolean?][]) {
  let timer: PageTimer | undefined;
  for (const [at, page, visible, loaded = false] of reports) {
    timer = observe(timer, { page, visible, loaded }, at);
  }
  return timer;
}

describe("problemPage", () => {
  it("finds the problem in the address, on either site", () => {
    expect(problemPage("/problems/two-sum/")).toBe("two-sum");
    expect(problemPage("/problems/two-sum/description/")).toBe("two-sum");
    expect(problemPage("/problems/two-sum/submissions/2189874571/")).toBe("two-sum");
    expect(problemPage("/problems/duplicate-integer/question")).toBe("duplicate-integer");
    expect(problemPage("/problems/two-sum")).toBe("two-sum");
    expect(problemPage("/problemset/")).toBeNull();
    expect(problemPage("/problems/")).toBeNull();
    expect(problemPage("/")).toBeNull();
  });
});

describe("the problem timer", () => {
  it("counts time in view, with reports every 15 seconds", () => {
    const timer = replay([
      [0, "two-sum", true, true],
      [15 * SEC, "two-sum", true],
      [30 * SEC, "two-sum", true],
    ]);
    expect(spentMs(timer!, 30 * SEC)).toBe(30 * SEC);
    // Between reports, it includes the time since the last one.
    expect(spentMs(timer!, 40 * SEC)).toBe(40 * SEC);
  });

  it("pauses while out of view, and resumes", () => {
    const timer = replay([
      [0, "two-sum", true, true],
      [10 * SEC, "two-sum", false],
      [10 * MIN, "two-sum", true],
      [10 * MIN + 15 * SEC, "two-sum", true],
    ]);
    expect(spentMs(timer!, 10 * MIN + 15 * SEC)).toBe(25 * SEC);
  });

  it("doesn't count a computer asleep with the problem open", () => {
    const timer = replay([
      [0, "two-sum", true, true],
      [3 * 60 * MIN, "two-sum", true],
    ]);
    expect(spentMs(timer!, 3 * 60 * MIN)).toBe(MAX_GAP_MS);
  });

  it("starts over on a different problem, and pauses away from problems", () => {
    const away = replay([
      [0, "two-sum", true, true],
      [15 * SEC, null, true],
      [5 * MIN, "two-sum", true],
    ]);
    expect(spentMs(away!, 5 * MIN)).toBe(15 * SEC);
    const other = replay([
      [0, "two-sum", true, true],
      [15 * SEC, "valid-anagram", true],
    ]);
    expect(other).toMatchObject({ page: "valid-anagram", spentMs: 0 });
  });

  it("keeps counting through a reload, and stops once accepted", () => {
    const timer = replay([
      [0, "two-sum", true, true],
      [15 * SEC, "two-sum", true, true],
      [30 * SEC, "two-sum", true],
    ])!;
    const { timer: done, seconds } = accept(timer, 40 * SEC);
    expect(seconds).toBe(40);
    // Accepted again on the same page (a resubmission): nothing more to report.
    expect(accept(done, 50 * SEC).seconds).toBeNull();
    // Reports after that change nothing...
    expect(observe(done, { page: "two-sum", visible: true, loaded: false }, 2 * MIN)).toBe(done);
    expect(spentMs(done, 2 * MIN)).toBe(40 * SEC);
    // ...until the page is reloaded to solve it again.
    expect(observe(done, { page: "two-sum", visible: true, loaded: true }, 3 * MIN)).toMatchObject({
      spentMs: 0,
      acceptedAt: null,
    });
  });

  it("reports at least a second, and nothing if nothing was counted", () => {
    const quick = replay([[0, "two-sum", true, true]])!;
    expect(accept(quick, 200).seconds).toBe(1);
    const hidden = replay([[0, "two-sum", false, true]])!;
    expect(accept(hidden, 5 * SEC).seconds).toBeNull();
  });
});

describe("the toolbar badge", () => {
  /** A tab in view for `minutes`, reporting every 15 seconds. */
  const at = (minutes: number) => {
    let timer = observe(undefined, { page: "two-sum", visible: true, loaded: true }, 0);
    for (let t = 15 * SEC; t <= minutes * MIN; t += 15 * SEC) {
      timer = observe(timer, { page: "two-sum", visible: true, loaded: false }, t);
    }
    return timer!;
  };

  it("shows minutes, and whether they're past the budget", () => {
    expect(badge(undefined, 30, 0)).toEqual({ text: "", over: false });
    expect(badge(at(12), null, 12 * MIN)).toEqual({ text: "12m", over: false });
    expect(badge(at(12), 30, 12 * MIN)).toEqual({ text: "12m", over: false });
    expect(badge(at(31), 30, 31 * MIN)).toEqual({ text: "31m", over: true });
    // Once accepted it's no longer "over".
    expect(badge(accept(at(31), 31 * MIN).timer, 30, 40 * MIN)).toEqual({
      text: "31m",
      over: false,
    });
  });
});
