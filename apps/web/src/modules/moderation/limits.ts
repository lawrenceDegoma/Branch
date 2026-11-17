// Limits and labels that forms show, kept out of schemas.ts so client components can import
// them without Zod (src/test/client-bundle.test.ts). schemas.ts re-exports them.

export const REPORT_NOTE_MAX = 500;
export const REPORT_REASONS = ["SPAM", "HARASSMENT", "SPOILER", "OTHER"] as const;
export type ReportReasonValue = (typeof REPORT_REASONS)[number];

export const REASON_LABEL: Record<ReportReasonValue, string> = {
  SPAM: "Spam",
  HARASSMENT: "Harassment or abuse",
  SPOILER: "A spoiler that isn't marked",
  OTHER: "Something else",
};
