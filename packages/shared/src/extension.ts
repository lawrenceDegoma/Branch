import { z } from "zod";

// The contract between the browser extension and Branch's API. The extension sends only accepted
// submissions it watched the person make on LeetCode or neetcode.io (see docs/LEETCODE-SPIKE.md
// and docs/NEETCODE-SPIKE.md); the server validates the same schema, so the two can't drift.

export const SUBMISSION_CODE_MAX = 100_000;
/** Request bodies above this are refused before parsing (code plus a little JSON). */
export const SUBMISSION_BODY_MAX_BYTES = 256_000;

/** Where a submission was made. */
export const SUBMISSION_SITES = ["LEETCODE", "NEETCODE"] as const;
export type SubmissionSite = (typeof SUBMISSION_SITES)[number];

export const submissionPayloadSchema = z
  .object({
    /** Extensions before 1.1.0 send no source: they only watch LeetCode. */
    source: z.enum(SUBMISSION_SITES).default("LEETCODE"),
    verdict: z.literal("ACCEPTED"),
    /**
     * Unique per user and site, as digits: LeetCode's submission ID, or for neetcode.io (which
     * shows none) the judging time in Unix milliseconds.
     */
    submissionId: z.string().regex(/^[0-9]{1,20}$/),
    /** The LeetCode problem's slug, whichever site it was solved on. */
    problemSlug: z
      .string()
      .max(200)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    /** LeetCode's language slug, e.g. python3 (neetcode.io's names are mapped to these). */
    language: z.string().regex(/^[A-Za-z0-9+#._-]{1,40}$/),
    code: z.string().min(1).max(SUBMISSION_CODE_MAX),
    /** When it was judged, in Unix seconds. */
    submittedAt: z.number().int().positive(),
  })
  .strict();
export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;
/** What the extension builds; `source` may be left out for LeetCode. */
export type SubmissionPayloadInput = z.input<typeof submissionPayloadSchema>;

/** Responses from POST /api/extension/submissions. */
export type IngestResponse = { stored: "new" | "duplicate"; counted: boolean };
export type ApiErrorResponse = { error: { code: string; message: string } };
/** GET /api/extension/connection. */
export type ConnectionResponse = { name: string; username: string | null };

export { EXTENSION_DISCLOSURE, PAGE_MESSAGE } from "./extension-text";
