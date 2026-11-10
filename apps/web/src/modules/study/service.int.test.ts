import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";
import { deletePost, listFeed } from "@/modules/feed/service";
import { createTestGroup, createTestUser } from "@/test/factories";
import {
  decideSession,
  deleteSession,
  runningSession,
  setStudySharing,
  startSession,
  stopSession,
  studySharingView,
} from "./service";

const NOW = new Date("2026-11-10T12:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

/** Ada and Grace share a group; Outsider is in none of Ada's. */
async function setup() {
  const [ada, grace, outsider] = await Promise.all([
    createTestUser({ name: "Ada" }),
    createTestUser({ name: "Grace" }),
    createTestUser({ name: "Outsider" }),
  ]);
  await prisma.profile.createMany({
    data: [ada, grace, outsider].map((u) => ({
      userId: u.id,
      username: u.name.toLowerCase(),
      timezone: "UTC",
    })),
  });
  const group = await createTestGroup([
    { userId: ada.id, role: "ADMIN" },
    { userId: grace.id, role: "MEMBER" },
  ]);
  const elsewhere = await createTestGroup([{ userId: outsider.id, role: "ADMIN" }]);
  return { ada, grace, outsider, group, elsewhere };
}

/** Ada studies for `length` minutes and stops. */
async function studied(userId: string, length = 45, from = NOW) {
  await startSession(userId, from);
  return stopSession(userId, new Date(from.getTime() + length * 60_000));
}

const studyPosts = (authorId: string) =>
  prisma.post.findMany({ where: { authorId, kind: "STUDY" }, orderBy: { createdAt: "asc" } });

describe("the study timer", () => {
  it("runs one session at a time and saves it when stopped, asking about sharing", async () => {
    const { ada } = await setup();
    const first = await startSession(ada.id, NOW);
    // Starting again is a no-op.
    expect((await startSession(ada.id, minutes(5))).id).toBe(first.id);
    expect(await runningSession(ada.id, minutes(10))).toMatchObject({
      id: first.id,
      expired: false,
    });

    expect(await stopSession(ada.id, minutes(45))).toEqual({
      kind: "saved",
      sessionId: first.id,
      durationMs: 45 * 60_000,
      autoStopped: false,
      ask: true,
    });
    expect(await runningSession(ada.id, minutes(46))).toBeNull();
    await expect(stopSession(ada.id, minutes(50))).rejects.toBeInstanceOf(NotFoundError);
  });

  it("doesn't keep a session under a minute", async () => {
    const { ada } = await setup();
    await startSession(ada.id, NOW);
    expect(await stopSession(ada.id, new Date(NOW.getTime() + 59_000))).toEqual({
      kind: "discarded",
    });
    expect(await prisma.studySession.count({ where: { userId: ada.id } })).toBe(0);
  });

  it("stops counting at 4 hours, and always asks about a session that ran over", async () => {
    const { ada, group } = await setup();
    await setStudySharing(ada.id, { mode: "GROUP", groupId: group.id });
    const session = await startSession(ada.id, NOW);
    expect((await runningSession(ada.id, minutes(4 * 60 + 1)))?.expired).toBe(true);

    expect(await stopSession(ada.id, minutes(9 * 60))).toMatchObject({
      kind: "saved",
      durationMs: 4 * 60 * 60_000,
      autoStopped: true,
      ask: true,
    });
    expect(
      await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).toMatchObject({ endedAt: minutes(4 * 60), autoStopped: true });
    expect(await studyPosts(ada.id)).toHaveLength(0);
  });

  it("saves one left running before starting another", async () => {
    const { ada } = await setup();
    const old = await startSession(ada.id, NOW);
    const fresh = await startSession(ada.id, minutes(10 * 60));
    expect(fresh.id).not.toBe(old.id);
    expect(await prisma.studySession.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({
      autoStopped: true,
      endedAt: minutes(4 * 60),
    });
  });
});

describe("sharing a session", () => {
  it("shares it to a group the person chooses, with a note, and members see it", async () => {
    const { ada, grace, outsider, group } = await setup();
    const result = await studied(ada.id);
    if (result.kind !== "saved") throw new Error("expected a saved session");
    const post = await decideSession(
      ada.id,
      {
        intent: "share",
        sessionId: result.sessionId,
        groupId: group.id,
        note: "Graphs",
        remember: false,
      },
      minutes(46),
    );
    expect(post?.groupId).toBe(group.id);

    const [item] = (await listFeed(grace.id)).items;
    expect(item).toMatchObject({
      kind: "STUDY",
      body: "Graphs",
      studyMs: 45 * 60_000,
      canDelete: false,
    });
    expect((await listFeed(outsider.id)).items).toHaveLength(0);
    // Sharing it to the same group again is refused; nothing else changed.
    await expect(
      decideSession(ada.id, {
        intent: "share",
        sessionId: result.sessionId,
        groupId: group.id,
        note: null,
        remember: false,
      }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(
      (await prisma.profile.findUniqueOrThrow({ where: { userId: ada.id } })).studySharing,
    ).toBe("ASK");
  });

  it("refuses someone else's session, or a group the person isn't in", async () => {
    const { ada, grace, group, elsewhere } = await setup();
    const result = await studied(ada.id);
    if (result.kind !== "saved") throw new Error("expected a saved session");
    const share = (userId: string, groupId: string) =>
      decideSession(userId, {
        intent: "share",
        sessionId: result.sessionId,
        groupId,
        note: null,
        remember: false,
      });
    await expect(share(grace.id, group.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(share(ada.id, elsewhere.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      setStudySharing(ada.id, { mode: "GROUP", groupId: elsewhere.id }),
    ).rejects.toBeInstanceOf(NotFoundError);
    // The database refuses a post sharing another person's session, too.
    await expect(
      prisma.post.create({
        data: {
          groupId: group.id,
          authorId: grace.id,
          kind: "STUDY",
          studySessionId: result.sessionId,
        },
      }),
    ).rejects.toThrow(/post_studySessionId_authorId_fkey/);
    expect(await studyPosts(ada.id)).toHaveLength(0);
  });

  it("remembers a group, and shares later sessions there without asking", async () => {
    const { ada, group } = await setup();
    const first = await studied(ada.id);
    if (first.kind !== "saved") throw new Error("expected a saved session");
    await decideSession(ada.id, {
      intent: "share",
      sessionId: first.sessionId,
      groupId: group.id,
      note: null,
      remember: true,
    });
    expect(await studySharingView(ada.id)).toMatchObject({ value: `GROUP:${group.id}` });

    const second = await studied(ada.id, 30, minutes(120));
    expect(second).toMatchObject({ kind: "shared", groupName: group.name });
    expect(await studyPosts(ada.id)).toHaveLength(2);
  });

  it("asks again once the person has left the remembered group", async () => {
    const { grace, group } = await setup();
    await setStudySharing(grace.id, { mode: "GROUP", groupId: group.id });
    await prisma.groupMembership.delete({
      where: { groupId_userId: { groupId: group.id, userId: grace.id } },
    });
    expect(await studied(grace.id)).toMatchObject({ kind: "saved", ask: true });
    expect(await studySharingView(grace.id)).toMatchObject({ value: "ASK" });
    expect(await studyPosts(grace.id)).toHaveLength(0);
  });

  it("remembers not sharing", async () => {
    const { ada } = await setup();
    const first = await studied(ada.id);
    if (first.kind !== "saved") throw new Error("expected a saved session");
    expect(
      await decideSession(ada.id, { intent: "skip", sessionId: first.sessionId, remember: true }),
    ).toBeNull();
    expect(await studied(ada.id, 30, minutes(120))).toMatchObject({ kind: "saved", ask: false });
    expect(await studyPosts(ada.id)).toHaveLength(0);
  });
});

describe("deleting", () => {
  it("deletes a session and the posts that shared it; only the person's own", async () => {
    const { ada, grace, group } = await setup();
    const result = await studied(ada.id);
    if (result.kind !== "saved") throw new Error("expected a saved session");
    await decideSession(ada.id, {
      intent: "share",
      sessionId: result.sessionId,
      groupId: group.id,
      note: null,
      remember: false,
    });
    await expect(deleteSession(grace.id, result.sessionId)).rejects.toBeInstanceOf(NotFoundError);
    await deleteSession(ada.id, result.sessionId);
    expect(await studyPosts(ada.id)).toHaveLength(0);
  });

  it("lets the author delete the post and keep the session", async () => {
    const { ada, group } = await setup();
    const result = await studied(ada.id);
    if (result.kind !== "saved") throw new Error("expected a saved session");
    const post = await decideSession(ada.id, {
      intent: "share",
      sessionId: result.sessionId,
      groupId: group.id,
      note: null,
      remember: false,
    });
    await deletePost(ada.id, post!.id);
    expect(await prisma.studySession.count({ where: { userId: ada.id } })).toBe(1);
  });
});

describe("the database", () => {
  it("allows one running session per person, and at most 4 hours", async () => {
    const { ada } = await setup();
    await prisma.studySession.create({ data: { userId: ada.id, startedAt: NOW } });
    await expect(
      prisma.studySession.create({ data: { userId: ada.id, startedAt: minutes(1) } }),
    ).rejects.toThrow(/Unique constraint/);
    await expect(
      prisma.studySession.create({
        data: { userId: ada.id, startedAt: NOW, endedAt: minutes(4 * 60 + 1) },
      }),
    ).rejects.toThrow(/study_session_length/);
    await expect(
      prisma.studySession.create({ data: { userId: ada.id, startedAt: NOW, autoStopped: true } }),
    ).rejects.toThrow(/study_session_auto_stopped/);
  });

  it("keeps a remembered group to 'always share', and study posts to their shape", async () => {
    const { ada, group } = await setup();
    await expect(
      prisma.profile.update({
        where: { userId: ada.id },
        data: { studySharing: "NEVER", studyShareGroupId: group.id },
      }),
    ).rejects.toThrow(/profile_study_share_group/);
    await expect(
      prisma.post.create({ data: { groupId: group.id, authorId: ada.id, kind: "STUDY" } }),
    ).rejects.toThrow(/post_study_session_kind/);
    const result = await studied(ada.id);
    if (result.kind !== "saved") throw new Error("expected a saved session");
    await expect(
      prisma.post.create({
        data: {
          groupId: group.id,
          authorId: ada.id,
          kind: "STUDY",
          studySessionId: result.sessionId,
          body: "x".repeat(501),
        },
      }),
    ).rejects.toThrow(/post_body_length/);
  });
});
