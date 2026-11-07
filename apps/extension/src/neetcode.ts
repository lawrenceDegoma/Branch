import { submissionPayloadSchema } from "@branch/shared/extension";
import type { Outcome } from "./detect";

// Decides, from traffic the neetcode.io page already makes, when the person has had a submission
// accepted. Pure, like detect.ts. The rules come from docs/NEETCODE-SPIKE.md:
//
// - Opening a problem loads its details (`getProblemMetadataFunctionHttp`). Only two fields are
//   kept: neetcode.io's ID for the problem and its LeetCode title. Everything else in that reply
//   (descriptions, official solutions, the person's past submissions) is ignored.
// - Pressing Submit posts `executeCodeFunctionHttp` with the code and language; its reply is the
//   verdict. Accepted is status 3 with every test passed. Run uses a different request, so test
//   runs never count, and the reply only arrives for a Submit, so old submissions never sync.
// - The LeetCode problem is the title made into a slug, the way LeetCode makes its own.
//
// Anything unrecognized is ignored; the worst a neetcode.io change can do is stop syncing.

/** Judge status for an accepted run. */
const ACCEPTED = 3;
/** Still queued or running. */
const JUDGING = new Set([1, 2]);
/** Problem titles remembered per tab; more than anyone opens in one sitting. */
const TITLES_KEPT = 100;

export type NeetcodeObservation =
  { kind: "problem"; response: unknown } | { kind: "execute"; request: unknown; response: unknown };

export type NeetcodeState = { titles: Map<string, string>; sent: Set<string> };

export const createNeetcodeDetector = (): NeetcodeState => ({ titles: new Map(), sent: new Set() });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const dataOf = (value: unknown) => (isRecord(value) && isRecord(value.data) ? value.data : null);

const NEETCODE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** LeetCode's slug for a title: "Pow(x, n)" → "powx-n", "Two Sum" → "two-sum". */
export function leetcodeSlug(title: string): string | null {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return NEETCODE_ID.test(slug) ? slug : null;
}

/** neetcode.io's language names, as LeetCode's slugs (which Branch stores). */
const LANGUAGES: Record<string, string> = { python: "python3", go: "golang" };
export const leetcodeLanguage = (lang: string) => LANGUAGES[lang] ?? lang;

/** Feeds one observation in; returns what it completed, if anything. */
export function observeNeetcode(
  state: NeetcodeState,
  observation: NeetcodeObservation,
  now = Date.now(),
): Outcome | null {
  if (observation.kind === "problem") {
    const data = dataOf(observation.response);
    const id = str(data?.id);
    const title = str(data?.name);
    if (id && title && NEETCODE_ID.test(id)) {
      state.titles.delete(id);
      state.titles.set(id, title);
      if (state.titles.size > TITLES_KEPT) {
        state.titles.delete(state.titles.keys().next().value!);
      }
    }
    return null;
  }

  const request = dataOf(observation.request);
  const result = dataOf(observation.response);
  const problemId = str(request?.problemId);
  const code = str(request?.rawCode);
  const language = str(request?.lang);
  if (!result || !problemId || !NEETCODE_ID.test(problemId) || !code || !language) return null;
  const status = isRecord(result.status) ? num(result.status.id) : undefined;
  if (status === undefined || JUDGING.has(status)) return null;

  const correct = num(result.correct_test_case_count);
  const total = num(result.test_case_count);
  const title = state.titles.get(problemId);
  const slug = title ? leetcodeSlug(title) : null;
  if (status !== ACCEPTED || correct === undefined || correct !== total) {
    return { type: "not-accepted", slug: slug ?? problemId };
  }
  if (!slug) return { type: "unidentified", slug: problemId };

  const judgedAt = Date.parse(str(result.date) ?? "");
  const at = Number.isFinite(judgedAt) ? judgedAt : now;
  const submissionId = String(at);
  if (state.sent.has(submissionId)) return null;
  const parsed = submissionPayloadSchema.safeParse({
    source: "NEETCODE",
    verdict: "ACCEPTED",
    submissionId,
    problemSlug: slug,
    language: leetcodeLanguage(language),
    code,
    submittedAt: Math.floor(at / 1000),
  });
  if (!parsed.success) return null;
  state.sent.add(submissionId);
  return { type: "accepted", payload: parsed.data };
}

/** Which neetcode.io request a URL path is, if it's one the extension reads. */
export function neetcodeRequest(pathname: string): NeetcodeObservation["kind"] | null {
  if (pathname === "/api/getProblemMetadataFunctionHttp") return "problem";
  if (pathname === "/api/executeCodeFunctionHttp") return "execute";
  return null;
}
