import { prisma } from "@branch/database";
import { describe, expect, it } from "vitest";
import { DomainError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { createPlan } from "@/modules/plans/service";
import { createPublishedRoadmap, createTestGroup, createTestUser } from "@/test/factories";
import { createPost, deletePost, editPost, listComposerGroups, listFeed } from "./service";

const NOW = new Date("2026-11-03T20:00:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

/** Ada administers Study; Grace is in Study and Other; Olu is in neither. */
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
  const other = await createTestGroup([{ userId: grace.id, role: "ADMIN" }], { name: "Other" });
  return { ada, grace, olu, study, other };
}

const post = (authorId: string, groupId: string, body: string, at = NOW) =>
  createPost(authorId, { groupId, body, problemId: null }, at);

describe("feed visibility", () => {
  it("shows each person only the posts of groups they belong to", async () => {
    const { ada, grace, olu, study, other } = await setup();
    await post(ada.id, study.id, "in study");
    await post(grace.id, other.id, "in other", later(1));

    const bodies = async (userId: string) =>
      (await listFeed(userId)).items.map((item) => item.body);
    expect(await bodies(grace.id)).toEqual(["in other", "in study"]);
    expect(await bodies(ada.id)).toEqual(["in study"]);
    expect(await bodies(olu.id)).toEqual([]);
  });

  it("filters to one group, and treats a group the viewer isn't in as not found", async () => {
    const { ada, grace, study, other } = await setup();
    await post(ada.id, study.id, "in study");
    await post(grace.id, other.id, "in other", later(1));
    expect((await listFeed(grace.id, { groupId: study.id })).items.map((i) => i.body)).toEqual([
      "in study",
    ]);
    await expect(listFeed(ada.id, { groupId: other.id })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("pages newest first with a cursor and no overlap", async () => {
    const { ada, study } = await setup();
    for (let i = 0; i < 5; i++) await post(ada.id, study.id, `post ${i}`, later(i * 2));
    const first = await listFeed(ada.id, { limit: 2 });
    expect(first.items.map((i) => i.body)).toEqual(["post 4", "post 3"]);
    const second = await listFeed(ada.id, { limit: 2, before: first.nextCursor! });
    expect(second.items.map((i) => i.body)).toEqual(["post 2", "post 1"]);
    const third = await listFeed(ada.id, { limit: 2, before: second.nextCursor! });
    expect(third.items.map((i) => i.body)).toEqual(["post 0"]);
    expect(third.nextCursor).toBeNull();
  });
});

describe("writing posts", () => {
  it("lets only members post to a group", async () => {
    const { olu, study } = await setup();
    await expect(post(olu.id, study.id, "hello")).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.post.count()).toBe(0);
  });

  it("limits how quickly one person can post", async () => {
    const { ada, study } = await setup();
    for (let i = 0; i < 5; i++) await post(ada.id, study.id, `post ${i}`, later(0));
    await expect(post(ada.id, study.id, "one more", later(0))).rejects.toBeInstanceOf(DomainError);
    await expect(post(ada.id, study.id, "a minute later", later(2))).resolves.toBeDefined();
  });

  it("rejects a problem that doesn't exist", async () => {
    const { ada, study } = await setup();
    await expect(
      createPost(ada.id, { groupId: study.id, body: "hi", problemId: crypto.randomUUID() }, NOW),
    ).rejects.toMatchObject({ field: "problemId" });
  });
});

describe("editing and deleting", () => {
  it("lets only the author edit, and hides the post from non-members", async () => {
    const { ada, grace, olu, study } = await setup();
    const created = await post(grace.id, study.id, "first draft");
    await expect(editPost(ada.id, created.id, "hijacked")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(editPost(olu.id, created.id, "hijacked")).rejects.toBeInstanceOf(NotFoundError);
    const edited = await editPost(grace.id, created.id, "second draft", later(5));
    expect(edited).toMatchObject({ body: "second draft", editedAt: later(5) });
  });

  it("lets the author delete, and the admin remove with an audit record", async () => {
    const { ada, grace, olu, study } = await setup();
    const own = await post(grace.id, study.id, "mine");
    const removed = await post(grace.id, study.id, "spam", later(1));
    const adas = await post(ada.id, study.id, "the admin's", later(2));

    await expect(deletePost(olu.id, own.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(deletePost(grace.id, adas.id)).rejects.toBeInstanceOf(ForbiddenError);
    await deletePost(grace.id, own.id);
    await deletePost(ada.id, removed.id);

    expect((await listFeed(ada.id)).items.map((i) => i.body)).toEqual(["the admin's"]);
    const audit = await prisma.groupAuditEvent.findMany({ where: { action: "POST_REMOVED" } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: ada.id, subjectUserId: grace.id });
  });

  it("reports what the viewer may do with each post", async () => {
    const { ada, grace, study } = await setup();
    await post(grace.id, study.id, "grace's");
    const [asAdmin] = (await listFeed(ada.id)).items;
    const [asAuthor] = (await listFeed(grace.id)).items;
    expect(asAdmin).toMatchObject({ canEdit: false, canDelete: true });
    expect(asAuthor).toMatchObject({ canEdit: true, canDelete: true });
  });
});

describe("composer groups", () => {
  it("lists the viewer's groups with their plan's problems", async () => {
    const { ada, grace, study } = await setup();
    const version = await createPublishedRoadmap();
    await createPlan(
      ada.id,
      study.id,
      {
        roadmapVersionId: version.id,
        startDate: "2026-11-02",
        pacing: { mode: "PER_WEEK", problemsPerWeek: 2 },
      },
      NOW,
    );
    const groups = await listComposerGroups(grace.id);
    expect(groups.map((g) => g.name)).toEqual(["Other", "Study"]);
    expect(groups[0]!.problems).toEqual([]);
    expect(groups[1]!.problems[0]).toMatchObject({ title: "Two Sum" });
  });
});
