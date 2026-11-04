import { z } from "zod";

export const problemIdSchema = z.uuid();

export const completionInputSchema = z.object({
  problemId: problemIdSchema,
  solved: z.boolean(),
});
