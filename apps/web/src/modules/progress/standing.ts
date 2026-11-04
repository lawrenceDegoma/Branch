// Where one person stands on a group plan. Pure, so the rules are unit-tested without a database.
//
// - Backlog: problems from weeks before the current one that they haven't solved. Backlog is never
//   cleared by the calendar; only solving clears it.
// - Ahead: problems from weeks after the current one that they have already solved.
// - Position: how far along the plan their solved count reaches, in weeks (2.5 = halfway through
//   week 3), used to draw their branch against the group's calendar.

export type PlanWeeks = { number: number; items: { problem: { id: string } }[] }[];

export type StandingStatus = "not-started" | "on-pace" | "ahead" | "catching-up" | "finished";

export type Standing = {
  total: number;
  solved: number;
  thisWeek: { total: number; solved: number };
  backlog: number;
  ahead: number;
  position: number;
  status: StandingStatus;
};

/** Solved count expressed in weeks, so a branch can be drawn on the same axis as the calendar. */
export function positionInWeeks(weeks: PlanWeeks, solved: number): number {
  let before = 0;
  for (const week of weeks) {
    const size = week.items.length;
    if (solved < before + size) return week.number - 1 + (solved - before) / size;
    before += size;
  }
  return weeks.length;
}

export function standingOn(
  weeks: PlanWeeks,
  currentWeek: number,
  isSolved: (problemId: string) => boolean,
): Standing {
  let total = 0;
  let solved = 0;
  let backlog = 0;
  let ahead = 0;
  const thisWeek = { total: 0, solved: 0 };
  for (const week of weeks) {
    for (const item of week.items) {
      const done = isSolved(item.problem.id);
      total += 1;
      if (done) solved += 1;
      if (week.number < currentWeek && !done) backlog += 1;
      if (week.number > currentWeek && done) ahead += 1;
      if (week.number === currentWeek) {
        thisWeek.total += 1;
        if (done) thisWeek.solved += 1;
      }
    }
  }

  let status: StandingStatus;
  if (total > 0 && solved === total) status = "finished";
  else if (backlog > 0) status = "catching-up";
  else if (ahead > 0) status = "ahead";
  else if (currentWeek === 0) status = "not-started";
  else status = "on-pace";

  return {
    total,
    solved,
    thisWeek,
    backlog,
    ahead,
    position: positionInWeeks(weeks, solved),
    status,
  };
}

/**
 * A short, factual description: counts rather than a verdict, because the graph plots the
 * solved count while backlog and ahead depend on which problems were solved.
 */
export function describeStanding(standing: Standing): string {
  if (standing.status === "finished") return "Finished";
  const parts = [
    standing.backlog > 0 ? `${standing.backlog} in backlog` : null,
    standing.ahead > 0 ? `${standing.ahead} ahead` : null,
  ].filter((part) => part !== null);
  if (parts.length > 0) return parts.join(" · ");
  return standing.status === "not-started" ? "Not started" : "On pace";
}
