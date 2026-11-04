/** Formats dates in the viewer's own timezone. */
export function formatDate(date: Date, timeZone: string, withYear = false): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone,
  }).format(date);
}

export function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "now", "5m", "3h", "2d" for the last week; a date after that (in the viewer's timezone). */
export function formatRelative(date: Date, now: Date, timeZone: string): string {
  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d`;
  const sameYear =
    formatDate(date, timeZone, true).slice(-4) === formatDate(now, timeZone, true).slice(-4);
  return formatDate(date, timeZone, !sameYear);
}
