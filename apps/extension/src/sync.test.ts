import type { SubmissionPayload } from "@branch/shared/extension";
import { describe, expect, it } from "vitest";
import { fetchConnection, sendSubmission } from "./api";
import { enqueue, QUEUE_LIMIT, retryDelayMinutes } from "./queue";

const payload = (
  id = "1",
  source: SubmissionPayload["source"] = "LEETCODE",
): SubmissionPayload => ({
  source,
  verdict: "ACCEPTED",
  submissionId: id,
  problemSlug: "two-sum",
  language: "python3",
  code: "print(1)",
  submittedAt: 1793861061,
});

const respond = (status: number, body: unknown = {}) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("sending to Branch", () => {
  it("classifies every answer so the queue knows what to do", async () => {
    expect(
      await sendSubmission("t", payload(), respond(200, { stored: "new", counted: true })),
    ).toEqual({
      kind: "ok",
      result: { stored: "new", counted: true },
    });
    expect(await sendSubmission("t", payload(), respond(401))).toEqual({ kind: "unauthorized" });
    expect(
      await sendSubmission(
        "t",
        payload(),
        respond(400, { error: { code: "INVALID", message: "Invalid fields: code." } }),
      ),
    ).toEqual({ kind: "rejected", message: "Invalid fields: code." });
    expect((await sendSubmission("t", payload(), respond(413))).kind).toBe("rejected");
    expect((await sendSubmission("t", payload(), respond(429))).kind).toBe("retry");
    expect((await sendSubmission("t", payload(), respond(503))).kind).toBe("retry");
    const offline = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await sendSubmission("t", payload(), offline)).toEqual({
      kind: "retry",
      message: "Couldn't reach Branch.",
    });
  });

  it("sends the token as a bearer header and nothing else identifying", async () => {
    let seen: RequestInit | undefined;
    const capture = (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await sendSubmission("brx_token", payload(), capture);
    expect(seen?.headers).toEqual({
      authorization: "Bearer brx_token",
      "content-type": "application/json",
    });
    expect(seen?.credentials).toBeUndefined();
  });

  it("reads the connection, treating 401 as not connected", async () => {
    expect(await fetchConnection("t", respond(200, { name: "Ada", username: "ada" }))).toEqual({
      name: "Ada",
      username: "ada",
    });
    expect(await fetchConnection("t", respond(401))).toBeNull();
    await expect(fetchConnection("t", respond(500))).rejects.toThrow();
  });
});

describe("the queue", () => {
  it("keeps one entry per submission and a bounded length", () => {
    let queue = enqueue([], payload("1"), 0);
    queue = enqueue(queue, payload("1"), 1);
    expect(queue).toHaveLength(1);
    for (let i = 2; i <= QUEUE_LIMIT + 5; i++) queue = enqueue(queue, payload(String(i)), i);
    expect(queue).toHaveLength(QUEUE_LIMIT);
    expect(queue[0]!.payload.submissionId).toBe("6");
  });

  it("tells sites apart, and treats items queued before 1.1.0 (no source) as LeetCode", () => {
    let queue = enqueue([], payload("1", "LEETCODE"), 0);
    queue = enqueue(queue, payload("1", "NEETCODE"), 1);
    expect(queue).toHaveLength(2);
    const legacy: Partial<SubmissionPayload> = payload("2");
    delete legacy.source;
    queue = [...queue, { payload: legacy as SubmissionPayload, attempts: 0, queuedAt: 2 }];
    expect(enqueue(queue, payload("2", "LEETCODE"), 3)).toHaveLength(3);
    expect(enqueue(queue, payload("2", "NEETCODE"), 3)).toHaveLength(4);
  });

  it("backs off up to an hour", () => {
    expect([1, 2, 3, 4, 7, 20].map(retryDelayMinutes)).toEqual([1, 2, 4, 8, 60, 60]);
  });
});
