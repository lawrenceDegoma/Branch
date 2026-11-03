// Calendar-date arithmetic for weekly schedules.
//
// Weeks are counted on calendar dates in the group's timezone, never on instants, so daylight
// saving changes (23- or 25-hour days) cannot shift a week boundary. A CalendarDate is an ISO
// "YYYY-MM-DD" string; arithmetic converts it to a day number via UTC, which has no DST.

export type CalendarDate = string;

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): value is CalendarDate {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function dayNumber(date: CalendarDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function fromDayNumber(day: number): CalendarDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(date: CalendarDate, days: number): CalendarDate {
  return fromDayNumber(dayNumber(date) + days);
}

export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  return dayNumber(to) - dayNumber(from);
}

/** The calendar date it is in `timeZone` at the instant `at`. */
export function dateInTimeZone(at: Date, timeZone: string): CalendarDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** ISO weekday, 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: CalendarDate): number {
  return ((((dayNumber(date) + 3) % 7) + 7) % 7) + 1;
}

/** The next Monday on or after `date`. */
export function nextMonday(date: CalendarDate): CalendarDate {
  return addDays(date, (8 - isoWeekday(date)) % 7);
}

/** Converts a Prisma @db.Date value (midnight UTC) to a CalendarDate. */
export function fromDbDate(value: Date): CalendarDate {
  return value.toISOString().slice(0, 10);
}

/** Converts a CalendarDate to the Date Prisma expects for a @db.Date column. */
export function toDbDate(date: CalendarDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Week 1 starts on `startDate`; week n on startDate + 7(n − 1). Returns 0 before the start. */
export function weekNumberOn(startDate: CalendarDate, date: CalendarDate): number {
  const days = daysBetween(startDate, date);
  return days < 0 ? 0 : Math.floor(days / 7) + 1;
}

/** First and last calendar day of week `weekNumber`. */
export function weekRange(
  startDate: CalendarDate,
  weekNumber: number,
): { first: CalendarDate; last: CalendarDate } {
  const first = addDays(startDate, (weekNumber - 1) * 7);
  return { first, last: addDays(first, 6) };
}

/** "Nov 2" style label for a calendar date, independent of the viewer's timezone. */
export function formatCalendarDate(
  date: CalendarDate,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(toDbDate(date));
}

export function formatWeekRange(startDate: CalendarDate, weekNumber: number): string {
  const { first, last } = weekRange(startDate, weekNumber);
  return `${formatCalendarDate(first)} – ${formatCalendarDate(last)}`;
}
