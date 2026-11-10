// The study timer's rules, pure so the browser (the ticking button) and the server agree.

/** A session counts at most this long (owner decision); one left running stops counting here. */
export const MAX_SESSION_MS = 4 * 60 * 60 * 1000;
/** Shorter sessions aren't kept: a start and stop by mistake leaves nothing behind. */
export const MIN_SESSION_MS = 60 * 1000;

/** When a session started at `startedAt` ends if stopped at `now`, and whether the cap stopped it. */
export function sessionEnd(startedAt: Date, now: Date): { endedAt: Date; autoStopped: boolean } {
  const cap = new Date(startedAt.getTime() + MAX_SESSION_MS);
  return now > cap ? { endedAt: cap, autoStopped: true } : { endedAt: now, autoStopped: false };
}

/** A running session past the cap: it already stopped counting, and is saved when next touched. */
export function isExpired(startedAt: Date, now: Date): boolean {
  return now.getTime() - startedAt.getTime() > MAX_SESSION_MS;
}

/** "45 min", "1 h 5 min", "4 h" (whole minutes, rounded down). */
export function formatStudyTime(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The running timer: "4:05", "42:05", "1:02:05". */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
