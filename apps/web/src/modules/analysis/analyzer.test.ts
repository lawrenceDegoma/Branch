import { describe, expect, it } from "vitest";
import { AnalyzerUnavailableError, httpAnalyzer } from "./analyzer";

const answer = {
  analyzerVersion: "2026.11.1",
  status: "ok",
  time: "O(n)",
  space: "O(1)",
  confidence: "high",
  reasons: ["A loop goes over the input once."],
  limitations: [],
};

function recordingFetch(status: number, body: unknown) {
  const requests: Request[] = [];
  const fetchImpl = (async (url: URL, init: RequestInit) => {
    requests.push(new Request(url, init));
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
}

describe("the analyzer over HTTP", () => {
  it("sends the code with the secret and reads the estimate", async () => {
    const { fetchImpl, requests } = recordingFetch(200, answer);
    const analyzer = httpAnalyzer("https://analyzer.example", "s".repeat(32), fetchImpl);
    expect(await analyzer.analyze({ language: "python3", code: "x = 1" })).toMatchObject({
      status: "ok",
      time: "O(n)",
    });
    const [request] = requests;
    expect(request!.url).toBe("https://analyzer.example/analyze");
    expect(request!.method).toBe("POST");
    expect(request!.headers.get("authorization")).toBe(`Bearer ${"s".repeat(32)}`);
    expect(await request!.json()).toEqual({ language: "python3", code: "x = 1" });
  });

  it("reads the version", async () => {
    const { fetchImpl, requests } = recordingFetch(200, { analyzerVersion: "2026.11.1" });
    expect(await httpAnalyzer("https://a.example", "s".repeat(32), fetchImpl).version()).toBe(
      "2026.11.1",
    );
    expect(requests[0]!.method).toBe("GET");
  });

  it("treats errors and odd answers as unavailable, never as an estimate", async () => {
    const cases: [number, unknown][] = [
      [401, { detail: "Unauthorized." }],
      [503, {}],
      [200, "not json"],
      [200, { ...answer, confidence: "certain" }],
      [200, { ...answer, reasons: Array(21).fill("x") }],
    ];
    for (const [status, body] of cases) {
      const { fetchImpl } = recordingFetch(status, body);
      await expect(
        httpAnalyzer("https://a.example", "s".repeat(32), fetchImpl).analyze({
          language: "python3",
          code: "x",
        }),
      ).rejects.toBeInstanceOf(AnalyzerUnavailableError);
    }
    const offline = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(
      httpAnalyzer("https://a.example", "s".repeat(32), offline).version(),
    ).rejects.toBeInstanceOf(AnalyzerUnavailableError);
  });
});
