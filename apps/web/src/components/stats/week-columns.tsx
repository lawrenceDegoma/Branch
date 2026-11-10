import { formatCalendarDate, type CalendarDate } from "@branch/shared/calendar";

/**
 * A column per week, oldest to this week: thin orange columns (progress data) from one baseline,
 * no gridlines. Only this week is labelled; hovering a column names its week and value, and the
 * table under "Show as a table" has every number (the chart itself is one image to screen
 * readers, described by `summary`).
 */
export function WeekColumns({
  id,
  data,
  format,
  summary,
  unit,
}: {
  id: string;
  data: { week: CalendarDate; value: number }[];
  format: (value: number) => string;
  summary: string;
  /** The table's value column, e.g. "Problems solved". */
  unit: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  const current = data.at(-1);
  return (
    <figure className="flex flex-col gap-2">
      <p className="text-ink-muted">
        This week: <span className="font-medium text-ink">{format(current?.value ?? 0)}</span>
      </p>
      <div
        role="img"
        aria-label={summary}
        className="flex h-28 items-end gap-0.5 border-b border-line"
      >
        {data.map(({ week, value }) => (
          <div
            key={week}
            title={`Week of ${formatCalendarDate(week)}: ${format(value)}`}
            className="flex h-full flex-1 items-end justify-center"
          >
            {value > 0 ? (
              <span
                className="block w-[70%] max-w-6 rounded-t-[4px] bg-brand"
                style={{ height: `max(2px, ${(value / max) * 100}%)` }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div aria-hidden className="flex justify-between text-xs text-ink-muted">
        <span>{formatCalendarDate(data[0]!.week)}</span>
        <span>This week</span>
      </div>
      <details>
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          Show as a table
        </summary>
        <table id={id} className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th scope="col" className="py-1 font-normal">
                Week of
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                {unit}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ week, value }) => (
              <tr key={week} className="border-t border-line">
                <td className="py-1">{formatCalendarDate(week, { year: "numeric" })}</td>
                <td className="py-1 text-right tabular">{format(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
