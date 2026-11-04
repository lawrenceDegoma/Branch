import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { createTestGroup, createTestUser } from "@/test/factories";
import { createComment, deleteComment, editComment, listComments } from "./comments";
import { setReaction } from "./reactions";
import { createPost, deletePost, editPost, getPost, hidePost, listFeed } from "./service";

// PRD scenario 5: a non-member cannot reach a group's activity through any read or write, and a
// member who leaves loses access at once. Every call below is what a server action or page would
// make for that person; each must fail as not found, revealing nothing.

const NOW = new Date("2026-11-04T12:00:00Z");

async function setup() {
  const [ada, grace, olu] = await Promise.all([
    createTestUser({ name: "Ada" }),
    createTestUser({ name: "Grace" }),
    createTestUser({ name: "Olu" }),
  ]);
  const study = await createTestGroup([
    { userId: ada.id, role: "ADMIN" },
    { userId: grace.id, role: "MEMBER" },
  ]);
  await createTestGroup([{ userId: olu.id, role: "ADMIN" }], { name: "Olu's own" });
  const post = await createPost(
    ada.id,
    { groupId: study.id, body: "Private plans", problemId: null, spoiler: false },
    NOW,
  );
  const comment = await createComment(
    ada.id,
    { postId: post.id, parentId: null, body: "Private reply", spoiler: false },
    NOW,
  );
  return { ada, grace, olu, study, post, comment };
}

/** Every feed read and write, as `userId`, against the group's post and comment. */
function attempts(userId: string, ids: { groupId: string; postId: string; commentId: string }) {
  const text = { body: "x", spoiler: false };
  return {
    "list the group's feed": () => listFeed(userId, { groupId: ids.groupId }),
    "open the post": () => getPost(userId, ids.postId),
    "list its comments": () => listComments(userId, ids.postId),
    "post to the group": () =>
      createPost(userId, { groupId: ids.groupId, problemId: null, ...text }),
    "edit the post": () => editPost(userId, ids.postId, text),
    "delete the post": () => deletePost(userId, ids.postId),
    "hide the post": () => hidePost(userId, ids.postId),
    "react to the post": () => setReaction(userId, ids.postId, "KUDOS", true),
    "comment on the post": () =>
      createComment(userId, { postId: ids.postId, parentId: null, ...text }),
    "reply to the comment": () =>
      createComment(userId, { postId: ids.postId, parentId: ids.commentId, ...text }),
    "edit the comment": () => editComment(userId, ids.commentId, text),
    "delete the comment": () => deleteComment(userId, ids.commentId),
  };
}

async function expectNoAccess(userId: string, ids: Parameters<typeof attempts>[1]) {
  for (const [what, attempt] of Object.entries(attempts(userId, ids))) {
    await expect(attempt(), what).rejects.toBeInstanceOf(NotFoundError);
  }
  // The unified feed simply doesn't include the group.
  const { items } = await listFeed(userId);
  expect(items.map((item) => item.body)).not.toContain("Private plans");
}

describe("group privacy (PRD scenario 5)", () => {
  it("gives a non-member no way to read or write the group's activity", async () => {
    const { olu, study, post, comment } = await setup();
    const ids = { groupId: study.id, postId: post.id, commentId: comment.id };
    await expectNoAccess(olu.id, ids);
    // Nothing was written by the attempts.
    expect(await prisma.post.count()).toBe(1);
    expect(await prisma.comment.count()).toBe(1);
    expect(await prisma.reaction.count()).toBe(0);
  });

  it("takes access away from a member as soon as they leave", async () => {
    const { grace, study, post, comment } = await setup();
    const ids = { groupId: study.id, postId: post.id, commentId: comment.id };
    expect((await getPost(grace.id, post.id)).body).toBe("Private plans");
    await prisma.groupMembership.delete({
      where: { groupId_userId: { groupId: study.id, userId: grace.id } },
    });
    await expectNoAccess(grace.id, ids);
  });

  it("treats malformed IDs as not found rather than as errors", async () => {
    const { ada } = await setup();
    await expect(getPost(ada.id, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      editComment(ada.id, "not-a-uuid", { body: "x", spoiler: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
