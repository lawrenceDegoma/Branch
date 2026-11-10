import { describe, expect, it } from "vitest";
import {
  formatElapsed,
  formatStudyTime,
  formatTimeSpent,
  isExpired,
  MAX_SESSION_MS,
  sessionEnd,
} from "./duration";

const START = new Date("2026-11-10T12:00:00Z");
const after = (ms: number) => new Date(START.getTime() + ms);

describe("the study timer", () => {
  it("counts up to 4 hours, and a session left running stops there", () => {
    expect(sessionEnd(START, after(45 * 60_000))).toEqual({
      endedAt: after(45 * 60_000),
      autoStopped: false,
    });
    expect(sessionEnd(START, after(MAX_SESSION_MS))).toEqual({
      endedAt: after(MAX_SESSION_MS),
      autoStopped: false,
    });
    expect(sessionEnd(START, after(9 * 60 * 60_000))).toEqual({
      endedAt: after(MAX_SESSION_MS),
      autoStopped: true,
    });
    expect(isExpired(START, after(MAX_SESSION_MS))).toBe(false);
    expect(isExpired(START, after(MAX_SESSION_MS + 1))).toBe(true);
  });

  it("words durations", () => {
    expect(formatStudyTime(59_999)).toBe("0 min");
    expect(formatStudyTime(45 * 60_000 + 59_000)).toBe("45 min");
    expect(formatStudyTime(65 * 60_000)).toBe("1 h 5 min");
    expect(formatStudyTime(MAX_SESSION_MS)).toBe("4 h");
    expect(formatElapsed(4 * 60_000 + 5_000)).toBe("4:05");
    expect(formatElapsed(42 * 60_000 + 5_000)).toBe("42:05");
    expect(formatElapsed(62 * 60_000 + 5_000)).toBe("1:02:05");
    expect(formatElapsed(-5)).toBe("0:00");
    expect(formatTimeSpent(42)).toBe("under a minute");
    expect(formatTimeSpent(24 * 60 + 30)).toBe("about 24 min");
    expect(formatTimeSpent(65 * 60)).toBe("about 1 h 5 min");
  });
});
