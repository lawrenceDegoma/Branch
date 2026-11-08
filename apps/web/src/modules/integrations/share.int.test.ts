import { prisma } from "@branch/database";
import { syncCatalog } from "@branch/database/catalog-import";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";
import { setAnalyzeSolutions } from "@/modules/analysis/service";
import { setCompletion } from "@/modules/progress/service";
import { createTestGroup, createTestUser, testCatalog } from "@/test/factories";
import { shareSolution } from "./share";
import { pasteSolution } from "./submissions";

const NOW = new Date("2026-11-08T12:00:00Z");
const CODE = "class Solution:\n    def twoSum(self, nums, target):\n        return []";

beforeEach(async () => {
  await syncCatalog(prisma, testCatalog, "SEED");
});

/** A member of a group with a pasted, analyzed Two Sum. */
async function setup({ estimate = true } = {}) {
  const [ada, grace] = await Promise.all([createTestUser(), createTestUser()]);
  await prisma.profile.createMany({
    data: [ada, grace].map((u) => ({
      userId: u.id,
      username: `u${u.id.slice(0, 8)}`,
      timezone: "UTC",
    })),
  });
  const group = await createTestGroup([
    { userId: ada.id, role: "ADMIN" },
    { userId: grace.id, role: "MEMBER" },
  ]);
  const twoSum = await prisma.problem.findUniqueOrThrow({ where: { leetcodeSlug: "two-sum" } });
  await setCompletion(ada.id, twoSum.id, true, NOW);
  const solution = await pasteSolution(
    ada.id,
    { problemId: twoSum.id, language: "python3", code: CODE },
    NOW,
  );
  if (estimate) {
    const result = await prisma.analysisResult.create({
      data: {
        codeHash: "e".repeat(64),
        language: "python3",
        problemSlug: "two-sum",
        analyzerVersion: "test",
        outcome: "OK",
        time: "O(n)",
        space: "O(n)",
        confidence: "HIGH",
        notation: "Where n is the length of `nums`.",
      },
    });
    await prisma.analysisJob.create({
      data: {
        submissionId: solution.id,
        userId: ada.id,
        status: "DONE",
        resultId: result.id,
        finishedAt: NOW,
      },
    });
  }
  return { ada, grace, group, twoSum, solution };
}

describe("sharing a solution", () => {
  it("posts its estimate to the chosen group, without the code unless asked", async () => {
    const { ada, group, twoSum, solution } = await setup();
    const post = await shareSolution(
      ada.id,
      { submissionId: solution.id, groupId: group.id, note: "Hash map!" },
      NOW,
    );
    expect(post).toMatchObject({
      groupId: group.id,
      authorId: ada.id,
      problemId: twoSum.id,
      spoiler: false,
      kind: "TEXT",
    });
    expect(post.body).toContain("Shared my solution to **Two Sum** (Python 3).");
    expect(post.body).toContain("Hash map!");
    expect(post.body).toContain(
      "Branch's estimate: probably O(n) time and O(n) space, high confidence.",
    );
    expect(post.body).toContain("Where n is the length of `nums`.");
    expect(post.body).not.toContain("def twoSum");
  });

  it("includes the code folded as a spoiler when asked", async () => {
    const { ada, group, solution } = await setup();
    const post = await shareSolution(
      ada.id,
      { submissionId: solution.id, groupId: group.id, includeCode: "on" },
      NOW,
    );
    expect(post.spoiler).toBe(true);
    expect(post.body).toContain("```python\n" + CODE + "\n```");
  });

  it("only shares your own solution, only to your own groups", async () => {
    const { ada, grace, solution } = await setup();
    const elsewhere = await createTestGroup([{ userId: grace.id, role: "ADMIN" }]);
    await expect(
      shareSolution(ada.id, { submissionId: solution.id, groupId: elsewhere.id }, NOW),
    ).rejects.toBeInstanceOf(NotFoundError);
    const graceGroup = await createTestGroup([{ userId: grace.id, role: "ADMIN" }]);
    await expect(
      shareSolution(grace.id, { submissionId: solution.id, groupId: graceGroup.id }, NOW),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.post.count()).toBe(0);
  });

  it("needs something to share, and refuses code too long for a post", async () => {
    const { ada, group, solution } = await setup({ estimate: false });
    await expect(
      shareSolution(ada.id, { submissionId: solution.id, groupId: group.id }, NOW),
    ).rejects.toMatchObject({ code: "NOTHING_TO_SHARE", field: "includeCode" });
    await prisma.submission.update({
      where: { id: solution.id },
      data: { code: "x = 1\n".repeat(1000) },
    });
    await expect(
      shareSolution(
        ada.id,
        { submissionId: solution.id, groupId: group.id, includeCode: "on" },
        NOW,
      ),
    ).rejects.toMatchObject({ code: "TOO_LONG" });
    await expect(
      shareSolution(ada.id, { submissionId: "nope", groupId: group.id }, NOW),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("leaves the estimate out once analysis is turned off", async () => {
    const { ada, group, solution } = await setup();
    await setAnalyzeSolutions(ada.id, false);
    await expect(
      shareSolution(ada.id, { submissionId: solution.id, groupId: group.id }, NOW),
    ).rejects.toMatchObject({ code: "NOTHING_TO_SHARE" });
    const post = await shareSolution(
      ada.id,
      { submissionId: solution.id, groupId: group.id, includeCode: "on" },
      NOW,
    );
    expect(post.body).not.toContain("estimate");
  });
});
