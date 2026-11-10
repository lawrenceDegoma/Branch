import "server-only";
import { prisma } from "@branch/database";
import { dateInTimeZone } from "@branch/shared/calendar";
import { CHANGELOG } from "./entries";
import { unseenEntries } from "./whats-new";

/** What Home's "What's new" card shows someone: unseen entries, newest first (often none). */
export function whatsNewFor(
  user: { createdAt: Date },
  profile: { changelogSeenId: string | null; timezone: string },
) {
  return unseenEntries(CHANGELOG, {
    seenId: profile.changelogSeenId,
    joinedOn: dateInTimeZone(user.createdAt, profile.timezone),
  });
}

/** Dismissing the card marks everything up to the newest entry as seen. */
export async function dismissWhatsNew(userId: string): Promise<void> {
  await prisma.profile.update({
    where: { userId },
    data: { changelogSeenId: CHANGELOG[0]?.id ?? null },
  });
}
