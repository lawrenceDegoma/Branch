import { formatCalendarDate, formatWeekRange, weekRange } from "@branch/shared/calendar";
import type { Pacing } from "@branch/shared/schedule";
import { pluralize } from "@/lib/format";

export function paceLabel(pacing: Pacing): string {
  return pacing.mode === "PER_SECTION"
    ? "One section a week"
    : `${pluralize(pacing.problemsPerWeek, "problem")} a week`;
}

/** Which week to feature and how to describe where the group is. */
export function planPosition(plan: { startDate: string; currentWeek: number; totalWeeks: number }) {
  if (plan.currentWeek === 0) {
    return {
      featuredWeek: 1,
      label: `Starts ${formatCalendarDate(plan.startDate, { weekday: "short" })}`,
      isLive: false,
    };
  }
  if (plan.currentWeek > plan.totalWeeks) {
    const end = weekRange(plan.startDate, plan.totalWeeks).last;
    return {
      featuredWeek: null,
      label: `All ${plan.totalWeeks} weeks finished ${formatCalendarDate(end)}`,
      isLive: false,
    };
  }
  return {
    featuredWeek: plan.currentWeek,
    label: `Week ${plan.currentWeek} of ${plan.totalWeeks} · ${formatWeekRange(plan.startDate, plan.currentWeek)}`,
    isLive: true,
  };
}
