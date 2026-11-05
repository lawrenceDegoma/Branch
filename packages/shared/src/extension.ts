import { z } from "zod";

// The contract between the browser extension and Branch's API. The extension sends only accepted
// submissions it watched the person make (see docs/LEETCODE-SPIKE.md); the server validates the
// same schema, so the two can't drift.

export const SUBMISSION_CODE_MAX = 100_000;
/** Request bodies above this are refused before parsing (code plus a little JSON). */
export const SUBMISSION_BODY_MAX_BYTES = 256_000;

export const submissionPayloadSchema = z
  .object({
    verdict: z.literal("ACCEPTED"),
    /** LeetCode's numeric submission ID, as a string. */
    submissionId: z.string().regex(/^[0-9]{1,20}$/),
    problemSlug: z
      .string()
      .max(200)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    /** LeetCode's language slug, e.g. python3. */
    language: z.string().regex(/^[A-Za-z0-9+#._-]{1,40}$/),
    code: z.string().min(1).max(SUBMISSION_CODE_MAX),
    /** When LeetCode judged it, in Unix seconds. */
    submittedAt: z.number().int().positive(),
  })
  .strict();
export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;

/** Responses from POST /api/extension/submissions. */
export type IngestResponse = { stored: "new" | "duplicate"; counted: boolean };
export type ApiErrorResponse = { error: { code: string; message: string } };
/** GET /api/extension/connection. */
export type ConnectionResponse = { name: string; username: string | null };

export { EXTENSION_DISCLOSURE, PAGE_MESSAGE } from "./extension-text";
