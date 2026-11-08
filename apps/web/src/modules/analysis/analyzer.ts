import "server-only";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

// The analyzer behind an interface, so the job runner doesn't care where estimates come from
// (Branch's Python service today; tests use a fake). Code goes only to the configured service,
// over HTTPS, with the shared secret.

const REQUEST_TIMEOUT_MS = 15_000;

export const analyzerAnswerSchema = z.object({
  analyzerVersion: z.string().min(1).max(40),
  status: z.enum(["ok", "unparseable", "unsupported"]),
  time: z.string().max(120).nullish(),
  space: z.string().max(120).nullish(),
  confidence: z.enum(["low", "medium", "high"]).nullish(),
  reasons: z.array(z.string().max(500)).max(20).default([]),
  limitations: z.array(z.string().max(500)).max(20).default([]),
  /** What the letters stand for. Analyzer versions before 2026.11.4 don't send it. */
  notation: z.string().max(1000).nullish(),
  /** A ceiling the code may never reach ("at most"). */
  bound: z.boolean().default(false),
  message: z.string().max(500).nullish(),
});
export type AnalyzerAnswer = z.infer<typeof analyzerAnswerSchema>;

export interface Analyzer {
  /** The analyzer's rule version; part of the cache key. */
  version(): Promise<string>;
  analyze(input: { language: string; code: string }): Promise<AnalyzerAnswer>;
}

export class AnalyzerUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalyzerUnavailableError";
  }
}

export function httpAnalyzer(
  baseUrl: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
): Analyzer {
  async function call(path: string, body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(new URL(path, baseUrl), {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new AnalyzerUnavailableError("The analyzer couldn't be reached.");
    }
    if (!response.ok)
      throw new AnalyzerUnavailableError(`The analyzer answered ${response.status}.`);
    try {
      return await response.json();
    } catch {
      throw new AnalyzerUnavailableError("The analyzer's answer wasn't JSON.");
    }
  }

  return {
    async version() {
      const parsed = z
        .object({ analyzerVersion: z.string().min(1).max(40) })
        .safeParse(await call("/version"));
      if (!parsed.success)
        throw new AnalyzerUnavailableError("The analyzer's version was unreadable.");
      return parsed.data.analyzerVersion;
    },
    async analyze(input) {
      const parsed = analyzerAnswerSchema.safeParse(await call("/analyze", input));
      if (!parsed.success)
        throw new AnalyzerUnavailableError("The analyzer's answer was unreadable.");
      return parsed.data;
    },
  };
}

/** The configured analyzer, or null when ANALYZER_URL isn't set (analysis is off). */
export function configuredAnalyzer(): Analyzer | null {
  const { ANALYZER_URL, ANALYZER_SECRET } = serverEnv();
  return ANALYZER_URL && ANALYZER_SECRET ? httpAnalyzer(ANALYZER_URL, ANALYZER_SECRET) : null;
}
