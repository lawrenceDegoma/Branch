// When a solved problem comes back for review. A simplified version of the spaced-repetition
// rule flashcard apps use: each review's outcome sets the next gap. Struggling brings a problem
// back soon; solving it stretches the gap by the problem's ease, which easy reviews raise and
// hard ones lower. Pure, so the rules are tested without a database.

export const REVIEW_OUTCOMES = ["AGAIN", "HARD", "GOOD", "EASY"] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const OUTCOME_LABEL: Record<ReviewOutcome, string> = {
  AGAIN: "Couldn't solve",
  HARD: "Struggled",
  GOOD: "Solved",
  EASY: "Easy",
};

/** A newly solved problem first comes back this many days later. */
export const FIRST_REVIEW_DAYS = 3;
export const MAX_INTERVAL_DAYS = 180;
/** Ease is a growth factor in hundredths: 250 means each good review multiplies the gap by 2.5. */
export const DEFAULT_EASE = 250;
export const MIN_EASE = 130;
export const MAX_EASE = 300;

export type ReviewState = { intervalDays: number; ease: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The gap and ease after a review with `outcome`. */
export function nextReview(state: ReviewState, outcome: ReviewOutcome): ReviewState {
  const { intervalDays: gap, ease } = state;
  const grown = (factor: number) => Math.max(gap + 1, Math.round(gap * factor));
  const next = {
    AGAIN: { intervalDays: 1, ease: ease - 20 },
    HARD: { intervalDays: Math.max(2, Math.round(gap * 1.2)), ease: ease - 15 },
    GOOD: { intervalDays: grown(ease / 100), ease },
    EASY: { intervalDays: grown((ease / 100) * 1.3), ease: ease + 15 },
  }[outcome];
  return {
    intervalDays: clamp(next.intervalDays, 1, MAX_INTERVAL_DAYS),
    ease: clamp(next.ease, MIN_EASE, MAX_EASE),
  };
}

/** Every outcome's resulting gap, so each choice can say when the problem would come back. */
export function reviewChoices(state: ReviewState): { outcome: ReviewOutcome; days: number }[] {
  return REVIEW_OUTCOMES.map((outcome) => ({
    outcome,
    days: nextReview(state, outcome).intervalDays,
  }));
}

/** "tomorrow", "in 8 days", "in 3 months": when a problem would come back after `days`. */
export function describeGap(days: number): string {
  if (days === 1) return "tomorrow";
  if (days < 45) return `in ${days} days`;
  return `in ${Math.round(days / 30)} months`;
}
