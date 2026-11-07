import type { SubmissionPayload } from "@branch/shared/extension";

// Accepted submissions waiting to reach Branch, kept in the extension's local storage so they
// survive the service worker stopping and the browser restarting.

export type QueueItem = { payload: SubmissionPayload; attempts: number; queuedAt: number };

/** At most this many wait; the oldest are dropped first. */
export const QUEUE_LIMIT = 50;

/** The same submission: IDs are unique per site. Items queued before 1.1.0 have no source. */
export const sameSubmission = (a: QueueItem, b: QueueItem) =>
  a.payload.submissionId === b.payload.submissionId &&
  (a.payload.source ?? "LEETCODE") === (b.payload.source ?? "LEETCODE");

/** Adds a payload unless the same submission is already waiting. */
export function enqueue(queue: QueueItem[], payload: SubmissionPayload, now: number): QueueItem[] {
  const item = { payload, attempts: 0, queuedAt: now };
  if (queue.some((queued) => sameSubmission(queued, item))) return queue;
  return [...queue, item].slice(-QUEUE_LIMIT);
}

/** Minutes before the next try: 1, 2, 4, … up to an hour. */
export function retryDelayMinutes(attempts: number): number {
  return Math.min(60, 2 ** Math.max(0, attempts - 1));
}
