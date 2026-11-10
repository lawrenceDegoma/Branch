import { addDays, isoWeekday, type CalendarDate } from "@branch/shared/calendar";

// Weekly buckets for the stats page, in the person's own time zone: weeks start on Monday, as
// Postgres's date_trunc('week') does, and the last bucket is the current week.

export const WEEKS_SHOWN = 12;

/** The Mondays of the last `count` weeks, oldest first, ending with this week's. */
export function lastWeeks(today: CalendarDate, count = WEEKS_SHOWN): CalendarDate[] {
  const thisMonday = addDays(today, -(isoWeekday(today) - 1));
  return Array.from({ length: count }, (_, i) => addDays(thisMonday, -7 * (count - 1 - i)));
}

/** One value per week (zero where nothing happened); rows outside the weeks are ignored. */
export function fillWeeks(
  weeks: CalendarDate[],
  rows: { week: CalendarDate; value: number }[],
): { week: CalendarDate; value: number }[] {
  const byWeek = new Map(rows.map((row) => [row.week, row.value]));
  return weeks.map((week) => ({ week, value: byWeek.get(week) ?? 0 }));
}
