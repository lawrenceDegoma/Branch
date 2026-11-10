import type { ChangelogEntry } from "./entries";

/**
 * The entries to tell someone about on Home, newest first: those after the one they last
 * dismissed, and only from after the day they joined (nothing from before they were here). If
 * the dismissed entry no longer exists, only the newest is shown.
 */
export function unseenEntries(
  entries: readonly ChangelogEntry[],
  { seenId, joinedOn }: { seenId: string | null; joinedOn: string },
): ChangelogEntry[] {
  const fresh = (list: readonly ChangelogEntry[]) => list.filter((e) => e.date > joinedOn);
  if (seenId === null) return fresh(entries);
  const seenAt = entries.findIndex((e) => e.id === seenId);
  return fresh(seenAt === -1 ? entries.slice(0, 1) : entries.slice(0, seenAt));
}
