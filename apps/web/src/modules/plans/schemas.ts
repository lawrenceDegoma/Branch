import { z } from "zod";
import { isCalendarDate } from "@branch/shared/calendar";
import { MAX_PROBLEMS_PER_WEEK, MAX_WEEK } from "@branch/shared/schedule";

export const calendarDateSchema = z.string().trim().refine(isCalendarDate, "Choose a valid date.");

export const pacingSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("PER_WEEK"),
    problemsPerWeek: z.coerce
      .number()
      .int("Use a whole number.")
      .min(1, "At least 1 problem a week.")
      .max(MAX_PROBLEMS_PER_WEEK, `At most ${MAX_PROBLEMS_PER_WEEK} problems a week.`),
  }),
  z.object({ mode: z.literal("PER_SECTION") }),
]);

export const createPlanSchema = z.object({
  roadmapVersionId: z.uuid("Choose a roadmap."),
  startDate: calendarDateSchema,
  pacing: pacingSchema,
});
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const weekNumberSchema = z.coerce.number().int().min(1).max(MAX_WEEK);
