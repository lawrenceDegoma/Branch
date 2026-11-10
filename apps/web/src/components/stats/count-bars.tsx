/**
 * Labelled horizontal bars for a few counts (one orange series, value at the tip). The numbers
 * are text in the list, so nothing depends on the bars.
 */
export function CountBars({
  label,
  rows,
}: {
  label: string;
  rows: { name: string; count: number }[];
}) {
  const max = Math.max(...rows.map((r) => r.count), 0);
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {rows.map(({ name, count }) => (
        <li key={name} className="grid grid-cols-[8rem_1fr] items-center gap-3">
          <span className="text-ink-muted">{name}</span>
          <span className="flex items-center gap-2">
            {count > 0 ? (
              <span
                aria-hidden
                className="block h-3 rounded-r-[4px] bg-brand"
                style={{ width: `${(count / max) * 85}%` }}
              />
            ) : null}
            <span className="tabular">{count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
