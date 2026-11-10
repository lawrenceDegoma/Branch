import { z } from "zod";
import { checkboxSchema } from "@/lib/form";

export const STUDY_NOTE_MAX = 500;

const sessionId = z.uuid({ error: "We couldn't find that session." });

/** After a session: share it to a group, or don't; either way, maybe remember the choice. */
export const studyDecisionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("share"),
    sessionId,
    groupId: z.uuid({ error: "Choose a group." }),
    note: z
      .string()
      .trim()
      .max(STUDY_NOTE_MAX, `Use at most ${STUDY_NOTE_MAX} characters.`)
      .transform((note) => note || null),
    remember: checkboxSchema,
  }),
  z.object({ intent: z.literal("skip"), sessionId, remember: checkboxSchema }),
]);
export type StudyDecision = z.infer<typeof studyDecisionSchema>;

/** Settings: "ASK", "NEVER", or "GROUP:<group ID>". */
export const studySharingSchema = z.union([
  z.literal("ASK").transform(() => ({ mode: "ASK" as const })),
  z.literal("NEVER").transform(() => ({ mode: "NEVER" as const })),
  z
    .string()
    .regex(/^GROUP:[0-9a-f-]{36}$/, "Choose what happens after a session.")
    .transform((value) => ({ mode: "GROUP" as const, groupId: value.slice("GROUP:".length) })),
]);
export type StudySharingChoice = z.infer<typeof studySharingSchema>;

export const sessionIdSchema = sessionId;
