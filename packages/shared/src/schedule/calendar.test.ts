import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInTimeZone,
  daysBetween,
  formatWeekRange,
  isCalendarDate,
  isoWeekday,
  nextMonday,
  weekNumberOn,
  weekRange,
} from "./calendar";

describe("calendar dates", () => {
  it("validates real dates only", () => {
    expect(isCalendarDate("2026-11-02")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2026-02-29")).toBe(false);
    expect(isCalendarDate("2026-13-01")).toBe(false);
    expect(isCalendarDate("11/02/2026")).toBe(false);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-02", "2026-11-09")).toBe(7);
  });

  it("knows weekdays and the next Monday", () => {
    expect(isoWeekday("2026-11-02")).toBe(1); // Monday
    expect(isoWeekday("2026-11-08")).toBe(7); // Sunday
    expect(nextMonday("2026-11-02")).toBe("2026-11-02");
    expect(nextMonday("2026-11-03")).toBe("2026-11-09");
    expect(nextMonday("2026-11-08")).toBe("2026-11-09");
  });
});

describe("dateInTimeZone", () => {
  // 2026-11-03 03:30 UTC is still Nov 2 in Los Angeles and already Nov 3 in Tokyo.
  const instant = new Date("2026-11-03T03:30:00Z");

  it("uses the group's local date, not UTC", () => {
    expect(dateInTimeZone(instant, "America/Los_Angeles")).toBe("2026-11-02");
    expect(dateInTimeZone(instant, "UTC")).toBe("2026-11-03");
    expect(dateInTimeZone(instant, "Asia/Tokyo")).toBe("2026-11-03");
  });

  it("handles half-hour and date-line offsets", () => {
    expect(dateInTimeZone(new Date("2026-11-02T18:45:00Z"), "Asia/Kolkata")).toBe("2026-11-03");
    expect(dateInTimeZone(new Date("2026-11-02T10:30:00Z"), "Pacific/Kiritimati")).toBe(
      "2026-11-03",
    );
    expect(dateInTimeZone(new Date("2026-11-02T10:30:00Z"), "Pacific/Pago_Pago")).toBe(
      "2026-11-01",
    );
  });
});

describe("weekNumberOn", () => {
  const start = "2026-11-02";

  it("is 0 before the plan starts", () => {
    expect(weekNumberOn(start, "2026-11-01")).toBe(0);
  });

  it("starts week 1 on the start date and advances every 7 days", () => {
    expect(weekNumberOn(start, "2026-11-02")).toBe(1);
    expect(weekNumberOn(start, "2026-11-08")).toBe(1);
    expect(weekNumberOn(start, "2026-11-09")).toBe(2);
    expect(weekNumberOn(start, "2027-01-04")).toBe(10);
  });

  it("works for start dates that aren't Mondays", () => {
    expect(weekNumberOn("2026-11-05", "2026-11-11")).toBe(1);
    expect(weekNumberOn("2026-11-05", "2026-11-12")).toBe(2);
  });

  it("is unaffected by daylight saving changes in the group's timezone", () => {
    // US clocks fall back on 2026-11-01 and spring forward on 2027-03-14.
    const tz = "America/New_York";
    const weekStart = "2026-10-26";
    expect(weekNumberOn(weekStart, dateInTimeZone(new Date("2026-11-02T04:59:00Z"), tz))).toBe(1); // Sun 23:59 EST
    expect(weekNumberOn(weekStart, dateInTimeZone(new Date("2026-11-02T05:00:00Z"), tz))).toBe(2); // Mon 00:00 EST
    const spring = "2027-03-08";
    expect(weekNumberOn(spring, dateInTimeZone(new Date("2027-03-15T03:59:00Z"), tz))).toBe(1); // Sun 23:59 EDT
    expect(weekNumberOn(spring, dateInTimeZone(new Date("2027-03-15T04:00:00Z"), tz))).toBe(2); // Mon 00:00 EDT
  });
});

describe("weekRange", () => {
  it("gives the first and last day of a week", () => {
    expect(weekRange("2026-11-02", 2)).toEqual({ first: "2026-11-09", last: "2026-11-15" });
    expect(formatWeekRange("2026-12-28", 1)).toBe("Dec 28 – Jan 3");
  });
});
