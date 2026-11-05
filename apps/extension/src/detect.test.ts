import { describe, expect, it } from "vitest";
import { checkId, createDetector, observe, pageSubmissionId, submitSlug } from "./detect";

// Shapes recorded during the feasibility spike (docs/LEETCODE-SPIKE.md), with real code replaced.

const CODE =
  "class Solution:\n    def containsDuplicate(self, nums):\n        return len(set(nums)) < len(nums)";
const T0 = Date.UTC(2026, 10, 5, 6, 44, 20);

const submit = (id: number, code = CODE) => ({
  kind: "submit" as const,
  slug: "contains-duplicate",
  request: {
    lang: "python3",
    question_id: "217",
    solve_elapsed_ms: 224630,
    typed_code: code,
  },
  response: { submission_id: id },
});

const details = (id: number, fields: Record<string, unknown>) => ({
  kind: "graphql" as const,
  request: {
    operationName: "submissionDetails",
    query: "query submissionDetails($submissionId: ID!) { … }",
    variables: { submissionId: String(id) },
  },
  response: {
    data: {
      submissionDetails: {
        code: CODE,
        lang: { name: "python3", verboseName: "Python3" },
        question: { questionId: "217", titleSlug: "contains-duplicate" },
        timestamp: 1793861061,
        user: { username: "someone" },
        ...fields,
      },
    },
  },
});

const judging = (id: number) =>
  details(id, { statusCode: 16, totalCorrect: null, totalTestcases: 0 });
const accepted = (id: number) =>
  details(id, { statusCode: 10, totalCorrect: 80, totalTestcases: 80 });

describe("detecting accepted submissions", () => {
  it("sends one payload when a watched submit is accepted", () => {
    const state = createDetector();
    expect(observe(state, submit(2189874571), T0)).toBeNull();
    expect(observe(state, judging(2189874571), T0 + 200)).toBeNull();
    expect(observe(state, accepted(2189874571), T0 + 2500)).toEqual({
      verdict: "ACCEPTED",
      submissionId: "2189874571",
      problemSlug: "contains-duplicate",
      language: "python3",
      code: CODE,
      submittedAt: 1793861061,
    });
    // The page polls again, or the person reopens the result: nothing more is sent.
    expect(observe(state, accepted(2189874571), T0 + 4000)).toBeNull();
    expect(observe(state, { kind: "page-accepted", id: "2189874571" }, T0 + 4000)).toBeNull();
  });

  it("never sends anything for the account's username or other fields", () => {
    const state = createDetector();
    observe(state, submit(1), T0);
    const payload = observe(state, accepted(1), T0);
    expect(Object.keys(payload!).sort()).toEqual(
      ["code", "language", "problemSlug", "submissionId", "submittedAt", "verdict"].sort(),
    );
  });

  it("ignores accepted results for submissions it didn't see submitted", () => {
    // Browsing an old submission's page reports it as accepted too.
    const state = createDetector();
    expect(observe(state, accepted(42), T0)).toBeNull();
    expect(observe(state, { kind: "page-accepted", id: "42" }, T0)).toBeNull();
  });

  it("drops a submission that was judged and not accepted", () => {
    const state = createDetector();
    observe(state, submit(2189874372), T0);
    const failed = details(2189874372, {
      statusCode: 15,
      runtimeError: "IndentationError",
      totalCorrect: 0,
      totalTestcases: 80,
    });
    expect(observe(state, failed, T0 + 1000)).toBeNull();
    expect(observe(state, { kind: "page-accepted", id: "2189874372" }, T0 + 2000)).toBeNull();
  });

  it("refuses an 'accepted' status that didn't pass every test", () => {
    const state = createDetector();
    observe(state, submit(7), T0);
    expect(
      observe(state, details(7, { statusCode: 10, totalCorrect: 79, totalTestcases: 80 }), T0),
    ).toBeNull();
  });

  it("falls back to the submit's code, and to the page's own label", () => {
    const state = createDetector();
    observe(state, submit(8, "print(8)"), T0);
    const payload = observe(state, { kind: "page-accepted", id: "8" }, T0 + 3000);
    expect(payload).toMatchObject({
      submissionId: "8",
      code: "print(8)",
      submittedAt: Math.floor((T0 + 3000) / 1000),
    });
  });

  it("reads batched GraphQL by position", () => {
    const state = createDetector();
    observe(state, submit(9), T0);
    const single = accepted(9);
    const batch = {
      kind: "graphql" as const,
      request: [{ operationName: "questionDetail", variables: {} }, single.request],
      response: [{ data: { question: {} } }, single.response],
    };
    expect(observe(state, batch, T0)?.submissionId).toBe("9");
  });

  it("handles the older /check/ polling", () => {
    const state = createDetector();
    observe(state, submit(10), T0);
    expect(
      observe(state, { kind: "check", id: "10", response: { state: "PENDING" } }, T0),
    ).toBeNull();
    const payload = observe(
      state,
      {
        kind: "check",
        id: "10",
        response: {
          state: "SUCCESS",
          status_code: 10,
          lang: "python3",
          task_finish_time: 1793861061000,
        },
      },
      T0,
    );
    expect(payload).toMatchObject({ submissionId: "10", submittedAt: 1793861061, code: CODE });
  });

  it("forgets a submit that never got a verdict", () => {
    const state = createDetector();
    observe(state, submit(11), T0);
    expect(observe(state, accepted(11), T0 + 11 * 60_000)).toBeNull();
  });

  it("ignores shapes it doesn't recognize", () => {
    const state = createDetector();
    for (const junk of [null, "text", 42, [], { submission_id: "abc" }]) {
      expect(
        observe(state, { kind: "submit", slug: "x", request: junk, response: junk }, T0),
      ).toBeNull();
      expect(observe(state, { kind: "graphql", request: junk, response: junk }, T0)).toBeNull();
    }
    observe(state, submit(12), T0);
    expect(
      observe(
        state,
        details(12, { statusCode: 10, code: "", totalCorrect: 1, totalTestcases: 1 }),
        T0,
      ),
    ).toMatchObject({ code: CODE });
  });

  it("drops payloads that fail the shared contract", () => {
    const state = createDetector();
    observe(state, { ...submit(13), slug: "Not A Slug" }, T0);
    expect(observe(state, details(13, { statusCode: 10, question: {} }), T0)).toBeNull();
  });
});

describe("reading LeetCode URLs", () => {
  it("finds slugs and IDs, and ignores runs", () => {
    expect(submitSlug("/problems/two-sum/submit/")).toBe("two-sum");
    expect(submitSlug("/problems/two-sum/interpret_solution/")).toBeNull();
    expect(checkId("/submissions/detail/2189874571/check/")).toBe("2189874571");
    expect(checkId("/submissions/detail/runcode_1793860842.8_f6o/check/")).toBeNull();
    expect(pageSubmissionId("/problems/contains-duplicate/submissions/2189874571/")).toBe(
      "2189874571",
    );
    expect(pageSubmissionId("/problems/contains-duplicate/")).toBeNull();
  });
});
