import { z } from "zod";

export const REPORT_NOTE_MAX = 500;
export const REPORT_REASONS = ["SPAM", "HARASSMENT", "SPOILER", "OTHER"] as const;
export type ReportReasonValue = (typeof REPORT_REASONS)[number];

export const REASON_LABEL: Record<ReportReasonValue, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment or abuse",
  SPOILER: "A spoiler that isn't marked",
  OTHER: "Something else",
};

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
