import { z } from "zod";
import { checkboxSchema } from "@/lib/form";
import { SUBMISSION_CODE_MAX } from "@branch/shared/extension";
import { PASTE_LANGUAGES } from "./languages";

export {
  SUBMISSION_BODY_MAX_BYTES,
  SUBMISSION_CODE_MAX,
  submissionPayloadSchema,
  type SubmissionPayload,
} from "@branch/shared/extension";

export const connectionIdSchema = z.uuid();
export const submissionIdSchema = z.uuid();

/** A solution pasted into Branch for a problem the person has solved. */
export const pastedSolutionSchema = z.object({
  problemId: z.uuid("Choose a problem you've solved."),
  language: z.enum(
    PASTE_LANGUAGES.map((l) => l.slug) as [string, ...string[]],
    "Choose a language.",
  ),
  code: z
    .string()
    .max(
      SUBMISSION_CODE_MAX,
      `Code can be at most ${SUBMISSION_CODE_MAX.toLocaleString("en")} characters.`,
    )
    .refine((code) => code.trim().length > 0, "Paste your solution."),
});

/** Sharing a solution to a group: which group, an optional note, and whether to show the code. */
export const shareSolutionSchema = z.object({
  submissionId: z.uuid("We couldn't find that solution."),
  groupId: z.uuid("Choose a group."),
  note: z
    .string()
    .trim()
    .max(1000, "Use at most 1,000 characters.")
    .optional()
    .transform((value) => value || null),
  includeCode: checkboxSchema,
});
