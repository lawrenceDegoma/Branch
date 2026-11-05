import type { SubmissionPayload } from "@branch/shared/extension";

// Accepted submissions waiting to reach Branch, kept in the extension's local storage so they
// survive the service worker stopping and the browser restarting.

export type QueueItem = { payload: SubmissionPayload; attempts: number; queuedAt: number };

/** At most this many wait; the oldest are dropped first. */
export const QUEUE_LIMIT = 50;

/** Adds a payload unless the same LeetCode submission is already waiting. */
export function enqueue(queue: QueueItem[], payload: SubmissionPayload, now: number): QueueItem[] {
  if (queue.some((item) => item.payload.submissionId === payload.submissionId)) return queue;
  return [...queue, { payload, attempts: 0, queuedAt: now }].slice(-QUEUE_LIMIT);
}

/** Minutes before the next try: 1, 2, 4, … up to an hour. */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(60, 2 ** Math.max(0, attempts - 1));
}
