import { prisma } from "@branch/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listFeed } from "@/modules/feed/service";
import { listSubmissions } from "@/modules/integrations/submissions";
import { createPlan } from "@/modules/plans/service";
import { getGroupProgress, getHome, setCompletion } from "@/modules/progress/service";
import { getReviewQueue } from "@/modules/review/service";
import { getStats } from "@/modules/stats/service";
import { createPublishedRoadmap, createTestGroup, createTestUser } from "@/test/factories";

// How many queries the heaviest reads make for a full page of data. Prisma loads each included
// relation with one batched query, so a read's count is fixed whatever the page holds; the
// budgets are the measured counts, and a rise means an N+1 or a lost batch. (PRISMA_LOG_QUERIES=1
// in vitest.config.ts makes the client emit each query.)

const NOW = new Date("2026-11-10T12:00:00Z");
const BUDGET = {
  listFeed: 20,
  getHome: 13,
  getGroupProgress: 14,
  getStats: 15,
  listSubmissions: 4,
  getReviewQueue: 15,
};

let queries: string[] = [];
const client = prisma as unknown as {
  $on(event: "query", listener: (event: { query: string }) => void): void;
};

/** QUERY_BUDGET_VERBOSE=1 prints each read's queries (table and shape), to find the extra ones. */
async function count(name: string, run: () => Promise<unknown>): Promise<number> {
  queries = [];
  await run();
  if (process.env.QUERY_BUDGET_VERBOSE) {
    console.log(`\n${name}:`);
    for (const q of queries) console.log("  " + q.replace(/\s+/g, " ").slice(0, 110));
  }
  return queries.length;
}

describe("query budgets", () => {
  beforeAll(() => client.$on("query", (event) => queries.push(event.query)));
  afterAll(() => undefined);

  it("hold for a busy group and a full feed page", async () => {
    const version = await createPublishedRoadmap();
    const [ada, ...others] = await Promise.all(
      ["Ada", "Grace", "Linus", "Margaret", "Barbara"].map((name) => createTestUser({ name })),
    );
    await prisma.profile.createMany({
      data: [ada!, ...others].map((u) => ({
        userId: u.id,
        username: u.name.toLowerCase(),
        timezone: "UTC",
      })),
    });
    const group = await createTestGroup([
      { userId: ada!.id, role: "ADMIN" },
      ...others.map((u) => ({ userId: u.id, role: "MEMBER" as const })),
    ]);
    await createPlan(
      ada!.id,
      group.id,
      {
        roadmapVersionId: version.id,
        startDate: "2026-11-02",
        pacing: { mode: "PER_WEEK", problemsPerWeek: 2 },
      },
      NOW,
    );
    // Solves and a review for the stats and review pages.
    for (const item of version.items.slice(0, 3)) {
      await setCompletion(ada!.id, item.problem.id, true, NOW, { source: "MANUAL" });
    }
    await prisma.reviewSchedule.updateMany({ where: { userId: ada!.id }, data: { dueOn: NOW } });
    // A full feed page: 20 posts, each with a thread of two and a reaction (written directly;
    // the services' own rate limits aren't the point here).
    for (let i = 0; i < 20; i++) {
      const author = i % 2 === 0 ? ada! : others[i % others.length]!;
      const post = await prisma.post.create({
        data: {
          groupId: group.id,
          authorId: author.id,
          body: `Post ${i}`,
          createdAt: new Date(NOW.getTime() - i * 60_000 * 20),
        },
      });
      const top = await prisma.comment.create({
        data: { postId: post.id, authorId: others[0]!.id, body: "A comment" },
      });
      await prisma.comment.create({
        data: { postId: post.id, authorId: ada!.id, parentId: top.id, body: "A reply" },
      });
      await prisma.reaction.create({
        data: { postId: post.id, userId: others[1]!.id, kind: "KUDOS" },
      });
    }

    const measured = {
      listFeed: await count("listFeed", () => listFeed(ada!.id)),
      getHome: await count("getHome", () => getHome(ada!.id, "UTC", NOW)),
      getGroupProgress: await count("getGroupProgress", () => getGroupProgress(ada!.id, group.id)),
      getStats: await count("getStats", () => getStats(ada!.id, "UTC", NOW)),
      listSubmissions: await count("listSubmissions", () => listSubmissions(ada!.id)),
      getReviewQueue: await count("getReviewQueue", () => getReviewQueue(ada!.id, "UTC", NOW)),
    };
    console.log("queries per read:", JSON.stringify(measured));
    // Not per post: a quarter of the page costs the same number of queries.
    expect(await count("listFeed (5 posts)", () => listFeed(ada!.id, { limit: 5 }))).toBe(
      measured.listFeed,
    );
    for (const [name, used] of Object.entries(measured)) {
      expect(used, `${name} made ${used} queries`).toBeLessThanOrEqual(
        BUDGET[name as keyof typeof BUDGET],
      );
    }
  });
});
