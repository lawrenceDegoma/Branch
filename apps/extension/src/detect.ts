import { submissionPayloadSchema, type SubmissionPayload } from "@branch/shared/extension";

// Decides, from traffic the LeetCode page already makes, when the person has had a submission
// accepted. Pure: the page script feeds it observations and sends whatever it returns. The rules
// come from docs/LEETCODE-SPIKE.md:
//
// - Pressing Submit posts to /problems/<slug>/submit/ with the code and language, and gets back a
//   numeric submission ID. Only IDs seen this way count, so opening an old submission (which
//   LeetCode also reports as Accepted) never syncs it.
// - The page then polls GraphQL `submissionDetails` for that ID: statusCode 16 while judging, 10
//   when accepted. (Older pages polled /submissions/detail/<id>/check/; that's handled too.)
// - The page's own "Accepted" label is a fallback if the GraphQL shape changes.
//
// Anything unrecognized is ignored; the worst a LeetCode change can do is stop syncing.

/** LeetCode's status code for an accepted submission. */
const ACCEPTED = 10;
/** Still being judged. */
const JUDGING = new Set([14 /* old pages: pending */, 16]);
/** How long a submit waits for its verdict before it's forgotten. */
const PENDING_TTL_MS = 10 * 60_000;

export type Observation =
  | { kind: "submit"; slug: string; request: unknown; response: unknown }
  | { kind: "graphql"; request: unknown; response: unknown }
  | { kind: "check"; id: string; response: unknown }
  | { kind: "page-accepted"; id: string };

type Pending = { slug: string; language: string; code: string; at: number };

export type DetectorState = { pending: Map<string, Pending>; sent: Set<string> };

/**
 * What an observation completed: a Submit seen (now awaiting its verdict), a verdict that wasn't
 * an accept, or an accepted submission to send. Only the last carries any code.
 */
export type Outcome =
  | { type: "submitted"; slug: string }
  | { type: "not-accepted"; slug: string }
  | { type: "accepted"; payload: SubmissionPayload };

export const createDetector = (): DetectorState => ({ pending: new Map(), sent: new Set() });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** Feeds one observation in; returns what it completed, if anything. */
export function observe(
  state: DetectorState,
  observation: Observation,
  now = Date.now(),
): Outcome | null {
  for (const [id, pending] of state.pending) {
    if (now - pending.at > PENDING_TTL_MS) state.pending.delete(id);
  }
  switch (observation.kind) {
    case "submit":
      return onSubmit(state, observation, now);
    case "graphql":
      return onGraphql(state, observation, now);
    case "check":
      return onCheck(state, observation, now);
    case "page-accepted":
      return accept(state, observation.id, {}, now);
  }
}

function onSubmit(
  state: DetectorState,
  { slug, request, response }: Extract<Observation, { kind: "submit" }>,
  now: number,
): Outcome | null {
  if (!isRecord(request) || !isRecord(response)) return null;
  const id = num(response.submission_id);
  const language = str(request.lang);
  const code = str(request.typed_code);
  if (id === undefined || !language || !code) return null;
  state.pending.set(String(id), { slug, language, code, at: now });
  return { type: "submitted", slug };
}

function onGraphql(
  state: DetectorState,
  { request, response }: Extract<Observation, { kind: "graphql" }>,
  now: number,
) {
  // Requests may be batched: match each operation to its result by position.
  const requests = Array.isArray(request) ? request : [request];
  const responses = Array.isArray(response) ? response : [response];
  for (const [index, op] of requests.entries()) {
    if (!isRecord(op) || op.operationName !== "submissionDetails") continue;
    const id = isRecord(op.variables) ? String(op.variables.submissionId ?? "") : "";
    const result = responses[index];
    const details =
      isRecord(result) && isRecord(result.data) ? result.data.submissionDetails : null;
    if (!isRecord(details) || !state.pending.has(id)) continue;
    const status = num(details.statusCode);
    if (status === undefined || JUDGING.has(status)) continue;
    const correct = num(details.totalCorrect);
    const total = num(details.totalTestcases);
    if (
      status !== ACCEPTED ||
      (correct !== undefined && total !== undefined && correct !== total)
    ) {
      return reject(state, id); // judged, and not accepted
    }
    const question = isRecord(details.question) ? details.question : {};
    const lang = isRecord(details.lang) ? details.lang : {};
    const timestamp = num(details.timestamp);
    return accept(
      state,
      id,
      {
        slug: str(question.titleSlug),
        language: str(lang.name),
        code: str(details.code),
        submittedAt: timestamp,
      },
      now,
    );
  }
  return null;
}

function onCheck(
  state: DetectorState,
  { id, response }: Extract<Observation, { kind: "check" }>,
  now: number,
) {
  // Runs ("runcode_…") never reach here as pending, so only real submissions count.
  if (!isRecord(response) || response.state !== "SUCCESS" || !state.pending.has(id)) return null;
  if (num(response.status_code) !== ACCEPTED) return reject(state, id);
  const finished = num(response.task_finish_time);
  return accept(
    state,
    id,
    {
      language: str(response.lang),
      submittedAt: finished ? Math.floor(finished / 1000) : undefined,
    },
    now,
  );
}

function reject(state: DetectorState, id: string): Outcome | null {
  const pending = state.pending.get(id);
  state.pending.delete(id);
  return pending ? { type: "not-accepted", slug: pending.slug } : null;
}

/** Completes a pending submission, preferring the verdict's own fields over the submit's. */
function accept(
  state: DetectorState,
  id: string,
  fields: { slug?: string; language?: string; code?: string; submittedAt?: number },
  now: number,
): Outcome | null {
  const pending = state.pending.get(id);
  if (!pending || state.sent.has(id)) return null;
  const parsed = submissionPayloadSchema.safeParse({
    verdict: "ACCEPTED",
    submissionId: id,
    problemSlug: fields.slug ?? pending.slug,
    language: fields.language ?? pending.language,
    code: fields.code ?? pending.code,
    submittedAt: fields.submittedAt ?? Math.floor(now / 1000),
  });
  state.pending.delete(id);
  if (!parsed.success) return null;
  state.sent.add(id);
  return { type: "accepted", payload: parsed.data };
}

/** The problem slug from a submit URL path, e.g. /problems/two-sum/submit/. */
export function submitSlug(pathname: string): string | null {
  return pathname.match(/^\/problems\/([a-z0-9]+(?:-[a-z0-9]+)*)\/submit\/?$/)?.[1] ?? null;
}

/** The submission ID from a legacy check URL; runs ("runcode_…") return null. */
export function checkId(pathname: string): string | null {
  return pathname.match(/^\/submissions\/detail\/([0-9]+)\/check\/?$/)?.[1] ?? null;
}

/** The submission ID in the page address after a submit, e.g. /problems/x/submissions/123/. */
export function pageSubmissionId(pathname: string): string | null {
  return pathname.match(/\/submissions\/([0-9]+)\/?$/)?.[1] ?? null;
}
