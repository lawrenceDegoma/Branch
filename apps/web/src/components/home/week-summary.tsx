import { ProgressBar } from "@/components/progress/progress-bar";
import type { HomeView } from "@/modules/progress/service";

/** "Your week": the right rail on wide screens, a compact card above the list on narrow ones. */
export function WeekSummary({ summary }: { summary: HomeView["summary"] }) {
  const stats = [
    { label: "Backlog", value: summary.backlog },
    { label: "Ahead", value: summary.ahead },
    { label: "Solved this week", value: summary.solvedThisWeek },
    { label: "Solved in total", value: summary.totalSolved },
  ];
  return (
    <section
      aria-labelledby="week-summary-heading"
      className="flex flex-col gap-4 rounded-xl bg-surface p-4 sm:p-5"
    >
      <h2 id="week-summary-heading" className="text-base font-medium">
        Your week
      </h2>
      <div className="flex flex-col gap-2">
        <p className="text-ink-muted tabular">
          <span className="text-2xl font-semibold text-ink">{summary.thisWeek.solved}</span> of{" "}
          {summary.thisWeek.total} assigned this week
        </p>
        <ProgressBar value={summary.thisWeek.solved} total={summary.thisWeek.total} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-ink-muted">{stat.label}</dt>
            <dd className="text-base font-medium tabular">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
