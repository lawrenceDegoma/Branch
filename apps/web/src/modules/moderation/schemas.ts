import { z } from "zod";
import { REPORT_NOTE_MAX, REPORT_REASONS } from "./limits";

export { REASON_LABEL, REPORT_NOTE_MAX, REPORT_REASONS, type ReportReasonValue } from "./limits";

/** A report of one post or one comment. */
export const reportSchema = z
  .object({
    postId: z.uuid().optional(),
    commentId: z.uuid().optional(),
    reason: z.enum(REPORT_REASONS, { error: "Choose a reason." }),
    note: z
      .string()
      .trim()
      .max(REPORT_NOTE_MAX, `Use at most ${REPORT_NOTE_MAX} characters.`)
      .optional()
      .transform((note) => note || null),
  })
  .refine((input) => Boolean(input.postId) !== Boolean(input.commentId), {
    error: "Report one post or comment.",
  });
export type ReportInput = z.infer<typeof reportSchema>;

export const userIdSchema = z.string().min(1).max(100);
