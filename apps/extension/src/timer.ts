// The problem timer, pure so it can be tested with a fake clock. Each tab on a problem page has
// one: it counts while the page is in view, pauses while it isn't, and stops when a submission
// there is accepted; the time then goes to Branch with the submission (owner decision: visible
// time only, from first opening the problem in that tab).

/** How often a problem tab reports in while in view. */
export const TICK_MS = 15_000;
/**
 * The most one report can add. A computer that slept with the problem open doesn't count the
 * sleep: the next report adds this at most.
 */
export const MAX_GAP_MS = 45_000;
/** The most a timer counts (Branch accepts at most a day). */
export const MAX_SPENT_MS = 24 * 60 * 60 * 1000;

export type PageTimer = {
  /** The problem's slug in the page's address (on neetcode.io, neetcode.io's own). */
  page: string;
  spentMs: number;
  /** When it was last seen in view, while it is; null while it isn't. */
  visibleSince: number | null;
  /** Set once a submission on this page was accepted: the timer stops there. */
  acceptedAt: number | null;
};

/** "/problems/two-sum/description/" → "two-sum"; null for any other page. */
export function problemPage(pathname: string): string | null {
  return pathname.match(/^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/|$)/)?.[1] ?? null;
}

/** Adds the time in view since the last report, at most MAX_GAP_MS. */
function settle(timer: PageTimer, now: number): PageTimer {
  if (timer.visibleSince === null) return timer;
  const gap = Math.min(Math.max(0, now - timer.visibleSince), MAX_GAP_MS);
  return { ...timer, spentMs: Math.min(timer.spentMs + gap, MAX_SPENT_MS), visibleSince: now };
}

/**
 * A report from the tab: which problem page it's on (or none), whether it's in view, and
 * whether the page just loaded. A different problem starts a new timer; so does reloading a
 * problem already accepted (to solve it again). Leaving problem pages pauses it.
 */
export function observe(
  timer: PageTimer | undefined,
  report: { page: string | null; visible: boolean; loaded: boolean },
  now: number,
): PageTimer | undefined {
  const { page, visible, loaded } = report;
  if (page === null) return timer && { ...settle(timer, now), visibleSince: null };
  if (!timer || timer.page !== page || (loaded && timer.acceptedAt !== null)) {
    return { page, spentMs: 0, visibleSince: visible ? now : null, acceptedAt: null };
  }
  if (timer.acceptedAt !== null) return timer;
  return { ...settle(timer, now), visibleSince: visible ? now : null };
}

/** The time counted so far. */
export function spentMs(timer: PageTimer, now: number): number {
  return timer.acceptedAt === null ? settle(timer, now).spentMs : timer.spentMs;
}

/**
 * A submission on this page was accepted: stop, and say how long it took, in whole seconds (at
 * least 1). Null if it was already accepted or nothing was counted.
 */
export function accept(
  timer: PageTimer,
  now: number,
): { timer: PageTimer; seconds: number | null } {
  if (timer.acceptedAt !== null) return { timer, seconds: null };
  const settled = settle(timer, now);
  const seconds = settled.spentMs > 0 ? Math.max(1, Math.round(settled.spentMs / 1000)) : null;
  return { timer: { ...settled, visibleSince: null, acceptedAt: now }, seconds };
}

/** The toolbar badge for a tab: minutes so far, and whether that's past the budget. */
export function badge(
  timer: PageTimer | undefined,
  budgetMinutes: number | null,
  now: number,
): { text: string; over: boolean } {
  if (!timer) return { text: "", over: false };
  const minutes = Math.floor(spentMs(timer, now) / 60_000);
  return {
    text: `${minutes}m`,
    over: timer.acceptedAt === null && budgetMinutes !== null && minutes >= budgetMinutes,
  };
}

/** Budgets the popup accepts, in minutes. */
export const BUDGET_MIN = 1;
export const BUDGET_MAX = 600;
