import { describe, expect, it } from "vitest";
import {
  createNeetcodeDetector,
  leetcodeLanguage,
  leetcodeSlug,
  neetcodeRequest,
  observeNeetcode,
} from "./neetcode";

// Shapes as recorded in docs/NEETCODE-SPIKE.md (values shortened).
const CODE =
  "class Solution:\n    def hasDuplicate(self, nums):\n        return len(set(nums)) < len(nums)";
const DATE = "2026-11-07T19:11:02.313Z";

const problem = (id = "duplicate-integer", name = "Contains Duplicate") => ({
  kind: "problem" as const,
  response: {
    data: {
      id,
      name,
      difficulty: "Easy",
      solutions: { python: "official solution" },
      submissionHistory: [{ code: "an old submission", statusDescription: "Accepted" }],
    },
  },
});

const execute = (result: Record<string, unknown> = {}, request: Record<string, unknown> = {}) => ({
  kind: "execute" as const,
  request: { data: { lang: "python", problemId: "duplicate-integer", rawCode: CODE, ...request } },
  response: {
    data: {
      status: { id: 3, description: "Accepted" },
      correct_test_case_count: 34,
      test_case_count: 34,
      date: DATE,
      ...result,
    },
  },
});

describe("neetcode.io detection", () => {
  it("sends an accepted submission as the LeetCode problem its title names", () => {
    const state = createNeetcodeDetector();
    expect(observeNeetcode(state, problem())).toBeNull();
    expect(observeNeetcode(state, execute())).toEqual({
      type: "accepted",
      payload: {
        source: "NEETCODE",
        verdict: "ACCEPTED",
        submissionId: String(Date.parse(DATE)),
        problemSlug: "contains-duplicate",
        language: "python3",
        code: CODE,
        submittedAt: Math.floor(Date.parse(DATE) / 1000),
      },
    });
  });

  it("keeps only the problem's ID and title from its details", () => {
    const state = createNeetcodeDetector();
    observeNeetcode(state, problem());
    expect([...state.titles]).toEqual([["duplicate-integer", "Contains Duplicate"]]);
  });

  it("sends each submission once", () => {
    const state = createNeetcodeDetector();
    observeNeetcode(state, problem());
    expect(observeNeetcode(state, execute())?.type).toBe("accepted");
    expect(observeNeetcode(state, execute())).toBeNull();
    expect(observeNeetcode(state, execute({ date: "2026-11-07T19:12:00.000Z" }))?.type).toBe(
      "accepted",
    );
  });

  it("sends nothing for a wrong answer, an error, or a partial pass", () => {
    const state = createNeetcodeDetector();
    observeNeetcode(state, problem());
    const wrong = { status: { id: 4, description: "Wrong Answer" }, correct_test_case_count: 12 };
    expect(observeNeetcode(state, execute(wrong))).toEqual({
      type: "not-accepted",
      slug: "contains-duplicate",
    });
    expect(
      observeNeetcode(state, execute({ status: { id: 11, description: "Runtime Error (NZEC)" } })),
    ).toMatchObject({ type: "not-accepted" });
    expect(observeNeetcode(state, execute({ correct_test_case_count: 33 }))).toMatchObject({
      type: "not-accepted",
    });
  });

  it("waits while judging", () => {
    const state = createNeetcodeDetector();
    observeNeetcode(state, problem());
    expect(observeNeetcode(state, execute({ status: { id: 2 } }))).toBeNull();
  });

  it("sends nothing when it never saw the problem's title", () => {
    expect(observeNeetcode(createNeetcodeDetector(), execute())).toEqual({
      type: "unidentified",
      slug: "duplicate-integer",
    });
  });

  it("ignores shapes it doesn't recognize", () => {
    const state = createNeetcodeDetector();
    observeNeetcode(state, problem());
    expect(observeNeetcode(state, { kind: "execute", request: null, response: null })).toBeNull();
    expect(observeNeetcode(state, execute({}, { rawCode: "" }))).toBeNull();
    expect(observeNeetcode(state, execute({ status: "Accepted" }))).toBeNull();
    expect(observeNeetcode(state, execute({}, { problemId: "../etc" }))).toBeNull();
    observeNeetcode(state, problem("Not A Slug", "x"));
    expect(state.titles.has("Not A Slug")).toBe(false);
  });

  it("remembers a bounded number of titles", () => {
    const state = createNeetcodeDetector();
    for (let i = 0; i < 150; i++) observeNeetcode(state, problem(`p-${i}`, `Problem ${i}`));
    expect(state.titles.size).toBe(100);
    expect(state.titles.has("p-149")).toBe(true);
  });
});

describe("mapping to LeetCode", () => {
  it("makes LeetCode's slug from the title", () => {
    expect(leetcodeSlug("Contains Duplicate")).toBe("contains-duplicate");
    expect(leetcodeSlug("Pow(x, n)")).toBe("powx-n");
    expect(leetcodeSlug("Implement Trie (Prefix Tree)")).toBe("implement-trie-prefix-tree");
    expect(leetcodeSlug("3Sum")).toBe("3sum");
    expect(leetcodeSlug("Best Time to Buy and Sell Stock II")).toBe(
      "best-time-to-buy-and-sell-stock-ii",
    );
    expect(leetcodeSlug("???")).toBeNull();
  });

  it("names languages the way LeetCode does", () => {
    expect(leetcodeLanguage("python")).toBe("python3");
    expect(leetcodeLanguage("go")).toBe("golang");
    expect(leetcodeLanguage("cpp")).toBe("cpp");
  });

  it("reads only the two requests it needs", () => {
    expect(neetcodeRequest("/api/getProblemMetadataFunctionHttp")).toBe("problem");
    expect(neetcodeRequest("/api/executeCodeFunctionHttp")).toBe("execute");
    expect(neetcodeRequest("/api/runCodeFunctionHttp")).toBeNull();
    expect(neetcodeRequest("/api/callableFunctionHttp")).toBeNull();
  });
});
