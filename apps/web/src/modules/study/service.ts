import "server-only";
import { prisma } from "@branch/database";
import { isUniqueViolation } from "@/lib/db-errors";
import { takeToken } from "@/lib/limits";
import { DomainError, NotFoundError } from "@/lib/errors";
import { findMembership, requireMembership } from "@/modules/groups/access";
import { isExpired, MIN_SESSION_MS, sessionEnd } from "./duration";
import { sessionIdSchema, type StudyDecision, type StudySharingChoice } from "./schemas";

// Study sessions, from Home's timer. Private: a session reaches a group only as a STUDY post the
// person chose to share, either when it ends or by a remembered choice (owner decisions,
// 2026-11-09). One runs at a time and counts at most 4 hours (database rules); a session left
// running past that is saved as 4 hours, "stopped automatically", the next time it's touched, and
// is never shared without asking.

const notFound = () => new NotFoundError("We couldn't find that session.");
const STARTS_PER_HOUR = 30;

/** The running session, if any, and whether it already stopped counting. */
export async function runningSession(userId: string, now = new Date()) {
  const session = await prisma.studySession.findFirst({
    where: { userId, endedAt: null },
    select: { id: true, startedAt: true },
  });
  return session ? { ...session, expired: isExpired(session.startedAt, now) } : null;
}

/** Closes a running session as of `now` (at most 4 hours in). Null if none was running. */
async function closeRunning(userId: string, now: Date) {
  const running = await runningSession(userId, now);
  if (!running) return null;
  const end = sessionEnd(running.startedAt, now);
  const { count } = await prisma.studySession.updateMany({
    where: { id: running.id, endedAt: null },
    data: end,
  });
  // Stopped by a request racing this one; that one reports it.
  if (count === 0) return null;
  return { id: running.id, startedAt: running.startedAt, ...end };
}

/** Starts the timer. Starting while one runs is a no-op; one left past 4 hours is saved first. */
export async function startSession(userId: string, now = new Date()) {
  const running = await runningSession(userId, now);
  if (running && !running.expired) return running;
  if (running) await closeRunning(userId, now);
  await takeToken(
    {
      key: `study:${userId}`,
      limit: STARTS_PER_HOUR,
      windowSeconds: 60 * 60,
      message: "That's a lot of sessions in an hour. Try again later.",
    },
    now,
  );
  try {
    const session = await prisma.studySession.create({
      data: { userId, startedAt: now },
      select: { id: true, startedAt: true },
    });
    return { ...session, expired: false };
  } catch (error) {
    // Two starts at once: the other one won.
    if (isUniqueViolation(error)) return (await runningSession(userId, now))!;
    throw error;
  }
}

export type StopResult =
  | { kind: "discarded" }
  | { kind: "saved"; sessionId: string; durationMs: number; autoStopped: boolean; ask: boolean }
  | { kind: "shared"; sessionId: string; durationMs: number; groupName: string };

/**
 * Stops the timer. Under a minute isn't kept. Otherwise the session is saved, then shared by the
 * person's remembered choice, or `ask` says to ask them (always, if it stopped automatically).
 */
export async function stopSession(userId: string, now = new Date()): Promise<StopResult> {
  const closed = await closeRunning(userId, now);
  if (!closed) throw new NotFoundError("The timer isn't running.");
  const durationMs = closed.endedAt.getTime() - closed.startedAt.getTime();
  if (durationMs < MIN_SESSION_MS) {
    await prisma.studySession.deleteMany({ where: { id: closed.id, userId } });
    return { kind: "discarded" };
  }
  const saved = { sessionId: closed.id, durationMs, autoStopped: closed.autoStopped };
  if (closed.autoStopped) return { kind: "saved", ...saved, ask: true };

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { studySharing: true, studyShareGroup: { select: { id: true, name: true } } },
  });
  if (profile?.studySharing === "NEVER") return { kind: "saved", ...saved, ask: false };
  const group = profile?.studySharing === "GROUP" ? profile.studyShareGroup : null;
  // A remembered group the person has since left (or that's gone): ask again.
  if (group && (await findMembership(userId, group.id))) {
    await createStudyPost(userId, closed.id, group.id, null, now);
    return { kind: "shared", sessionId: closed.id, durationMs, groupName: group.name };
  }
  return { kind: "saved", ...saved, ask: true };
}

async function createStudyPost(
  userId: string,
  sessionId: string,
  groupId: string,
  note: string | null,
  now: Date,
) {
  try {
    return await prisma.post.create({
      data: {
        groupId,
        authorId: userId,
        kind: "STUDY",
        studySessionId: sessionId,
        body: note,
        createdAt: now,
      },
      select: { id: true, groupId: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError(
        "ALREADY_SHARED",
        "You've already shared this session there.",
        "groupId",
      );
    }
    throw error;
  }
}

/** The person's own finished session, or NotFound. */
async function requireOwnFinished(userId: string, sessionId: string) {
  if (!sessionIdSchema.safeParse(sessionId).success) throw notFound();
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId, endedAt: { not: null } },
    select: { id: true },
  });
  if (!session) throw notFound();
  return session;
}

/**
 * What the person chose after a session: share it to a group (a member's, with an optional
 * note), or not. "Remember my decision" makes it the choice for later sessions.
 */
export async function decideSession(userId: string, decision: StudyDecision, now = new Date()) {
  await requireOwnFinished(userId, decision.sessionId);
  if (decision.intent === "skip") {
    if (decision.remember) await setStudySharing(userId, { mode: "NEVER" });
    return null;
  }
  const membership = await requireMembership(userId, decision.groupId);
  const post = await createStudyPost(
    userId,
    decision.sessionId,
    membership.groupId,
    decision.note,
    now,
  );
  if (decision.remember) {
    await setStudySharing(userId, { mode: "GROUP", groupId: membership.groupId });
  }
  return post;
}

/** Deletes one of the person's sessions, and any posts that shared it. */
export async function deleteSession(userId: string, sessionId: string) {
  if (!sessionIdSchema.safeParse(sessionId).success) throw notFound();
  const { count } = await prisma.studySession.deleteMany({ where: { id: sessionId, userId } });
  if (count === 0) throw notFound();
}

/** Settings: ask each time, never share, or always share to one of the person's groups. */
export async function setStudySharing(userId: string, choice: StudySharingChoice) {
  if (choice.mode === "GROUP") await requireMembership(userId, choice.groupId);
  await prisma.profile.update({
    where: { userId },
    data: {
      studySharing: choice.mode,
      studyShareGroupId: choice.mode === "GROUP" ? choice.groupId : null,
    },
  });
}

/** The groups a session can be shared to, and the remembered choice (shown in Settings). */
export async function studySharingView(userId: string) {
  const [memberships, profile] = await Promise.all([
    prisma.groupMembership.findMany({
      where: { userId },
      select: { group: { select: { id: true, name: true } } },
      orderBy: { group: { name: "asc" } },
    }),
    prisma.profile.findUniqueOrThrow({
      where: { userId },
      select: { studySharing: true, studyShareGroupId: true },
    }),
  ]);
  const groups = memberships.map((m) => m.group);
  const remembered = groups.find((g) => g.id === profile.studyShareGroupId);
  // GROUP with a group that's gone or left behaves like ASK, so show it that way.
  const value =
    profile.studySharing === "GROUP"
      ? remembered
        ? `GROUP:${remembered.id}`
        : "ASK"
      : profile.studySharing;
  return { groups, value };
}
