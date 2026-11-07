import { prisma } from "@branch/database";
import { syncCatalog } from "@branch/database/catalog-import";
import { beforeEach, describe, expect, it } from "vitest";
import { setCompletion } from "@/modules/progress/service";
import { createTestUser, testCatalog } from "@/test/factories";
import { getPractice } from "./practice";
import { recordReview } from "./service";

const TZ = "America/New_York";
const NOW = new Date("2026-11-03T20:00:00Z");
const FRIDAY = new Date("2026-11-06T20:00:00Z");
const SATURDAY = new Date("2026-11-07T20:00:00Z");
const MONDAY = new Date("2026-11-09T20:00:00Z");

beforeEach(async () => {
  await syncCatalog(
    prisma,
    {
      ...testCatalog,
      problems: [
        ...testCatalog.problems,
        {
          slug: "largest-rectangle-in-histogram",
          title: "Largest Rectangle in Histogram",
          difficulty: "HARD",
          premium: false,
          tags: ["stack"],
        },
        {
          slug: "baseball-game",
          title: "Baseball Game",
          difficulty: "EASY",
          premium: true,
          freeUrl: "https://example.com/baseball-game",
          tags: ["stack"],
        },
      ],
    },
    "SEED",
  );
});

async function problemId(slug: string) {
  return (await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: slug } })).id;
}

async function solver() {
  const user = await createTestUser();
  await prisma.profile.create({
    data: { userId: user.id, username: `u${user.id.slice(0, 8)}`, timezone: TZ },
  });
  return user;
}

describe("practice suggestions", () => {
  it("need reviews first; solved topics are listed as not reviewed", async () => {
    const user = await solver();
    await setCompletion(user.id, await problemId("two-sum"), true, NOW);
    const result = await getPractice(user.id, NOW);
    expect(result).toMatchObject({ reviewed: false, practice: [] });
    expect(result.standings).toEqual([
      expect.objectContaining({ solved: 1, total: 3, status: "not-reviewed" }),
    ]);
  });

  it("suggest unsolved, free problems in a topic the user struggles with, easiest first", async () => {
    const user = await solver();
    const [parens, twoSum] = await Promise.all([
      problemId("valid-parentheses"),
      problemId("two-sum"),
    ]);
    await setCompletion(user.id, parens, true, NOW);
    await setCompletion(user.id, twoSum, true, NOW);
    await recordReview(user.id, parens, "HARD", TZ, FRIDAY);
    await recordReview(user.id, twoSum, "GOOD", TZ, FRIDAY);

    const result = await getPractice(user.id, FRIDAY);
    expect(result.practice).toEqual([
      {
        topic: { slug: "stack", name: "Stack" },
        reason: "You struggled on your one Stack review so far.",
        problems: [
          expect.objectContaining({ title: "Min Stack", solved: false }),
          expect.objectContaining({ title: "Largest Rectangle in Histogram", solved: false }),
        ],
      },
    ]);
    expect(result.standings.map((s) => [s.topic.name, s.status, s.solved, s.total])).toEqual([
      ["Stack", "needs-practice", 1, 4],
      ["Arrays & Hashing", "going-well", 1, 3],
    ]);
  });

  it("keeps a suggestion the user just solved in place for a day", async () => {
    const user = await solver();
    const parens = await problemId("valid-parentheses");
    await setCompletion(user.id, parens, true, NOW);
    await recordReview(user.id, parens, "AGAIN", TZ, FRIDAY);
    await setCompletion(user.id, await problemId("min-stack"), true, SATURDAY);

    const titles = async (at: Date) =>
      (await getPractice(user.id, at)).practice[0]!.problems.map((p) => [p.title, p.solved]);
    expect(await titles(SATURDAY)).toEqual([
      ["Min Stack", true],
      ["Largest Rectangle in Histogram", false],
    ]);
    expect(await titles(MONDAY)).toEqual([["Largest Rectangle in Histogram", false]]);
  });

  it("never suggest a problem solved before the struggle, however recently", async () => {
    const user = await solver();
    const [parens, minStack] = await Promise.all([
      problemId("valid-parentheses"),
      problemId("min-stack"),
    ]);
    await setCompletion(user.id, parens, true, NOW);
    await setCompletion(user.id, minStack, true, new Date("2026-11-06T10:00:00Z"));
    await recordReview(user.id, parens, "AGAIN", TZ, FRIDAY);
    const [stack] = (await getPractice(user.id, FRIDAY)).practice;
    expect(stack!.problems.map((p) => p.title)).toEqual(["Largest Rectangle in Histogram"]);
  });

  it("are the user's own", async () => {
    const [user, other] = await Promise.all([solver(), solver()]);
    const parens = await problemId("valid-parentheses");
    await setCompletion(user.id, parens, true, NOW);
    await recordReview(user.id, parens, "AGAIN", TZ, FRIDAY);
    expect(await getPractice(other.id, FRIDAY)).toEqual({
      standings: [],
      practice: [],
      reviewed: false,
    });
  });
});
