import { z } from "zod";
import { REVIEW_OUTCOMES } from "./schedule";

export const reviewInputSchema = z.object({
  problemId: z.uuid(),
  outcome: z.enum(REVIEW_OUTCOMES),
});

export const reviewAttemptIdSchema = z.uuid();
