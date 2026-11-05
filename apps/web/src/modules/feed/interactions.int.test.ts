import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { createTestGroup, createTestUser } from "@/test/factories";
import { createComment, deleteComment, editComment, listComments } from "./comments";
import { setReaction } from "./reactions";
import { createPost, deletePost, getPost, listFeed } from "./service";

const NOW = new Date("2026-11-04T12:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

/** Ada admins Study with Grace in it; Olu is in no group. Grace has written one post. */
async function setup() {
  const [ada, grace, olu] = await Promise.all([
    createTestUser({ name: "Ada" }),
    createTestUser({ name: "Grace" }),
    createTestUser({ name: "Olu" }),
  ]);
  const study = await createTestGroup(
    [
      { userId: ada.id, role: "ADMIN" },
      { userId: grace.id, role: "MEMBER" },
    ],
    { name: "Study" },
  );
  const post = await createPost(
    grace.id,
    { groupId: study.id, body: "Stuck on this one", problemId: null, spoiler: false },
    NOW,
  );
  return { ada, grace, olu, study, post };
}

const comment = (authorId: string, postId: string, body: string, parentId?: string, at = NOW) =>
  createComment(authorId, { postId, parentId: parentId ?? null, body, spoiler: false }, at);

const counts = (summary: { kind: string; count: number; mine: boolean }[]) =>
  Object.fromEntries(summary.map((r) => [r.kind, [r.count, r.mine]]));

describe("reactions", () => {
  it("toggles each kind once per person, and shows each viewer their own", async () => {
    const { ada, grace, post } = await setup();
    await Promise.all([
      setReaction(ada.id, post.id, "KUDOS", true),
      setReaction(ada.id, post.id, "KUDOS", true),
      setReaction(ada.id, post.id, "HELPFUL", true),
      setReaction(grace.id, post.id, "KUDOS", true),
    ]);
    expect(counts((await getPost(ada.id, post.id)).reactions)).toEqual({
      KUDOS: [2, true],
      IMPRESSIVE: [0, false],
      HELPFUL: [1, true],
      SAME_HERE: [0, false],
    });
    await setReaction(ada.id, post.id, "KUDOS", false);
    await setReaction(ada.id, post.id, "KUDOS", false);
    const { items } = await listFeed(grace.id);
    expect(counts(items[0]!.reactions)).toMatchObject({ KUDOS: [1, true], HELPFUL: [1, false] });
  });

  it("is only possible on posts the person can see", async () => {
    const { olu, grace, post } = await setup();
    await expect(setReaction(olu.id, post.id, "KUDOS", true)).rejects.toBeInstanceOf(NotFoundError);
    const solve = await prisma.post.create({
      data: {
        groupId: post.groupId,
        authorId: grace.id,
        kind: "SOLVE",
        problemId: (
          await prisma.problem.create({
            data: { leetcodeSlug: "two-sum", title: "Two Sum", difficulty: "EASY", source: "SEED" },
          })
        ).id,
        hiddenAt: NOW,
      },
    });
    await expect(setReaction(grace.id, solve.id, "KUDOS", true)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    await prisma.post.update({ where: { id: solve.id }, data: { hiddenAt: null } });
    await setReaction(grace.id, solve.id, "KUDOS", true); // automatic posts take reactions too
  });
});

describe("comments", () => {
  it("lets members comment and reply in two levels; outsiders see nothing", async () => {
    const { ada, grace, olu, post } = await setup();
    const top = await comment(ada.id, post.id, "Try a hash map", undefined, later(1));
    const reply = await comment(grace.id, post.id, "Thanks!", top.id, later(2));
    // Replying to a reply files it under the same top-level comment.
    const nested = await comment(ada.id, post.id, "Any time", reply.id, later(3));
    expect(nested.parentId).toBe(top.id);

    const { items } = await listComments(grace.id, post.id);
    expect(items.map((c) => [c.body, c.replies.map((r) => r.body)])).toEqual([
      ["Try a hash map", ["Thanks!", "Any time"]],
    ]);
    expect((await getPost(grace.id, post.id)).commentCount).toBe(3);

    await expect(listComments(olu.id, post.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(comment(olu.id, post.id, "hi")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses a parent from another post", async () => {
    const { ada, grace, study, post } = await setup();
    const other = await createPost(
      ada.id,
      { groupId: study.id, body: "Another", problemId: null, spoiler: false },
      later(1),
    );
    const elsewhere = await comment(ada.id, other.id, "Over here");
    await expect(comment(grace.id, post.id, "hi", elsewhere.id)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("lets only the author edit", async () => {
    const { ada, grace, olu, post } = await setup();
    const mine = await comment(grace.id, post.id, "frist");
    const edit = { body: "first", spoiler: true };
    await expect(editComment(ada.id, mine.id, edit)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(editComment(olu.id, mine.id, edit)).rejects.toBeInstanceOf(NotFoundError);
    expect(await editComment(grace.id, mine.id, edit, later(5))).toMatchObject({
      body: "first",
      spoiler: true,
      editedAt: later(5),
    });
  });

  it("deletes a comment's replies with it", async () => {
    const { ada, grace, post } = await setup();
    const top = await comment(grace.id, post.id, "Is this O(n)?");
    await comment(ada.id, post.id, "Yes", top.id, later(1));
    const other = await comment(ada.id, post.id, "Unrelated", undefined, later(2));
    await deleteComment(grace.id, top.id);

    const { items } = await listComments(ada.id, post.id);
    expect(items.map((c) => [c.body, c.replies.length])).toEqual([["Unrelated", 0]]);
    expect((await getPost(ada.id, post.id)).commentCount).toBe(1);
    await expect(
      editComment(grace.id, top.id, { body: "x", spoiler: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await deleteComment(ada.id, other.id);
    expect(await prisma.comment.count()).toBe(0);
  });

  it("shows a post's first threads inline in the feed", async () => {
    const { ada, grace, post } = await setup();
    const top = await comment(grace.id, post.id, "Try a hash map", undefined, later(1));
    await comment(ada.id, post.id, "Thanks!", top.id, later(2));
    const { items } = await listFeed(ada.id);
    expect(
      items[0]!.threads!.map((c) => [c.body, c.canDelete, c.replies.map((r) => r.body)]),
    ).toEqual([["Try a hash map", true, ["Thanks!"]]]);
    expect(items[0]!.commentCount).toBe(2);
  });

  it("lets the admin remove a member's comment, recorded in the audit log", async () => {
    const { ada, grace, post } = await setup();
    const spam = await comment(grace.id, post.id, "Buy cheap watches");
    const adas = await comment(ada.id, post.id, "Welcome!");
    await expect(deleteComment(grace.id, adas.id)).rejects.toBeInstanceOf(ForbiddenError);
    await deleteComment(ada.id, spam.id);
    expect(
      await prisma.groupAuditEvent.findMany({ where: { action: "COMMENT_REMOVED" } }),
    ).toMatchObject([{ actorId: ada.id, subjectUserId: grace.id }]);
    const { items } = await listComments(grace.id, post.id);
    expect(items.map((c) => [c.body, c.canEdit, c.canDelete])).toEqual([
      ["Welcome!", false, false],
    ]);
  });

  it("limits how quickly one person can comment", async () => {
    const { grace, post } = await setup();
    for (let i = 0; i < 10; i++) await comment(grace.id, post.id, `c${i}`, undefined, NOW);
    await expect(comment(grace.id, post.id, "one more", undefined, NOW)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    await comment(grace.id, post.id, "later", undefined, later(2));
  });

  it("pages top-level comments oldest first", async () => {
    const { ada, post } = await setup();
    for (let i = 1; i <= 5; i++) await comment(ada.id, post.id, `c${i}`, undefined, later(i * 2));
    const first = await listComments(ada.id, post.id, { limit: 3 });
    expect(first.items.map((c) => c.body)).toEqual(["c1", "c2", "c3"]);
    const second = await listComments(ada.id, post.id, { limit: 3, after: first.nextCursor! });
    expect(second.items.map((c) => c.body)).toEqual(["c4", "c5"]);
    expect(second.nextCursor).toBeNull();
  });

  it("goes with its post", async () => {
    const { ada, grace, post } = await setup();
    await comment(ada.id, post.id, "hi");
    await setReaction(ada.id, post.id, "KUDOS", true);
    await deletePost(grace.id, post.id);
    expect(await prisma.comment.count()).toBe(0);
    expect(await prisma.reaction.count()).toBe(0);
  });
});
