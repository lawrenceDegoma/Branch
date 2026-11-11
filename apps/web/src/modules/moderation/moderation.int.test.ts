import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { DomainError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { createComment, deleteComment, listComments } from "@/modules/feed/comments";
import { setReaction } from "@/modules/feed/reactions";
import { createPost, deletePost, getPost, listFeed } from "@/modules/feed/service";
import { createPlan } from "@/modules/plans/service";
import { getGroupProgress } from "@/modules/progress/service";
import { createPublishedRoadmap, createTestGroup, createTestUser } from "@/test/factories";
import { blockUser, listBlocked, unblockUser } from "./blocks";
import { countOpenReports, dismissReports, listOpenReports, reportContent } from "./reports";

const NOW = new Date("2026-11-10T12:00:00Z");

/** Ada admins a group with Grace and Linus; Outsider is elsewhere. Each member has posted. */
async function setup() {
  const [ada, grace, linus, outsider] = await Promise.all(
    ["Ada", "Grace", "Linus", "Outsider"].map((name) => createTestUser({ name })),
  );
  const group = await createTestGroup([
    { userId: ada!.id, role: "ADMIN" },
    { userId: grace!.id, role: "MEMBER" },
    { userId: linus!.id, role: "MEMBER" },
  ]);
  const elsewhere = await createTestGroup([{ userId: outsider!.id, role: "ADMIN" }]);
  const post = (author: { id: string }, body: string) =>
    createPost(author.id, { groupId: group.id, body, problemId: null, spoiler: false });
  const [adaPost, gracePost, linusPost] = await Promise.all([
    post(ada!, "From Ada"),
    post(grace!, "From Grace"),
    post(linus!, "From Linus"),
  ]);
  return {
    ada: ada!,
    grace: grace!,
    linus: linus!,
    outsider: outsider!,
    group,
    elsewhere,
    adaPost,
    gracePost,
    linusPost,
  };
}

describe("reporting", () => {
  it("goes to the admin, once per person, without saying who reported", async () => {
    const { ada, grace, group, linusPost } = await setup();
    expect(
      await reportContent(grace.id, { postId: linusPost.id, reason: "SPAM", note: "Ads" }, NOW),
    ).toEqual({ created: true });
    expect(
      await reportContent(grace.id, { postId: linusPost.id, reason: "OTHER", note: null }, NOW),
    ).toEqual({ created: false });

    const items = await listOpenReports(ada.id, group.id);
    expect(items).toEqual([
      expect.objectContaining({
        kind: "post",
        id: linusPost.id,
        authorName: "Linus",
        excerpt: "From Linus",
        reports: 1,
        reasons: [{ reason: "SPAM", count: 1 }],
        notes: ["Ads"],
      }),
    ]);
    expect(JSON.stringify(items)).not.toContain(grace.id);
    expect(await countOpenReports(group.id)).toBe(1);
    // Only the admin reads them.
    await expect(listOpenReports(grace.id, group.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("covers comments, and the admin's own writing", async () => {
    const { ada, grace, group, adaPost, gracePost } = await setup();
    const comment = await createComment(ada.id, {
      postId: gracePost.id,
      parentId: null,
      body: "A comment by Ada",
      spoiler: false,
    });
    await reportContent(grace.id, { commentId: comment.id, reason: "HARASSMENT", note: null }, NOW);
    await reportContent(grace.id, { postId: adaPost.id, reason: "SPOILER", note: null }, NOW);
    const items = await listOpenReports(ada.id, group.id);
    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ["comment", comment.id],
      ["post", adaPost.id],
    ]);
    expect(items[0]).toMatchObject({ postId: gracePost.id, authorName: "Ada" });
  });

  it("refuses your own writing, the admin, outsiders, automatic posts, and too many", async () => {
    const { ada, grace, linus, outsider, group, gracePost, linusPost } = await setup();
    const report = (userId: string, postId: string) =>
      reportContent(userId, { postId, reason: "SPAM", note: null }, NOW);
    await expect(report(grace.id, gracePost.id)).rejects.toMatchObject({ code: "OWN" });
    await expect(report(ada.id, linusPost.id)).rejects.toMatchObject({ code: "ADMIN" });
    await expect(report(outsider.id, linusPost.id)).rejects.toBeInstanceOf(NotFoundError);
    const solve = await prisma.post.create({
      data: {
        groupId: group.id,
        authorId: linus.id,
        kind: "SOLVE",
        problemId: (
          await prisma.problem.create({
            data: { leetcodeSlug: "two-sum", title: "Two Sum", difficulty: "EASY", source: "SEED" },
          })
        ).id,
      },
    });
    await expect(report(grace.id, solve.id)).rejects.toMatchObject({ code: "NOT_REPORTABLE" });

    // Ten more of Linus's posts, reported today (made directly: posting has its own limit).
    for (let i = 0; i < 10; i++) {
      const extra = await prisma.post.create({
        data: { groupId: group.id, authorId: linus.id, body: `Post ${i}` },
      });
      await report(grace.id, extra.id);
    }
    await expect(report(grace.id, linusPost.id)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("closes when the admin removes the content, which is audited as before", async () => {
    const { ada, grace, group, linusPost } = await setup();
    await reportContent(grace.id, { postId: linusPost.id, reason: "SPAM", note: null }, NOW);
    await deletePost(ada.id, linusPost.id);
    expect(await listOpenReports(ada.id, group.id)).toEqual([]);
    expect(await prisma.report.count()).toBe(0);
    expect(
      await prisma.groupAuditEvent.count({ where: { groupId: group.id, action: "POST_REMOVED" } }),
    ).toBe(1);
  });

  it("can be dismissed by the admin (audited), and isn't filed again", async () => {
    const { ada, grace, linus, group, linusPost } = await setup();
    await reportContent(grace.id, { postId: linusPost.id, reason: "SPAM", note: null }, NOW);
    await expect(
      dismissReports(grace.id, group.id, { postId: linusPost.id }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await dismissReports(ada.id, group.id, { postId: linusPost.id }, NOW);
    expect(await listOpenReports(ada.id, group.id)).toEqual([]);
    expect(
      await prisma.groupAuditEvent.findFirst({ where: { action: "REPORT_DISMISSED" } }),
    ).toMatchObject({ actorId: ada.id, subjectUserId: linus.id });
    expect(
      await reportContent(grace.id, { postId: linusPost.id, reason: "SPAM", note: null }, NOW),
    ).toEqual({ created: false });
    await expect(dismissReports(ada.id, group.id, { postId: linusPost.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("is checked by the database: one target, its own group, a real note", async () => {
    const { grace, group, elsewhere, linusPost } = await setup();
    await expect(
      prisma.report.create({ data: { reporterId: grace.id, groupId: group.id, reason: "SPAM" } }),
    ).rejects.toThrow(/report_one_target/);
    await expect(
      prisma.report.create({
        data: { reporterId: grace.id, groupId: elsewhere.id, postId: linusPost.id, reason: "SPAM" },
      }),
    ).rejects.toThrow(/report_group_mismatch/);
    await expect(
      prisma.report.create({
        data: {
          reporterId: grace.id,
          groupId: group.id,
          postId: linusPost.id,
          reason: "SPAM",
          note: "   ",
        },
      }),
    ).rejects.toThrow(/report_note/);
  });
});

describe("blocking", () => {
  it("folds the blocked person's posts, comments, and reactions for the blocker only", async () => {
    const { ada, grace, linus, linusPost, adaPost } = await setup();
    await createComment(linus.id, {
      postId: adaPost.id,
      parentId: null,
      body: "Linus comments",
      spoiler: false,
    });
    await setReaction(linus.id, adaPost.id, "KUDOS", true);
    await blockUser(grace.id, linus.id);
    // Twice is fine.
    await blockUser(grace.id, linus.id);

    const feed = (await listFeed(grace.id)).items;
    expect(feed.find((p) => p.id === linusPost.id)).toMatchObject({ blocked: true });
    const adas = feed.find((p) => p.id === adaPost.id)!;
    expect(adas.blocked).toBe(false);
    expect(adas.threads?.[0]).toMatchObject({ body: "Linus comments", blocked: true });
    expect(adas.reactions.find((r) => r.kind === "KUDOS")?.count).toBe(0);
    expect((await listComments(grace.id, adaPost.id)).items[0]?.blocked).toBe(true);

    // Nobody else is affected.
    const adasView = await getPost(ada.id, adaPost.id);
    expect(adasView.reactions.find((r) => r.kind === "KUDOS")?.count).toBe(1);
    expect((await getPost(ada.id, linusPost.id)).blocked).toBe(false);

    expect(await listBlocked(grace.id)).toEqual([
      expect.objectContaining({ id: linus.id, name: "Linus" }),
    ]);
    await unblockUser(grace.id, linus.id);
    expect((await getPost(grace.id, linusPost.id)).blocked).toBe(false);
  });

  it("stops the blocked person commenting on the blocker's posts or replying to them", async () => {
    const { grace, linus, gracePost, adaPost } = await setup();
    const graces = await createComment(grace.id, {
      postId: adaPost.id,
      parentId: null,
      body: "Grace on Ada's post",
      spoiler: false,
    });
    await blockUser(grace.id, linus.id);
    const comment = (postId: string, parentId: string | null) =>
      createComment(linus.id, { postId, parentId, body: "Hi", spoiler: false });
    await expect(comment(gracePost.id, null)).rejects.toMatchObject({
      code: "NOT_TAKING_REPLIES",
    });
    await expect(comment(adaPost.id, graces.id)).rejects.toMatchObject({
      code: "NOT_TAKING_REPLIES",
    });
    // Elsewhere, Linus carries on; and Grace can still reply to Linus.
    const onAdas = await comment(adaPost.id, null);
    await createComment(grace.id, {
      postId: adaPost.id,
      parentId: onAdas.id,
      body: "Grace replies",
      spoiler: false,
    });
    await deleteComment(linus.id, onAdas.id);
  });

  it("leaves group progress alone: both still see each other there", async () => {
    const { ada, grace, linus, group } = await setup();
    const version = await createPublishedRoadmap();
    await createPlan(
      ada.id,
      group.id,
      {
        roadmapVersionId: version.id,
        startDate: "2026-11-09",
        pacing: { mode: "PER_WEEK", problemsPerWeek: 2 },
      },
      NOW,
    );
    await blockUser(grace.id, linus.id);
    for (const [viewer, other] of [
      [grace, linus],
      [linus, grace],
    ] as const) {
      const { members } = await getGroupProgress(viewer.id, group.id, NOW);
      expect(members.map((m) => m.userId)).toContain(other.id);
    }
  });

  it("only works between people who share a group, never yourself", async () => {
    const { grace, outsider } = await setup();
    await expect(blockUser(grace.id, outsider.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(blockUser(grace.id, grace.id)).rejects.toBeInstanceOf(DomainError);
    await expect(unblockUser(grace.id, outsider.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      prisma.userBlock.create({ data: { blockerId: grace.id, blockedId: grace.id } }),
    ).rejects.toThrow(/user_block_not_self/);
  });
});
